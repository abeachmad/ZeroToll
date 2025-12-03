/**
 * useIntentGasless - Intent-based gasless swaps via Pimlico
 * 
 * This hook enables TRUE gasless swaps where users pay ZERO gas.
 * Uses EIP-712 signatures + Pimlico paymaster sponsorship.
 * 
 * Supports:
 * - zTokens (zUSDC, zETH, zPOL, zLINK): 100% gasless (ERC-2612 Permit built-in)
 * - WETH/USDC/LINK: Gasless via Permit2 (one-time approval to Permit2 contract)
 * - Other tokens: Traditional approve (user pays gas once)
 */
import { useState, useCallback, useEffect } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';

const RELAYER_URL = process.env.REACT_APP_RELAYER_URL || 'http://localhost:3001';

// ZeroToll Router addresses per chain (updated Dec 3, 2025)
const ZEROTOLL_ROUTERS = {
  11155111: '0x3f260E97be2528D7568dE495F908e04BC8722ec5', // Sepolia
  80002: '0x8DABA829Fe6ACf7f3B9d98d52889beE5CcfEa3fD', // Amoy
};

// Permit2 contract address (same on all chains)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// ERC-2612 Permit tokens (fully gasless)
const ERC2612_TOKENS = {
  11155111: {
    zUSDC: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C',
    zETH: '0x8153FA09Be1689D44C343f119C829F6702A8720b',
    zPOL: '0x63c31C4247f6AA40B676478226d6FEB5707649D6',
    zLINK: '0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C',
  },
  80002: {
    zUSDC: '0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD',
    zETH: '0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9',
    zPOL: '0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d',
    zLINK: '0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1',
  }
};

// Permit2 supported tokens (gasless after one-time Permit2 approval)
const PERMIT2_TOKENS = {
  11155111: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    LINK: '0x779877A7B0D9E8603169DdBD7836e478b4624789',
  },
  80002: {
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
    LINK: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
  }
};

