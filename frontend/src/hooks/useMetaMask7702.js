/**
 * useMetaMask7702 Hook - Based on MetaMask's 7702-Readiness Demo
 * 
 * This implementation follows EXACTLY what MetaMask's official demo does.
 * Source: https://github.com/MetaMask/7702-Readiness
 * 
 * Key differences from previous attempts:
 * 1. Uses wallet_sendCalls WITHOUT atomicRequired (let MetaMask decide)
 * 2. Uses capabilities object format from EIP-5792
 * 3. Does NOT include paymasterService (MetaMask doesn't support it yet)
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseAbi } from 'viem';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
]);

// MetaMask's Stateless Delegator
const METAMASK_DELEGATOR = '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B';

const SUPPORTED_CHAINS = {
  80002: {
    name: 'Polygon Amoy',
    explorer: 'https://amoy.polygonscan.com'
  },
  11155111: {
    name: 'Ethereum Sepolia', 
    explorer: 'https://sepolia.etherscan.io'
  }
};

export function useMetaMask7702() {
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [callsId, setCallsId] = useState(null);
  const [isSmartAccount, setIsSmartAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check if EOA has been upgraded to Smart Account
   */
  const checkSmartAccount = useCallback(async () => {
    if (!address || !publicClient) return false;
    
    try {
      const code = await publicClient.getCode({ address });
      const upgraded = code && code !== '0x' && code.startsWith('0xef0100');
      setIsSmartAccount(upgraded);
      
      if (upgraded) {
        console.log('✅ Smart Account ENABLED');
        console.log('   Delegator:', '0x' + code.substring(8, 48));
      } else {
        console.log('❌ Smart Account NOT enabled');
      }
      
      return upgraded;
    } catch (err) {
      console.error('Error checking smart account:', err);
      return false;
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (address && publicClient) {
      checkSmartAccount();
    }
  }, [address, publicClient, chain?.id, checkSmartAccount]);

  /**
   * Get wallet capabilities (EIP-5792)
   * This tells us what the wallet supports
   */
  const getCapabilities = useCallback(async () => {
    if (!walletClient) return null;
    
    try {
      const capabilities = await walletClient.request({
        method: 'wallet_getCapabilities',
        params: [address]
      });
      console.log('📋 Wallet capabilities:', capabilities);
      return capabilities;
    } catch (err) {
      console.log('⚠️ wallet_getCapabilities not supported:', err.message);
      return null;
    }
  }, [walletClient, address]);

  /**
   * Execute calls using wallet_sendCalls (EIP-5792)
   * 
   * This follows MetaMask's 7702-Readiness demo format EXACTLY
   */
  const sendCalls = useCallback(async ({ calls }) => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    if (!SUPPORTED_CHAINS[chain.id]) {
      throw new Error(`Chain ${chain.id} not configured`);
    }

    setError(null);
    setTxHash(null);
    setCallsId(null);
    setStatus('preparing');
    setIsLoading(true);

    try {
      // Check capabilities first
      const capabilities = await getCapabilities();
      console.log('🔍 Chain capabilities:', capabilities?.[`0x${chain.id.toString(16)}`]);

      // Format calls - MetaMask expects this exact format
      const formattedCalls = calls.map(call => ({
        to: call.to,
        data: call.data || '0x',
        value: call.value ? `0x${BigInt(call.value).toString(16)}` : '0x0'
      }));

      console.log('📤 Sending wallet_sendCalls...');
      console.log('   Chain ID:', chain.id, `(0x${chain.id.toString(16)})`);
      console.log('   From:', address);
      console.log('   Calls:', formattedCalls.length);

      setStatus('signing');

      // MetaMask requires version 2.0.0 and atomicRequired as boolean
      // Add paymasterService for TRUE GASLESS
      const PIMLICO_API_KEY = process.env.REACT_APP_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
      const paymasterUrl = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${PIMLICO_API_KEY}`;
      
      console.log('🎯 Attempting TRUE GASLESS with paymaster:', paymasterUrl);
      
      const result = await walletClient.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0.0',
          from: address,
          chainId: `0x${chain.id.toString(16)}`,
          calls: formattedCalls,
          atomicRequired: true,
          capabilities: {
            paymasterService: {
              url: paymasterUrl
            }
          }
        }]
      });

      console.log('✅ wallet_sendCalls result:', result);
      
      // Extract the ID - MetaMask returns {id: '...'} or just the string
      const callsIdValue = typeof result === 'object' ? result.id : result;
      console.log('📋 Calls ID:', callsIdValue);
      
      setCallsId(callsIdValue);
      setStatus('confirming');

      // Poll for status
      const txHashResult = await pollForReceipt(callsIdValue);
      
      if (txHashResult) {
        setTxHash(txHashResult);
        setStatus('success');
        console.log('🎉 Transaction confirmed:', txHashResult);
      } else {
        setStatus('submitted');
        console.log('⏳ Transaction submitted, check explorer');
      }

      return {
        success: true,
        callsId: result,
        txHash: txHashResult,
        explorerUrl: txHashResult 
          ? `${SUPPORTED_CHAINS[chain.id].explorer}/tx/${txHashResult}`
          : null
      };

    } catch (err) {
      console.error('❌ wallet_sendCalls error:', err);
      
      setError(err.message);
      setStatus('error');
      
      // Log full error for debugging
      console.error('Full error:', {
        code: err.code,
        message: err.message,
        data: err.data
      });
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, walletClient, getCapabilities]);

  /**
   * Poll for transaction receipt
   */
  const pollForReceipt = useCallback(async (callsId) => {
    if (!walletClient) return null;
    
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes

    while (Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, 2000));
      
      try {
        const status = await walletClient.request({
          method: 'wallet_getCallsStatus',
          params: [callsId]
        });

        console.log('📊 Call status:', status);

        // MetaMask uses numeric status codes:
        // 100 = pending, 200 = confirmed, 400 = confirmed (alternate), 500 = failed
        const statusCode = status.status;
        
        if (statusCode === 'CONFIRMED' || statusCode === 'COMPLETE' || 
            statusCode === 200 || statusCode === 400) {
          // Check for receipts
          if (status.receipts?.[0]?.transactionHash) {
            return status.receipts[0].transactionHash;
          }
          // If no receipts but confirmed, return null (tx might still be indexing)
          if (statusCode === 200 || statusCode === 400) {
            console.log('✅ Transaction confirmed, waiting for receipt...');
          }
        }
        
        if (statusCode === 'FAILED' || statusCode === 500) {
          throw new Error(status.reason || 'Transaction failed');
        }
      } catch (err) {
        // Ignore polling errors, keep trying
        if (!err.message?.includes('not found')) {
          console.log('Polling...', err.message);
        }
      }
    }

    return null; // Timeout
  }, [walletClient]);

  /**
   * Execute approve + swap batch
   */
  const executeBatch = useCallback(async ({
    tokenAddress,
    spender,
    amount,
    routerHub,
    swapCallData
  }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return sendCalls({
      calls: [
        { to: tokenAddress, data: approveData, value: '0x0' },
        { to: routerHub, data: swapCallData, value: '0x0' }
      ]
    });
  }, [sendCalls]);

  /**
   * Execute single approval
   */
  const executeApproval = useCallback(async ({
    tokenAddress,
    spender,
    amount
  }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return sendCalls({
      calls: [{ to: tokenAddress, data: approveData, value: '0x0' }]
    });
  }, [sendCalls]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setTxHash(null);
    setCallsId(null);
    setIsLoading(false);
  }, []);

  return {
    // Actions
    sendCalls,
    executeBatch,
    executeApproval,
    checkSmartAccount,
    getCapabilities,
    reset,

    // State
    status,
    error,
    txHash,
    callsId,
    isSmartAccount,
    isLoading,

    // Convenience
    isReady: isConnected && !!walletClient,
    isPreparing: status === 'preparing',
    isSigning: status === 'signing',
    isConfirming: status === 'confirming',
    isSuccess: status === 'success',
    isError: status === 'error',

    // Chain info
    chainId: chain?.id,
    chainName: SUPPORTED_CHAINS[chain?.id]?.name,
    explorer: SUPPORTED_CHAINS[chain?.id]?.explorer
  };
}
