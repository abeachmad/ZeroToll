/**
 * useIntentGasless - Intent-based gasless swaps via Pimlico
 * 
 * This hook enables TRUE gasless swaps where users pay ZERO gas.
 * Uses EIP-712 signatures + Pimlico paymaster sponsorship.
 * 
 * Supports:
 * - ZTA/ZTB: 100% gasless (ERC-2612 Permit built-in)
 * - WETH/USDC: Approve Permit2 once, gasless forever
 */
import { useState, useCallback, useEffect } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';

const RELAYER_URL = process.env.REACT_APP_RELAYER_URL || 'http://localhost:3001';

// ZeroToll Router addresses per chain
const ZEROTOLL_ROUTERS = {
  11155111: '0xd475255Ae38C92404f9740A19F93B8D2526A684b', // Sepolia
  80002: '0xa28aB456a0434335c6953fd3A32A15A5cB12FE1A', // Amoy
};

// Gasless tokens (ERC-2612 Permit)
const GASLESS_TOKENS = {
  11155111: {
    ZTA: '0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf',
    ZTB: '0x8fb844251af76AF090B005643D966FC52852100a',
  },
  80002: {
    ZTA: '0x3Bead37cD9fB0E1621C8Cc2c58Ab0753085cF109',
    ZTB: '0x9e2eE39aDaE9A4985d1aC1Fbb55830e00F686668',
  }
};

// EIP-712 types for SwapIntent
const SWAP_INTENT_TYPES = {
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
};

export function useIntentGasless() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if current chain supports intent gasless
  const isSupported = chainId && ZEROTOLL_ROUTERS[chainId];
  const routerAddress = ZEROTOLL_ROUTERS[chainId];


  // Fetch config from relayer
  useEffect(() => {
    if (chainId && isSupported) {
      fetch(`${RELAYER_URL}/api/config/${chainId}`)
        .then(r => r.ok ? r.json() : null)
        .then(cfg => cfg && setConfig(cfg))
        .catch(() => {});
    }
  }, [chainId, isSupported]);

  // Check if token is gasless (ERC-2612)
  const isGaslessToken = useCallback((tokenAddress) => {
    if (!chainId || !GASLESS_TOKENS[chainId]) return false;
    const tokens = Object.values(GASLESS_TOKENS[chainId]);
    return tokens.some(t => t.toLowerCase() === tokenAddress?.toLowerCase());
  }, [chainId]);

  // Get nonce from relayer
  const getNonce = useCallback(async () => {
    if (!address || !chainId) return 0;
    try {
      const res = await fetch(`${RELAYER_URL}/api/nonce/${chainId}/${address}`);
      const data = await res.json();
      return parseInt(data.nonce || '0', 10);
    } catch {
      return 0;
    }
  }, [address, chainId]);

  // Get token balance
  const getTokenBalance = useCallback(async (tokenAddress) => {
    if (!address || !walletClient) return BigInt(0);
    
    try {
      const ownerHex = address.slice(2).toLowerCase().padStart(64, '0');
      const data = `0x70a08231${ownerHex}`;
      
      const result = await walletClient.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data }, 'latest']
      });
      return BigInt(result);
    } catch {
      return BigInt(0);
    }
  }, [address, walletClient]);

  // Sign ERC-2612 Permit
  const signPermit = useCallback(async (tokenAddress, spender, value, deadline) => {
    if (!address || !chainId || !walletClient) throw new Error('Not connected');

    // Get token name
    const nameData = await walletClient.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: '0x06fdde03' }, 'latest']
    });
    
    let tokenName = 'Token';
    try {
      const hex = nameData.slice(130);
      tokenName = hex.match(/.{2}/g).map(h => parseInt(h, 16)).filter(c => c > 0).map(c => String.fromCharCode(c)).join('');
    } catch {}

    // Get permit nonce
    const nonceData = `0x7ecebe00000000000000000000000000${address.slice(2)}`;
    const nonceResult = await walletClient.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: nonceData }, 'latest']
    });
    const permitNonce = parseInt(nonceResult, 16);

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      },
      primaryType: 'Permit',
      domain: {
        name: tokenName,
        version: '1',
        chainId: chainId,
        verifyingContract: tokenAddress
      },
      message: {
        owner: address,
        spender,
        value: value.toString(),
        nonce: permitNonce.toString(),
        deadline: deadline.toString()
      }
    };

    const signature = await walletClient.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)]
    });

    const r = signature.slice(0, 66);
    const s = '0x' + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    return { v, r, s, deadline };
  }, [address, chainId, walletClient]);


  // Submit gasless swap with permit (for ZTA/ZTB - 100% gasless)
  const submitSwapWithPermit = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes = 30 }) => {
    if (!address || !chainId || !routerAddress || !walletClient) {
      throw new Error('Not connected or chain not supported');
    }

    setIsLoading(true);
    setError(null);

    try {
      const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
      const nonce = await getNonce();

      // Step 1: Sign permit for token approval
      console.log('Step 1: Signing permit...');
      const permit = await signPermit(tokenIn, routerAddress, amountIn, deadline);

      // Step 2: Sign swap intent
      console.log('Step 2: Signing swap intent...');
      const intent = {
        user: address,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        deadline: deadline.toString(),
        nonce: nonce.toString(),
        chainId: chainId.toString()
      };

      const typedData = {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' }
          ],
          ...SWAP_INTENT_TYPES
        },
        primaryType: 'SwapIntent',
        domain: {
          name: 'ZeroTollRouter',
          version: '1',
          chainId: chainId,
          verifyingContract: routerAddress
        },
        message: intent
      };

      const signature = await walletClient.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)]
      });

      // Step 3: Submit to relayer
      console.log('Submitting to relayer...');
      const response = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId, intent, userSignature: signature, permit })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.details || 'Swap failed');

      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, routerAddress, walletClient, getNonce, signPermit]);

  // Check swap status
  const checkStatus = useCallback(async (requestId) => {
    const response = await fetch(`${RELAYER_URL}/api/intents/${requestId}/status`);
    return response.json();
  }, []);

  // Claim faucet tokens (requires gas - one time)
  const claimFaucet = useCallback(async (tokenAddress) => {
    if (!address || !walletClient) throw new Error('Not connected');
    
    const txHash = await walletClient.request({
      method: 'eth_sendTransaction',
      params: [{
        from: address,
        to: tokenAddress,
        data: '0xde5f72fd' // faucet() selector
      }]
    });
    
    return txHash;
  }, [address, walletClient]);

  return {
    // State
    isConnected,
    address,
    chainId,
    config,
    isLoading,
    error,
    
    // Checks
    isSupported,
    isGaslessToken,
    routerAddress,
    
    // Actions
    submitSwapWithPermit,
    checkStatus,
    getTokenBalance,
    claimFaucet,
    
    // Constants
    gaslessTokens: GASLESS_TOKENS[chainId] || {}
  };
}

export default useIntentGasless;
