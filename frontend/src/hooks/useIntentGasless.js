/**
 * useIntentGasless - Intent-based gasless swaps via ZeroToll
 * 
 * This hook enables TRUE gasless swaps where users pay ZERO gas.
 * Uses EIP-712 signatures + ZeroToll paymaster sponsorship.
 * 
 * Supports:
 * - zTokens (zUSDC, zETH, zPOL, zLINK): 100% gasless (ERC-2612 Permit built-in)
 * - WETH/USDC/LINK: Gasless via Permit2 (one-time approval to Permit2 contract)
 * - Other tokens: Traditional approve (user pays gas once)
 */
import { useState, useCallback, useEffect } from 'react';
import { useAccount, useChainId, useWalletClient } from 'wagmi';
import contractsConfig from '../config/contracts.json';
import sepoliaTokens from '../config/tokenlists/zerotoll.tokens.sepolia.json';
import amoyTokens from '../config/tokenlists/zerotoll.tokens.amoy.json';

// Relayer URL - Self-hosted paymaster (port 3002) using our VerifyingPaymasterV07.
// Some older env files still point to :3001 or :8000, so normalize those here.
const resolveRelayerUrl = () => {
  const candidates = [
    process.env.REACT_APP_RELAYER_URL,
    process.env.REACT_APP_GASLESS_API_URL,
    'http://localhost:3002',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate === 'http://localhost:3001') continue;
    if (candidate === 'http://localhost:8000') continue;
    return candidate;
  }

  return 'http://localhost:3002';
};

const RELAYER_URL = resolveRelayerUrl();
const NATIVE_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const normalizeSwapTokenAddress = (tokenAddress) => {
  if (!tokenAddress) return tokenAddress;
  if (tokenAddress === 'NATIVE') return NATIVE_MARKER;
  return tokenAddress;
};

const parseApiResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || json.details || json.detail || fallbackMessage);
    }
    return json;
  }

  const text = await response.text();
  const trimmed = text.trim();
  const snippet = trimmed ? trimmed.slice(0, 160) : '';

  if (!response.ok) {
    throw new Error(
      snippet
        ? `${fallbackMessage} (HTTP ${response.status}): ${snippet}`
        : `${fallbackMessage} (HTTP ${response.status})`
    );
  }

  throw new Error(
    snippet
      ? `Unexpected non-JSON response from relayer: ${snippet}`
      : 'Unexpected non-JSON response from relayer.'
  );
};

const parsePermit2AllowanceResult = (result) => {
  if (!result || result === '0x') {
    return { amount: 0n, expiration: 0, nonce: 0 };
  }

  const hex = result.startsWith('0x') ? result.slice(2) : result;
  if (hex.length < 64 * 3) {
    return { amount: 0n, expiration: 0, nonce: 0 };
  }

  return {
    amount: BigInt(`0x${hex.slice(0, 64)}`),
    expiration: parseInt(`0x${hex.slice(64, 128)}`, 16),
    nonce: parseInt(`0x${hex.slice(128, 192)}`, 16),
  };
};

const FRONTEND_CHAIN_CONFIG = {
  11155111: { key: 'sepolia', tokens: sepoliaTokens.tokens },
  80002: { key: 'amoy', tokens: amoyTokens.tokens },
};

const isConfiguredAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value || '');

const buildTokenAddressMap = (predicate) => Object.fromEntries(
  Object.entries(FRONTEND_CHAIN_CONFIG).map(([chainId, config]) => [
    chainId,
    Object.fromEntries(
      config.tokens
        .filter(predicate)
        .map((token) => [token.symbol, token.address])
    ),
  ])
);

const ZEROTOLL_ROUTERS = Object.fromEntries(
  Object.entries(FRONTEND_CHAIN_CONFIG)
    .map(([chainId, config]) => [
      chainId,
      contractsConfig[config.key]?.zeroTollRouterV3,
    ])
    .filter(([, address]) => isConfiguredAddress(address))
);

// Permit2 contract address (same on all chains)
const PERMIT2_ADDRESS = contractsConfig.permit2;

// ERC-2612 Permit tokens (fully gasless)
const ERC2612_TOKENS = buildTokenAddressMap(
  (token) => token.permitType === 'ERC2612'
);

// Permit2 supported tokens (gasless after one-time Permit2 approval)
const PERMIT2_TOKENS = buildTokenAddressMap(
  (token) => token.permitType === 'permit2' && !token.isNative
);

