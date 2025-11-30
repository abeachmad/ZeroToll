/**
 * useTrueGaslessSwap Hook - TRUE EIP-7702 Gasless Transactions
 * 
 * USER PAYS $0 IN GAS FEES!
 * 
 * This implementation uses the backend proxy approach that ACTUALLY WORKS.
 * The backend uses @metamask/smart-accounts-kit + Pimlico paymaster.
 * 
 * Flow:
 * 1. Frontend calls backend /api/gasless/prepare with calls
 * 2. Backend creates UserOp and returns hash to sign
 * 3. Frontend asks user to sign the hash via personal_sign (NO GAS POPUP!)
 * 4. Frontend sends signature to backend /api/gasless/submit
 * 5. Backend submits to Pimlico bundler - USER PAYS $0!
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseAbi } from 'viem';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
]);

const SMART_ACCOUNT_STATUS = {
  NOT_UPGRADED: 'NOT_UPGRADED',
  UPGRADED: 'UPGRADED',
  UNKNOWN: 'UNKNOWN',
  CHECKING: 'CHECKING'
};

// Backend API URL
const GASLESS_API_URL = process.env.REACT_APP_GASLESS_API_URL || 'http://localhost:3002';

const SUPPORTED_CHAINS = {
  80002: { 
    name: 'Polygon Amoy',
    explorer: 'https://amoy.polygonscan.com'
  },
  11155111: { 
    name: 'Ethereum Sepolia',
    explorer: 'https://sepolia.etherscan.io'
  },
};

export function useTrueGaslessSwap() {
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [userOpHash, setUserOpHash] = useState(null);
  const [smartAccountStatus, setSmartAccountStatus] = useState(SMART_ACCOUNT_STATUS.UNKNOWN);
  const [delegatorAddress, setDelegatorAddress] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check if the connected wallet has Smart Account enabled
   */
  const checkSmartAccountStatus = useCallback(async () => {
    if (!address || !publicClient) {
      return { 
        status: SMART_ACCOUNT_STATUS.UNKNOWN, 
        isSmartAccount: false, 
        delegatorAddress: null,
        message: 'Wallet not connected'
      };
    }

    try {
      setSmartAccountStatus(SMART_ACCOUNT_STATUS.CHECKING);
      
      // Check via backend API first (more reliable)
      try {
        const response = await fetch(`${GASLESS_API_URL}/api/gasless/check/${address}/${chain?.id || 80002}`);
        const data = await response.json();
        
        if (data.enabled) {
          setSmartAccountStatus(SMART_ACCOUNT_STATUS.UPGRADED);
          setDelegatorAddress(data.delegator);
          console.log('✅ Smart Account ENABLED via API');
          console.log('   Delegator:', data.delegator);
          return {
            status: SMART_ACCOUNT_STATUS.UPGRADED,
            isSmartAccount: true,
            delegatorAddress: data.delegator,
            message: 'Smart Account enabled - TRUE GASLESS available!'
          };
        }
      } catch (apiError) {
        console.log('Backend check failed, falling back to direct check:', apiError.message);
      }

      // Fallback: check directly
      const code = await publicClient.getCode({ address });
      
      if (code && code !== '0x' && code.startsWith('0xef0100')) {
        const delegator = '0x' + code.substring(8, 48);
        console.log('✅ Smart Account ENABLED');
        console.log('   Delegator:', delegator);
        
        setSmartAccountStatus(SMART_ACCOUNT_STATUS.UPGRADED);
        setDelegatorAddress(delegator);
        
        return { 
          status: SMART_ACCOUNT_STATUS.UPGRADED,
          isSmartAccount: true, 
          delegatorAddress: delegator,
          message: 'Smart Account enabled - TRUE GASLESS available!'
        };
      }
      
      console.log('❌ Smart Account NOT enabled');
      setSmartAccountStatus(SMART_ACCOUNT_STATUS.NOT_UPGRADED);
      setDelegatorAddress(null);
      
      return { 
        status: SMART_ACCOUNT_STATUS.NOT_UPGRADED,
        isSmartAccount: false, 
        delegatorAddress: null,
        message: 'Smart Account not enabled - upgrade required for gasless'
      };
    } catch (err) {
      console.error('Error checking smart account:', err);
      setSmartAccountStatus(SMART_ACCOUNT_STATUS.UNKNOWN);
      return { 
        status: SMART_ACCOUNT_STATUS.UNKNOWN,
        isSmartAccount: false, 
        delegatorAddress: null,
        message: `Error: ${err.message}`
      };
    }
  }, [address, publicClient, chain?.id]);

  useEffect(() => {
    if (address && publicClient) {
      checkSmartAccountStatus();
    }
  }, [address, publicClient, chain?.id, checkSmartAccountStatus]);

  /**
   * Execute a gasless swap using the backend proxy (WORKING APPROACH)
   */
  const executeGaslessSwap = useCallback(async ({ calls }) => {
    if (!address || !chain || !walletClient || !publicClient) {
      throw new Error('Wallet not connected');
    }

    if (!SUPPORTED_CHAINS[chain.id]) {
      throw new Error(`Chain ${chain.id} not supported for gasless`);
    }

    const accountStatus = await checkSmartAccountStatus();
    if (accountStatus.status !== SMART_ACCOUNT_STATUS.UPGRADED) {
      throw new Error('Smart Account not enabled. Please enable it in MetaMask settings first.');
    }

    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setStatus('preparing');
    setIsLoading(true);

    try {
      setStatusMessage('Preparing gasless transaction...');
      
      // Step 1: Call backend to prepare the UserOperation
      console.log('📡 Calling backend to prepare UserOp...');
      const prepareResponse = await fetch(`${GASLESS_API_URL}/api/gasless/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          chainId: chain.id,
          calls: calls.map(c => ({
            to: c.to,
            data: c.data || '0x',
            value: (c.value || 0n).toString()
          }))
        })
      });

      const prepareData = await prepareResponse.json();
      
      if (!prepareData.success) {
        throw new Error(prepareData.error || 'Failed to prepare transaction');
      }

      console.log('✅ UserOp prepared, opId:', prepareData.opId);

      setStatus('signing');
      setStatusMessage('Please sign the message in MetaMask (NO GAS!)...');

      // Step 2: Sign the typed data (EIP-712)
      // The backend provides the typed data structure for signing
      const { typedData } = prepareData;
      
      if (!typedData) {
        throw new Error('Backend did not provide typedData for signing');
      }

      console.log('   Signing EIP-712 typed data...');
      
      // Use signTypedData (EIP-712) - this is what MetaMask Smart Accounts expect
      // NO GAS POPUP - just a signature request!
      const signature = await walletClient.signTypedData({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message
      });
      
      console.log('   ✅ UserOp signed');
      
      setStatus('submitting');
      setStatusMessage('Submitting to bundler (you pay $0)...');

      // Step 3: Submit the signed UserOp to backend
      const submitResponse = await fetch(`${GASLESS_API_URL}/api/gasless/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opId: prepareData.opId,
          signature
        })
      });

      const submitData = await submitResponse.json();
      
      if (!submitData.success && submitData.error) {
        throw new Error(submitData.error);
      }

      setUserOpHash(submitData.userOpHash);
      setTxHash(submitData.txHash);
      
      if (submitData.success) {
        setStatus('success');
        setStatusMessage('🎉 GASLESS transaction successful! You paid $0 in gas!');
        console.log('🎉 GASLESS SUCCESS!');
        console.log('   TX Hash:', submitData.txHash);
        console.log('   Explorer:', submitData.explorerUrl);
      } else {
        setStatus('error');
        setError('Transaction failed on-chain');
        setStatusMessage('Transaction failed');
      }

      return {
        success: submitData.success,
        receipt: {
          transactionHash: submitData.txHash
        },
        userOpHash: submitData.userOpHash,
        explorerUrl: submitData.explorerUrl
      };

    } catch (err) {
      console.error('Gasless swap error:', err);
      
      let errorMessage = err.message;
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      }
      
      setError(errorMessage);
      setStatus('error');
      setStatusMessage(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, walletClient, publicClient, checkSmartAccountStatus]);

  /**
   * Execute a gasless ERC20 approval
   */
  const executeGaslessApproval = useCallback(async ({ tokenAddress, spender, amount }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return executeGaslessSwap({ calls: [{ to: tokenAddress, data: approveData, value: 0n }] });
  }, [executeGaslessSwap]);

  /**
   * Execute a gasless batch (approve + swap)
   */
  const executeGaslessBatch = useCallback(async ({ tokenAddress, spender, amount, routerHub, swapCallData }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return executeGaslessSwap({ 
      calls: [
        { to: tokenAddress, data: approveData, value: 0n },
        { to: routerHub, data: swapCallData, value: 0n }
      ] 
    });
  }, [executeGaslessSwap]);

  /**
   * Check if gasless is available for current wallet/chain
   */
  const checkAvailability = useCallback(async () => {
    if (!chain?.id || !SUPPORTED_CHAINS[chain.id]) {
      return { available: false, reason: `Chain ${chain?.id} not supported`, smartAccountStatus: SMART_ACCOUNT_STATUS.UNKNOWN };
    }
    if (!isConnected) {
      return { available: false, reason: 'Wallet not connected', smartAccountStatus: SMART_ACCOUNT_STATUS.UNKNOWN };
    }

    const accountStatus = await checkSmartAccountStatus();
    return { 
      available: accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED,
      chain: SUPPORTED_CHAINS[chain.id].name,
      chainId: chain.id,
      explorer: SUPPORTED_CHAINS[chain.id].explorer,
      smartAccountStatus: accountStatus.status,
      isSmartAccount: accountStatus.isSmartAccount,
      delegatorAddress: accountStatus.delegatorAddress,
      note: accountStatus.message,
      gasless: accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED,
      reason: accountStatus.status !== SMART_ACCOUNT_STATUS.UPGRADED ? 'Smart Account not enabled' : 'TRUE GASLESS available!'
    };
  }, [chain, isConnected, checkSmartAccountStatus]);

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setStatus(null);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setIsLoading(false);
  }, []);

  return {
    executeGaslessSwap,
    executeGaslessApproval,
    executeGaslessBatch,
    checkAvailability,
    checkSmartAccountStatus,
    reset,
    isLoading,
    status,
    statusMessage,
    error,
    txHash,
    userOpHash,
    smartAccountStatus,
    isSmartAccount: smartAccountStatus === SMART_ACCOUNT_STATUS.UPGRADED,
    needsUpgrade: smartAccountStatus === SMART_ACCOUNT_STATUS.NOT_UPGRADED,
    delegatorAddress,
    isPreparing: status === 'preparing',
    isSigning: status === 'signing',
    isSubmitting: status === 'submitting',
    isSubmitted: status === 'submitted',
    isSuccess: status === 'success',
    isError: status === 'error',
    currentChainId: chain?.id,
    supportedChains: SUPPORTED_CHAINS,
    SMART_ACCOUNT_STATUS,
  };
}

export { SMART_ACCOUNT_STATUS };