// Legacy gasless tokens (for backwards compatibility)
const GASLESS_TOKENS = {
  11155111: {
    ...ERC2612_TOKENS[11155111],
  },
  80002: {
    ...ERC2612_TOKENS[80002],
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

  // Check if token is gasless (ERC-2612) - legacy function
  const isGaslessToken = useCallback((tokenAddress) => {
    if (!chainId || !GASLESS_TOKENS[chainId]) return false;
    const tokens = Object.values(GASLESS_TOKENS[chainId]);
    return tokens.some(t => t.toLowerCase() === tokenAddress?.toLowerCase());
  }, [chainId]);

  // Get permit type for a token: 'erc2612' | 'permit2' | 'none'
  const getPermitType = useCallback((tokenAddress) => {
    if (!chainId || !tokenAddress) return 'none';
    
    // Check ERC-2612 tokens first (best experience)
    const erc2612Tokens = ERC2612_TOKENS[chainId] || {};
    if (Object.values(erc2612Tokens).some(t => t.toLowerCase() === tokenAddress.toLowerCase())) {
      return 'erc2612';
    }
    
    // Check Permit2 tokens
    const permit2Tokens = PERMIT2_TOKENS[chainId] || {};
    if (Object.values(permit2Tokens).some(t => t.toLowerCase() === tokenAddress.toLowerCase())) {
      return 'permit2';
    }
    
    return 'none';
  }, [chainId]);

  // Check if token supports ERC-2612 permit
  const isERC2612Token = useCallback((tokenAddress) => {
    return getPermitType(tokenAddress) === 'erc2612';
  }, [getPermitType]);

  // Check if token supports Permit2
  const isPermit2Token = useCallback((tokenAddress) => {
    return getPermitType(tokenAddress) === 'permit2';
  }, [getPermitType]);

  // Check Permit2 allowance for a token
  const getPermit2Allowance = useCallback(async (tokenAddress, spender) => {
    if (!address || !walletClient) return { amount: BigInt(0), expiration: 0, nonce: 0 };
    
    try {
      // allowance(address user, address token, address spender) returns (uint160 amount, uint48 expiration, uint48 nonce)
      const userHex = address.slice(2).toLowerCase().padStart(64, '0');
      const tokenHex = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
      const spenderHex = spender.slice(2).toLowerCase().padStart(64, '0');
      const data = `0x927da105${userHex}${tokenHex}${spenderHex}`; // allowance selector
      
      const result = await walletClient.request({
        method: 'eth_call',
        params: [{ to: PERMIT2_ADDRESS, data }, 'latest']
      });
      
      // Decode result: amount (uint160), expiration (uint48), nonce (uint48)
      const amount = BigInt('0x' + result.slice(2, 42));
      const expiration = parseInt('0x' + result.slice(42, 54), 16);
      const nonce = parseInt('0x' + result.slice(54, 66), 16);
      
      return { amount, expiration, nonce };
    } catch (e) {
      console.error('Error getting Permit2 allowance:', e);
      return { amount: BigInt(0), expiration: 0, nonce: 0 };
    }
  }, [address, walletClient]);

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

  // Sign Permit2 PermitSingle
  const signPermit2 = useCallback(async (tokenAddress, spender, amount, deadline) => {
    if (!address || !chainId || !walletClient) throw new Error('Not connected');

    // Get Permit2 nonce for this token/spender
    const { nonce } = await getPermit2Allowance(tokenAddress, spender);

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        PermitSingle: [
          { name: 'details', type: 'PermitDetails' },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' }
        ],
        PermitDetails: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' }
        ]
      },
      primaryType: 'PermitSingle',
      domain: {
        name: 'Permit2',
        chainId: chainId,
        verifyingContract: PERMIT2_ADDRESS
      },
      message: {
        details: {
          token: tokenAddress,
          amount: amount.toString(),
          expiration: deadline.toString(),
          nonce: nonce.toString()
        },
        spender: spender,
        sigDeadline: deadline.toString()
      }
    };

    const signature = await walletClient.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)]
    });

    return {
      permitSingle: typedData.message,
      signature
    };
  }, [address, chainId, walletClient, getPermit2Allowance]);


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

  // Submit gasless swap with Permit2 (for USDC, WETH, LINK, etc.)
  const submitSwapWithPermit2 = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes = 30 }) => {
    if (!address || !chainId || !routerAddress || !walletClient) {
      throw new Error('Not connected or chain not supported');
    }

    setIsLoading(true);
    setError(null);

    try {
      const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
      const nonce = await getNonce();

      // Step 1: Sign Permit2 for token approval
      console.log('Step 1: Signing Permit2...');
      const { permitSingle, signature: permit2Signature } = await signPermit2(
        tokenIn, 
        routerAddress, 
        amountIn, 
        deadline
      );

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

      const userSignature = await walletClient.request({
        method: 'eth_signTypedData_v4',
        params: [address, JSON.stringify(typedData)]
      });

      // Step 3: Submit to relayer
      console.log('Submitting to relayer...');
      const response = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chainId, 
          intent, 
          userSignature, 
          permitSingle, 
          permit2Signature 
        })
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
  }, [address, chainId, routerAddress, walletClient, getNonce, signPermit2]);

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
    isGaslessToken,      // Legacy: checks ERC-2612 tokens
    isERC2612Token,      // New: checks ERC-2612 tokens
    isPermit2Token,      // New: checks Permit2 tokens
    getPermitType,       // New: returns 'erc2612' | 'permit2' | 'none'
    routerAddress,
    
    // Actions
    submitSwapWithPermit,   // For ERC-2612 tokens
    submitSwapWithPermit2,  // For Permit2 tokens
    checkStatus,
    getTokenBalance,
    getPermit2Allowance,    // New: check Permit2 allowance
    claimFaucet,
    
    // Constants
    gaslessTokens: GASLESS_TOKENS[chainId] || {},
    erc2612Tokens: ERC2612_TOKENS[chainId] || {},
    permit2Tokens: PERMIT2_TOKENS[chainId] || {},
    permit2Address: PERMIT2_ADDRESS
  };
}

export default useIntentGasless;
