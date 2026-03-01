/**
 * useGaslessSwap - Hook for gasless swaps via intent signing
 * 
 * Uses ZeroTollRouter contract (Solution.md architecture)
 * User signs EIP-712 SwapIntent, relayer submits executeSwap
 */
import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Permit2 address (same on all chains)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// EIP-712 types for SwapIntent (matches ZeroTollRouter.sol)
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

export function useGaslessSwap() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      if (!window.ethereum) throw new Error('MetaMask not installed');

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdNum = parseInt(chainIdHex, 16);

      setAccount(accounts[0]);
      setChainId(chainIdNum);
      setIsConnected(true);

      try {
        const res = await fetch(`${API_URL}/api/config/${chainIdNum}`);
        if (res.ok) setConfig(await res.json());
      } catch (e) {
        console.warn('Could not fetch config:', e);
      }

      window.ethereum.on('accountsChanged', (newAccounts) => {
        if (newAccounts.length > 0) setAccount(newAccounts[0]);
        else disconnect();
      });

      window.ethereum.on('chainChanged', (hex) => {
        const newChainId = parseInt(hex, 16);
        setChainId(newChainId);
        fetch(`${API_URL}/api/config/${newChainId}`)
          .then(r => r.ok ? r.json() : null)
          .then(cfg => cfg && setConfig(cfg))
          .catch(() => {});
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAccount('');
    setChainId(null);
    setIsConnected(false);
    setConfig(null);
  }, []);

  const getNonce = useCallback(async () => {
    if (!account || !chainId) return 0;
    try {
      const res = await fetch(`${API_URL}/api/nonce/${chainId}/${account}`);
      const data = await res.json();
      return parseInt(data.nonce || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  }, [account, chainId]);

  // Check token allowance
  const checkAllowance = useCallback(async (tokenAddress) => {
    if (!account || !chainId || !config) return BigInt(0);
    
    try {
      const data = `0xdd62ed3e000000000000000000000000${account.slice(2)}000000000000000000000000${config.routerAddress.slice(2)}`;
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data }, 'latest']
      });
      return BigInt(result);
    } catch (e) {
      return BigInt(0);
    }
  }, [account, chainId, config]);

  // Approve token spending
  const approveToken = useCallback(async (tokenAddress, amount) => {
    if (!account || !config) throw new Error('Not connected');
    
    // Encode approve(spender, amount)
    const amountHex = BigInt(amount).toString(16).padStart(64, '0');
    const spenderHex = config.routerAddress.slice(2).toLowerCase().padStart(64, '0');
    const data = `0x095ea7b3${spenderHex}${amountHex}`;
    
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: account,
        to: tokenAddress,
        data
      }]
    });
    
    console.log('Approval tx:', txHash);
    return txHash;
  }, [account, config]);

  const submitSwap = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes = 30 }) => {
    if (!account || !chainId || !config) throw new Error('Not connected');

    // Check allowance first
    const allowance = await checkAllowance(tokenIn);
    const amountBigInt = BigInt(amountIn);
    
    if (allowance < amountBigInt) {
      throw new Error(`Insufficient allowance. Please approve ${config.routerAddress} to spend your tokens first. Current allowance: ${allowance}, needed: ${amountBigInt}`);
    }

    const nonce = await getNonce();
    const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

    const intent = {
      user: account,
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
        verifyingContract: config.routerAddress
      },
      message: intent
    };

    console.log('Signing intent:', typedData);

    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [account, JSON.stringify(typedData)]
    });

    console.log('Signature:', signature);

    const response = await fetch(`${API_URL}/api/intents/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId, intent, userSignature: signature })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.details || 'Failed');

    return result;
  }, [account, chainId, config, getNonce]);

  const checkStatus = useCallback(async (requestId) => {
    const response = await fetch(`${API_URL}/api/intents/${requestId}/status`);
    return response.json();
  }, []);

  // Sign ERC-2612 Permit for gasless approval
  const signPermit = useCallback(async (tokenAddress, spender, value, deadline) => {
    if (!account || !chainId) throw new Error('Not connected');

    // Get token name and nonce for permit
    const nameData = await window.ethereum.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: '0x06fdde03' }, 'latest'] // name()
    });
    
    // Decode name (skip first 64 chars for offset and length)
    let tokenName = 'Token';
    try {
      const hex = nameData.slice(130); // Skip 0x + offset + length
      tokenName = hex.match(/.{2}/g).map(h => parseInt(h, 16)).filter(c => c > 0).map(c => String.fromCharCode(c)).join('');
    } catch (e) {
      console.warn('Could not decode token name');
    }

    // Get permit nonce
    const nonceData = `0x7ecebe00000000000000000000000000${account.slice(2)}`;
    const nonceResult = await window.ethereum.request({
      method: 'eth_call',
      params: [{ to: tokenAddress, data: nonceData }, 'latest']
    });
    const permitNonce = parseInt(nonceResult, 16);

    const permitDomain = {
      name: tokenName,
      version: '1',
      chainId: chainId,
      verifyingContract: tokenAddress
    };

    const permitTypes = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    const permitMessage = {
      owner: account,
      spender,
      value: value.toString(),
      nonce: permitNonce.toString(),
      deadline: deadline.toString()
    };

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        ...permitTypes
      },
      primaryType: 'Permit',
      domain: permitDomain,
      message: permitMessage
    };

    console.log('Signing permit:', typedData);

    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [account, JSON.stringify(typedData)]
    });

    // Split signature into v, r, s
    const r = signature.slice(0, 66);
    const s = '0x' + signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    return { v, r, s, deadline };
  }, [account, chainId]);

  // Fully gasless swap with permit
  const submitSwapWithPermit = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes = 30 }) => {
    if (!account || !chainId || !config) throw new Error('Not connected');

    const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);
    const nonce = await getNonce();

    // 1. Sign permit for token approval
    console.log('Step 1: Signing permit...');
    const permit = await signPermit(tokenIn, config.routerAddress, amountIn, deadline);
    console.log('Permit signed:', permit);

    // 2. Sign swap intent
    console.log('Step 2: Signing swap intent...');
    const intent = {
      user: account,
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
        verifyingContract: config.routerAddress
      },
      message: intent
    };

    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [account, JSON.stringify(typedData)]
    });

    console.log('Swap intent signed, submitting to relayer...');

    // 3. Submit to relayer
    const response = await fetch(`${API_URL}/api/intents/swap-with-permit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId, intent, userSignature: signature, permit })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.details || 'Failed');

    return result;
  }, [account, chainId, config, getNonce, signPermit]);

  // Check Permit2 allowance for token
  const checkPermit2Allowance = useCallback(async (tokenAddress) => {
    if (!account) return BigInt(0);
    
    try {
      // allowance(address,address,address) returns (uint160,uint48,uint48)
      const ownerHex = account.slice(2).toLowerCase().padStart(64, '0');
      const tokenHex = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
      const spenderHex = (config?.routerAddress || '0x0000000000000000000000000000000000000000').slice(2).toLowerCase().padStart(64, '0');
      const data = `0x927da105${ownerHex}${tokenHex}${spenderHex}`;
      
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: PERMIT2_ADDRESS, data }, 'latest']
      });
      
      // First 32 bytes is amount (uint160)
      return BigInt('0x' + result.slice(2, 66));
    } catch (e) {
      return BigInt(0);
    }
  }, [account, config]);

  // Approve token to Permit2 (one-time, then gasless forever)
  const approveToPermit2 = useCallback(async (tokenAddress) => {
    if (!account) throw new Error('Not connected');
    
    // Approve max to Permit2
    const maxAmount = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const spenderHex = PERMIT2_ADDRESS.slice(2).toLowerCase().padStart(64, '0');
    const data = `0x095ea7b3${spenderHex}${maxAmount}`;
    
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: tokenAddress, data }]
    });
    
    console.log('Permit2 approval tx:', txHash);
    return txHash;
  }, [account]);

  // Get Permit2 nonce for token
  const getPermit2Nonce = useCallback(async (tokenAddress) => {
    if (!account || !config) return 0;
    
    try {
      const ownerHex = account.slice(2).toLowerCase().padStart(64, '0');
      const tokenHex = tokenAddress.slice(2).toLowerCase().padStart(64, '0');
      const spenderHex = config.routerAddress.slice(2).toLowerCase().padStart(64, '0');
      const data = `0x927da105${ownerHex}${tokenHex}${spenderHex}`;
      
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: PERMIT2_ADDRESS, data }, 'latest']
      });
      
      // Third 32 bytes is nonce (uint48)
      return parseInt(result.slice(130, 194), 16);
    } catch (e) {
      return 0;
    }
  }, [account, config]);

  // Sign Permit2 signature for gasless approval
  const signPermit2 = useCallback(async (tokenAddress, amount, deadlineSeconds) => {
    if (!account || !chainId || !config) throw new Error('Not connected');

    const permit2Nonce = await getPermit2Nonce(tokenAddress);
    const expiration = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days
    const sigDeadline = Math.floor(Date.now() / 1000) + deadlineSeconds;

    const permit2Domain = {
      name: 'Permit2',
      chainId: chainId,
      verifyingContract: PERMIT2_ADDRESS
    };

    const permit2Types = {
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
    };

    const permitSingle = {
      details: {
        token: tokenAddress,
        amount: amount.toString(),
        expiration: expiration.toString(),
        nonce: permit2Nonce.toString()
      },
      spender: config.routerAddress,
      sigDeadline: sigDeadline.toString()
    };

    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' }
        ],
        ...permit2Types
      },
      primaryType: 'PermitSingle',
      domain: permit2Domain,
      message: permitSingle
    };

    console.log('Signing Permit2:', typedData);

    const signature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [account, JSON.stringify(typedData)]
    });

    return { permitSingle, signature };
  }, [account, chainId, config, getPermit2Nonce]);

  // Fully gasless swap with Permit2 (works with ANY ERC-20)
  const submitSwapWithPermit2 = useCallback(async ({ tokenIn, tokenOut, amountIn, minAmountOut, deadlineMinutes = 30 }) => {
    if (!account || !chainId || !config) throw new Error('Not connected');

    const deadlineSeconds = deadlineMinutes * 60;
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;
    const nonce = await getNonce();

    // 1. Sign Permit2 for gasless approval
    console.log('Step 1: Signing Permit2...');
    const { permitSingle, signature: permit2Signature } = await signPermit2(tokenIn, amountIn, deadlineSeconds);
    console.log('Permit2 signed');

    // 2. Sign swap intent
    console.log('Step 2: Signing swap intent...');
    const intent = {
      user: account,
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
        verifyingContract: config.routerAddress
      },
      message: intent
    };

    const swapSignature = await window.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [account, JSON.stringify(typedData)]
    });

    console.log('Submitting to relayer...');

    // 3. Submit to relayer
    const response = await fetch(`${API_URL}/api/intents/swap-with-permit2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chainId, 
        intent, 
        userSignature: swapSignature, 
        permitSingle,
        permit2Signature 
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.details || 'Failed');

    return result;
  }, [account, chainId, config, getNonce, signPermit2]);

  // Get free test tokens from faucet (requires gas)
  const claimFaucet = useCallback(async (tokenAddress) => {
    if (!account) throw new Error('Not connected');
    
    // Call faucet() function - gives 1000 tokens
    const data = '0xde5f72fd'; // faucet() selector
    
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from: account, to: tokenAddress, data }]
    });
    
    return txHash;
  }, [account]);

  // Get token balance
  const getTokenBalance = useCallback(async (tokenAddress) => {
    if (!account) return BigInt(0);
    
    const ownerHex = account.slice(2).toLowerCase().padStart(64, '0');
    const data = `0x70a08231${ownerHex}`; // balanceOf(address)
    
    try {
      const result = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: tokenAddress, data }, 'latest']
      });
      return BigInt(result);
    } catch (e) {
      return BigInt(0);
    }
  }, [account]);

  return {
    account, chainId, isConnected, isConnecting, error, config,
    isSupportedChain: chainId === 11155111 || chainId === 80002,
    connect, disconnect, getNonce, submitSwap, submitSwapWithPermit, submitSwapWithPermit2, checkStatus,
    checkAllowance, approveToken, signPermit, checkPermit2Allowance, approveToPermit2, signPermit2,
    claimFaucet, getTokenBalance
  };
}