// Legacy gasless tokens (for backwards compatibility)
const GASLESS_TOKENS = ERC2612_TOKENS;

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
  const [feeEstimate, setFeeEstimate] = useState(null);

  // Check if current chain supports intent gasless
  const isSupported = chainId && ZEROTOLL_ROUTERS[chainId];
  const routerAddress = ZEROTOLL_ROUTERS[chainId];

  // Fetch fee estimate for a token
  const getFeeEstimate = useCallback(async (tokenAddress) => {
    if (!chainId || !tokenAddress) return null;
    try {
      const res = await fetch(`${RELAYER_URL}/api/fee-estimate/${chainId}/${tokenAddress}`);
      if (res.ok) {
        const data = await res.json();
        console.log('💰 Fee estimate:', data);
        setFeeEstimate(data);
        return data;
      }
    } catch (e) {
      console.log('Fee estimate failed:', e.message);
    }
    return null;
  }, [chainId]);

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

      return parsePermit2AllowanceResult(result);
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

    // Get token name using proper ABI decoding
    const nameData = await walletClient.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: '0x06fdde03' }, 'latest']
    });
    
    let tokenName = 'Token';
    try {
      // ABI decode string: skip 0x (2 chars) + offset (64 chars) + length (64 chars) = 130 chars
      // Then read the actual string bytes
      const lengthHex = nameData.slice(66, 130);
      const length = parseInt(lengthHex, 16);
      const hex = nameData.slice(130, 130 + length * 2);
      tokenName = hex.match(/.{2}/g).map(h => parseInt(h, 16)).filter(c => c > 0).map(c => String.fromCharCode(c)).join('');
      console.log('📝 Permit token name:', tokenName, 'for', tokenAddress);
    } catch (e) {
      console.warn('⚠️ Failed to parse token name, using default:', e);
    }

    // Get permit nonce
    const nonceData = `0x7ecebe00000000000000000000000000${address.slice(2)}`;
    const nonceResult = await walletClient.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: nonceData }, 'latest']
    });
    const permitNonce = parseInt(nonceResult, 16);
    console.log('📝 Permit nonce:', permitNonce, 'for', address);

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

    console.log('📝 Permit params:', {
      owner: address,
      spender,
      value: value.toString(),
      nonce: permitNonce,
      deadline,
      tokenName,
      chainId,
      chainIdType: typeof chainId,
      tokenAddress
    });

    const signature = await walletClient.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)]
    });

    console.log('📝 Raw permit signature:', signature);
    console.log('📝 Signature length:', signature.length);

    const r = signature.slice(0, 66);
    const s = '0x' + signature.slice(66, 130);
    let v = parseInt(signature.slice(130, 132), 16);
    
    // Normalize v value (some wallets return 0/1 instead of 27/28)
    if (v < 27) {
      v += 27;
    }

    console.log('📝 Permit signature components:', { 
      v, 
      r, 
      s,
      rLength: r.length,
      sLength: s.length
    });

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


  // Submit gasless swap with permit (for zTokens - 100% gasless)
  // Uses our self-hosted VerifyingPaymasterV07 paymaster
  const submitSwapWithPermit = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes = 30 }) => {
    if (!address || !chainId || !routerAddress || !walletClient) {
      throw new Error('Not connected or chain not supported');
    }

    setIsLoading(true);
    setError(null);

    try {
      const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
      const normalizedTokenOut = normalizeSwapTokenAddress(tokenOut);
      
      // Get nonce from relayer
      let nonce = 0;
      try {
        const res = await fetch(`${RELAYER_URL}/api/nonce/${chainId}/${address}`);
        const data = await res.json();
        nonce = parseInt(data.nonce || '0', 10);
      } catch {
        nonce = 0;
      }

      // Step 1: Sign permit for token approval
      console.log('Step 1: Signing permit...');
      const permit = await signPermit(tokenIn, routerAddress, amountIn, deadline);

      // Step 2: Sign swap intent
      console.log('Step 2: Signing swap intent...');
      const intent = {
        user: address,
        tokenIn,
        tokenOut: normalizedTokenOut,
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

      // Step 3: Submit to ZeroToll relayer (self-hosted paymaster)
      console.log('📤 Submitting to ZeroToll relayer...');
      console.log('📤 Permit being sent:', {
        v: permit.v,
        r: permit.r,
        s: permit.s,
        deadline: permit.deadline,
        rLength: permit.r?.length,
        sLength: permit.s?.length
      });
      const response = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId, intent, userSignature: signature, permit })
      });

      return await parseApiResponse(response, 'ZeroToll gasless swap failed');
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, routerAddress, walletClient, signPermit]);

  // Check swap status
  const checkStatus = useCallback(async (requestId) => {
    const response = await fetch(`${RELAYER_URL}/api/intents/${requestId}/status`);
    return parseApiResponse(response, 'Failed to fetch ZeroToll gasless status');
  }, []);

  // Submit gasless swap with Permit2 (for USDC, WETH, LINK, etc.)
  // Uses our self-hosted VerifyingPaymasterV07 paymaster
  const submitSwapWithPermit2 = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes = 30 }) => {
    if (!address || !chainId || !routerAddress || !walletClient) {
      throw new Error('Not connected or chain not supported');
    }

    setIsLoading(true);
    setError(null);

    try {
      const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
      const normalizedTokenOut = normalizeSwapTokenAddress(tokenOut);
      
      // Get nonce from relayer
      let nonce = 0;
      try {
        const res = await fetch(`${RELAYER_URL}/api/nonce/${chainId}/${address}`);
        const data = await res.json();
        nonce = parseInt(data.nonce || '0', 10);
      } catch {
        nonce = 0;
      }

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
        tokenOut: normalizedTokenOut,
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

      // Step 3: Submit to ZeroToll relayer (self-hosted paymaster)
      console.log('📤 Submitting to ZeroToll relayer...');
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

      return await parseApiResponse(response, 'ZeroToll Permit2 gasless swap failed');
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, routerAddress, walletClient, signPermit2]);

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
    feeEstimate,         // Fee estimate data from relayer
    
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
    getFeeEstimate,      // Get fee estimate for a token
    
    // Constants
    gaslessTokens: GASLESS_TOKENS[chainId] || {},
    erc2612Tokens: ERC2612_TOKENS[chainId] || {},
    permit2Tokens: PERMIT2_TOKENS[chainId] || {},
    permit2Address: PERMIT2_ADDRESS
  };
}

export default useIntentGasless;
