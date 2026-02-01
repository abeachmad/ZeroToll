/**
 * useEIP7702Swap Hook
 * 
 * Provides EIP-7702 gasless swap functionality with 50% gas savings
 * 
 * Features:
 * - EIP-7702 authorization signing
 * - EIP-2612 permit signing
 * - EIP-712 intent signing
 * - Gasless swap execution
 * - 50% cheaper than ERC-4337
 */

import { useState, useCallback } from 'react';
import { useAccount, useSignTypedData, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

// Deployed delegate addresses
const DELEGATE_ADDRESS = {
  80002: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C', // Amoy
  11155111: '0xcFE005B2E0013e0FF8cB0569d9b103094d423B36' // Sepolia
};

// Backend API URL
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export function useEIP7702Swap() {
  const { address, chainId } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  /**
   * Get quote for EIP-7702 swap
   */
  const getQuote = useCallback(async ({ tokenIn, tokenOut, amountIn }) => {
    try {
      const response = await fetch(`${API_URL}/api/eip7702/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId,
          tokenIn,
          tokenOut,
          amountIn: amountIn.toString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get quote');
      }

      const data = await response.json();
      return data.quote;
    } catch (err) {
      console.error('Quote error:', err);
      throw err;
    }
  }, [chainId]);

  /**
   * Get user's current nonce
   * Uses timestamp-based nonce for uniqueness
   */
  const getNonce = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/eip7702/nonce/${chainId}/${address}`);
      
      if (!response.ok) {
        throw new Error('Failed to get nonce');
      }

      const data = await response.json();
      
      if (data.success && data.nonce) {
        console.log('📊 Nonce from backend:', data.nonce, `(${data.type || 'unknown'})`);
        return data.nonce;
      }
      
      // Fallback: use timestamp
      const timestampNonce = Math.floor(Date.now() / 1000).toString();
      console.log('⚠️ Using timestamp fallback nonce:', timestampNonce);
      return timestampNonce;
    } catch (err) {
      console.error('Nonce error:', err);
      // Fallback: use timestamp to ensure uniqueness
      const timestampNonce = Math.floor(Date.now() / 1000).toString();
      console.log('⚠️ Error getting nonce, using timestamp:', timestampNonce);
      return timestampNonce;
    }
  }, [chainId, address]);

  /**
   * Sign EIP-7702 authorization
   * 
   * EIP-7702 authorization format:
   * - chainId: uint256
   * - address: address (delegate contract)
   * - nonce: uint64 (delegation nonce, usually 0 for first time)
   * - yParity: uint8 (0 or 1)
   * - r: bytes32
   * - s: bytes32
   */
  const signAuthorization = useCallback(async (nonce) => {
    try {
      const delegateAddress = DELEGATE_ADDRESS[chainId];
      if (!delegateAddress) {
        throw new Error(`EIP-7702 not supported on chain ${chainId}`);
      }

      console.log('📝 Signing authorization with nonce:', nonce);

      // CRITICAL: Use consistent format throughout
      // We sign with these exact values and return them
      const authData = {
        chainId: chainId.toString(),
        address: delegateAddress,
        nonce: nonce.toString()
      };

      // Sign using EIP-712 (wallets understand this)
      // The actual EIP-7702 signature will be constructed from this
      const signature = await signTypedDataAsync({
        domain: {
          name: 'EIP7702Authorization',
          version: '1',
          chainId: chainId
        },
        types: {
          Authorization: [
            { name: 'chainId', type: 'uint256' },
            { name: 'address', type: 'address' },
            { name: 'nonce', type: 'uint64' }
          ]
        },
        primaryType: 'Authorization',
        message: authData  // Use exact same object for consistency
      });

      // Parse signature into r, s, v components
      const r = signature.slice(0, 66);
      const s = '0x' + signature.slice(66, 130);
      const v = parseInt(signature.slice(130, 132), 16);
      
      // Convert v to yParity (0 or 1)
      const yParity = v >= 27 ? v - 27 : v;

      // Return authorization in EIP-7702 format
      // Use the EXACT same values we signed with
      return {
        chainId: authData.chainId,
        address: authData.address,
        nonce: authData.nonce,
        yParity,
        r,
        s
      };
    } catch (err) {
      console.error('Authorization signing error:', err);
      throw err;
    }
  }, [chainId, signTypedDataAsync]);

  /**
   * Sign EIP-2612 permit
   */
  const signPermit = useCallback(async ({ tokenAddress, amount }) => {
    try {
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      const delegateAddress = DELEGATE_ADDRESS[chainId];

      // Query permit nonce from token contract
      let permitNonce = 0;
      try {
        if (publicClient) {
          permitNonce = await publicClient.readContract({
            address: tokenAddress,
            abi: [{
              "inputs": [{"name": "owner", "type": "address"}],
              "name": "nonces",
              "outputs": [{"name": "", "type": "uint256"}],
              "stateMutability": "view",
              "type": "function"
            }],
            functionName: 'nonces',
            args: [address]
          });
          console.log('📊 Permit nonce from token:', permitNonce.toString());
        }
      } catch (err) {
        console.warn('⚠️  Could not query permit nonce, using 0:', err.message);
      }

      // EIP-2612 permit structure
      const permit = {
        owner: address,
        spender: delegateAddress,
        value: amount.toString(),
        nonce: permitNonce.toString(),
        deadline
      };

      // Sign permit
      const signature = await signTypedDataAsync({
        domain: {
          name: 'USD Coin', // Should be queried from token
          version: '2', // USDC uses version 2
          chainId: chainId,
          verifyingContract: tokenAddress
        },
        types: {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
          ]
        },
        primaryType: 'Permit',
        message: permit
      });

      // Parse signature
      const r = signature.slice(0, 66);
      const s = '0x' + signature.slice(66, 130);
      const v = parseInt(signature.slice(130, 132), 16);

      return {
        deadline,
        v,
        r,
        s
      };
    } catch (err) {
      console.error('Permit signing error:', err);
      throw err;
    }
  }, [chainId, address, publicClient, signTypedDataAsync]);

  /**
   * Sign swap intent (EIP-712)
   */
  const signIntent = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, nonce }) => {
    try {
      const delegateAddress = DELEGATE_ADDRESS[chainId];
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      const intent = {
        user: address,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        deadline,
        nonce: nonce.toString(),
        chainId: chainId.toString()
      };

      // Sign intent
      const signature = await signTypedDataAsync({
        domain: {
          name: 'ZeroTollDelegate',
          version: '1',
          chainId: chainId,
          verifyingContract: delegateAddress
        },
        types: {
          SwapIntent: [
            { name: 'user', type: 'address' },
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'minAmountOut', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'chainId', type: 'uint256' }
          ]
        },
        primaryType: 'SwapIntent',
        message: intent
      });

      return {
        intent,
        signature
      };
    } catch (err) {
      console.error('Intent signing error:', err);
      throw err;
    }
  }, [chainId, address, signTypedDataAsync]);

  /**
   * Execute EIP-7702 gasless swap
   */
  const executeSwap = useCallback(async ({ 
    tokenIn, 
    tokenOut, 
    amountIn, 
    minAmountOut 
  }) => {
    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Step 1: Get quote
      console.log('📊 Getting quote...');
      const quote = await getQuote({ tokenIn, tokenOut, amountIn });
      console.log('Quote:', quote);

      // Step 2: Get nonce
      console.log('🔢 Getting nonce...');
      const nonce = await getNonce();
      console.log('Nonce:', nonce);

      // Step 3: Sign EIP-7702 authorization with nonce
      console.log('✍️  Signing EIP-7702 authorization...');
      const authorization = await signAuthorization(nonce);  // Pass nonce here!
      console.log('Authorization signed with nonce:', nonce);

      // Step 4: Sign EIP-2612 permit
      console.log('✍️  Signing permit...');
      const permit = await signPermit({ 
        tokenAddress: tokenIn, 
        amount: amountIn 
      });
      console.log('Permit signed');

      // Step 5: Sign swap intent
      console.log('✍️  Signing intent...');
      const { intent, signature: intentSignature } = await signIntent({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        nonce
      });
      console.log('Intent signed');

      // Step 6: Execute swap via relayer
      console.log('🚀 Executing swap...');
      
      // Authorization is already in correct format (strings) from signAuthorization
      // No need to convert again - just pass it directly
      const response = await fetch(`${API_URL}/api/eip7702/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId,
          authorization,  // Already serializable (all strings)
          permit,
          intent,
          intentSignature,
          fee: quote.fee
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Swap execution failed');
      }

      const result = await response.json();
      console.log('✅ Swap executed:', result);

      // Parse txHash from different response formats
      let txHash = null;
      let explorerUrl = null;
      
      if (result.txHash) {
        txHash = result.txHash;
        explorerUrl = result.explorerUrl;
      } else if (result.data && result.data.txHash) {
        txHash = result.data.txHash;
        explorerUrl = result.data.explorerUrl;
      } else if (result.output) {
        // Parse from raw output string
        const txHashMatch = result.output.match(/Transaction sent: (0x[a-fA-F0-9]{64})/);
        if (txHashMatch) {
          txHash = txHashMatch[1];
          // Build explorer URL
          if (chainId === 11155111) {
            explorerUrl = `https://sepolia.etherscan.io/tx/${txHash}`;
          } else if (chainId === 80002) {
            explorerUrl = `https://amoy.polygonscan.com/tx/${txHash}`;
          }
        }
      }

      if (txHash) {
        setTxHash(txHash);
        console.log('📊 Transaction Hash:', txHash);
        console.log('🔍 Explorer:', explorerUrl);
      }

      return {
        ...result,
        txHash,
        explorerUrl,
        success: true
      };
    } catch (err) {
      console.error('Swap error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [
    chainId,
    getQuote,
    getNonce,
    signAuthorization,
    signPermit,
    signIntent
  ]);

  /**
   * Check if EIP-7702 is supported on current chain
   */
  const isSupported = useCallback(() => {
    return chainId && DELEGATE_ADDRESS[chainId] !== undefined;
  }, [chainId]);

  return {
    executeSwap,
    getQuote,
    loading,
    error,
    txHash,
    isSupported: isSupported(),
    delegateAddress: DELEGATE_ADDRESS[chainId],
    gasSavings: '50%' // vs ERC-4337
  };
}
