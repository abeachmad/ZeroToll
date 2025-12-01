/**
 * useGaslessSwap Hook - MetaMask Extension EIP-7702 Support
 * 
 * Based on MetaMask's official live coding session and EIP-7702 spec.
 * 
 * FLOW:
 * 1. Check if EOA is already upgraded (has code starting with 0xef0100)
 * 2. If ALREADY upgraded: Execute via useSendCalls (truly gasless!)
 * 3. If NOT upgraded: useSendCalls triggers MetaMask's upgrade prompt
 *    - First upgrade costs ~21k gas (user pays once)
 *    - After upgrade, transactions are gasless
 * 
 * KEY INSIGHT: After EIP-7702 upgrade, smart account address = EOA address (same address!)
 * 
 * SMART ACCOUNT STATUS:
 * - NOT_UPGRADED: EOA has no code, needs upgrade (first tx costs gas)
 * - UPGRADED: EOA has 0xef0100 prefix, ready for gasless
 * - UNKNOWN: Could not determine status
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi';
import { useSendCalls, useCallsStatus, useCapabilities } from 'wagmi/experimental';
import { encodeFunctionData, parseAbi } from 'viem';

// ERC20 ABI for approve
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)'
]);

// Smart Account Status enum
const SMART_ACCOUNT_STATUS = {
  NOT_UPGRADED: 'NOT_UPGRADED',
  UPGRADED: 'UPGRADED',
  UNKNOWN: 'UNKNOWN',
  CHECKING: 'CHECKING'
};

// Pimlico API Key for paymaster
const PIMLICO_API_KEY = process.env.REACT_APP_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Supported chains for EIP-7702
const SUPPORTED_CHAINS = {
  80002: { 
    name: 'Polygon Amoy',
    delegator: '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B', // MetaMask Stateless Delegator
    explorer: 'https://amoy.polygonscan.com',
    paymasterUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`
  },
  11155111: { 
    name: 'Ethereum Sepolia',
    delegator: '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B', // MetaMask Stateless Delegator
    explorer: 'https://sepolia.etherscan.io',
    paymasterUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`
  },
};

export function useGaslessSwap() {
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();
  
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [smartAccountStatus, setSmartAccountStatus] = useState(SMART_ACCOUNT_STATUS.UNKNOWN);
  const [delegatorAddress, setDelegatorAddress] = useState(null);

  // Wagmi's useSendCalls hook (EIP-5792)
  const { 
    sendCallsAsync,
    data: callsId, 
    isPending: isLoading,
    isError: isSendError,
    error: sendError,
    reset: resetSendCalls
  } = useSendCalls();

  // Check wallet capabilities (EIP-5792)
  const { data: walletCapabilities } = useCapabilities();

  // Track submission time for timeout
  const [submissionTime, setSubmissionTime] = useState(null);
  const TIMEOUT_MS = 120000; // 2 minutes timeout

  // Track call status using getCallsStatus (EIP-5792)
  const { 
    data: callsStatus,
    isLoading: isStatusLoading,
    error: callsStatusError
  } = useCallsStatus({
    id: callsId,
    query: { 
      enabled: !!callsId,
      refetchInterval: (data) => {
        // Stop polling if confirmed or failed
        if (data?.status === 'CONFIRMED' || data?.status === 'FAILED') return false;
        // Stop polling after timeout
        if (submissionTime && Date.now() - submissionTime > TIMEOUT_MS) {
          console.warn('⏰ Transaction status polling timed out');
          return false;
        }
        return 2000;
      }
    }
  });

  // Handle timeout
  useEffect(() => {
    if (submissionTime && status === 'submitted') {
      const timeoutId = setTimeout(() => {
        if (status === 'submitted' || status === 'pending') {
          console.error('⏰ Transaction timed out - check MetaMask for status');
          setStatus('error');
          setError('Transaction timed out. Please check MetaMask activity for the actual status.');
          setStatusMessage('Transaction timed out. Check MetaMask for status.');
        }
      }, TIMEOUT_MS);
      return () => clearTimeout(timeoutId);
    }
  }, [submissionTime, status]);

  // Handle callsStatus errors
  useEffect(() => {
    if (callsStatusError) {
      console.error('❌ Error fetching call status:', callsStatusError);
      setStatus('error');
      setError(callsStatusError.message || 'Failed to get transaction status');
      setStatusMessage('Failed to get transaction status. Check MetaMask.');
    }
  }, [callsStatusError]);

  /**
   * Check if EOA is already upgraded to smart account
   * EIP-7702 sets code to: 0xef0100 + delegator_address (20 bytes)
   * 
   * Returns:
   * - UPGRADED: EOA has smart account code, ready for gasless
   * - NOT_UPGRADED: EOA is regular, needs upgrade (first tx costs gas)
   * - UNKNOWN: Could not determine
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
      const code = await publicClient.getCode({ address });
      
      // EIP-7702 code format: 0xef0100 + 20-byte address (46 chars total with 0x)
      if (code && code !== '0x' && code.startsWith('0xef0100')) {
        const delegator = '0x' + code.substring(8, 48);
        console.log('✅ EOA is already upgraded to Smart Account!');
        console.log('   Delegator:', delegator);
        console.log('   Code:', code);
        
        return { 
          status: SMART_ACCOUNT_STATUS.UPGRADED,
          isSmartAccount: true, 
          delegatorAddress: delegator,
          message: 'Smart Account enabled - transactions will be gasless!'
        };
      }
      
      console.log('📭 EOA is NOT upgraded (code:', code, ')');
      console.log('   First transaction will prompt for Smart Account upgrade');
      
      return { 
        status: SMART_ACCOUNT_STATUS.NOT_UPGRADED,
        isSmartAccount: false, 
        delegatorAddress: null,
        message: 'Smart Account not enabled - first transaction will prompt for upgrade (~21k gas)'
      };
    } catch (err) {
      console.error('Error checking smart account status:', err);
      return { 
        status: SMART_ACCOUNT_STATUS.UNKNOWN,
        isSmartAccount: false, 
        delegatorAddress: null,
        message: `Could not check status: ${err.message}`
      };
    }
  }, [address, publicClient]);

  // Check smart account status when address or chain changes
  useEffect(() => {
    const checkStatus = async () => {
      if (address && publicClient) {
        const result = await checkSmartAccountStatus();
        setSmartAccountStatus(result.status);
        setDelegatorAddress(result.delegatorAddress);
      } else {
        setSmartAccountStatus(SMART_ACCOUNT_STATUS.UNKNOWN);
        setDelegatorAddress(null);
      }
    };
    checkStatus();
  }, [address, publicClient, chain?.id, checkSmartAccountStatus]);

  // Update status based on callsStatus
  useEffect(() => {
    if (!callsStatus) return;

    console.log('📊 Calls status update:', JSON.stringify(callsStatus, null, 2));

    // Handle different status formats from MetaMask
    const statusStr = callsStatus.status?.toUpperCase?.() || callsStatus.status;

    if (statusStr === 'CONFIRMED' || statusStr === 'COMPLETE') {
      if (callsStatus.receipts?.length > 0) {
        const receipt = callsStatus.receipts[0];
        setTxHash(receipt.transactionHash || receipt.hash);
        
        // Check if transaction actually succeeded (status = 1) or failed (status = 0)
        const txStatus = receipt.status;
        const isSuccess = txStatus === 'success' || txStatus === 1 || txStatus === '0x1' || txStatus === true;
        const isFailed = txStatus === 'reverted' || txStatus === 0 || txStatus === '0x0' || txStatus === false;

        if (isFailed) {
          console.error('❌ Transaction reverted:', receipt);
          setStatus('error');
          setError('Transaction failed (reverted on-chain). Check MetaMask activity.');
          setStatusMessage('Transaction failed! The contract call reverted.');
          return;
        }

        if (isSuccess) {
          setStatus('success');
          setStatusMessage('Transaction confirmed!');
          
          // Re-check smart account status after transaction (may have been upgraded)
          checkSmartAccountStatus().then(result => {
            setSmartAccountStatus(result.status);
            setDelegatorAddress(result.delegatorAddress);
            
            if (result.status === SMART_ACCOUNT_STATUS.UPGRADED) {
              console.log('🎉 Smart Account is now active! Future transactions will be batched.');
            }
          });
        } else {
          // Unknown status, treat as success but log warning
          console.warn('⚠️ Unknown transaction status:', txStatus);
          setStatus('success');
          setStatusMessage('Transaction confirmed (status unknown)');
        }
      } else {
        // No receipts but status is CONFIRMED - might be a MetaMask quirk
        console.warn('⚠️ CONFIRMED but no receipts:', callsStatus);
        setStatus('success');
        setStatusMessage('Transaction confirmed!');
      }
    } else if (statusStr === 'PENDING') {
      setStatus('pending');
      setStatusMessage('Transaction pending...');
    } else if (statusStr === 'FAILED' || statusStr === 'REVERTED' || statusStr === 'ERROR') {
      // Some implementations return FAILED status directly
      console.error('❌ Transaction failed:', callsStatus);
      setStatus('error');
      setError('Transaction failed. Check MetaMask activity for details.');
      setStatusMessage('Transaction failed!');
    }
  }, [callsStatus, checkSmartAccountStatus]);

  // Handle send errors
  useEffect(() => {
    if (isSendError && sendError) {
      setError(sendError.message);
      setStatus('error');
      setStatusMessage(sendError.message);
    }
  }, [isSendError, sendError]);

  /**
   * Check if EIP-7702 gasless is available and what the current status is
   */
  const checkAvailability = useCallback(async () => {
    if (!chain?.id || !SUPPORTED_CHAINS[chain.id]) {
      return { 
        available: false, 
        reason: `Chain ${chain?.id} not supported. Use Sepolia (11155111) or Amoy (80002)`,
        smartAccountStatus: SMART_ACCOUNT_STATUS.UNKNOWN
      };
    }

    if (!isConnected) {
      return { 
        available: false, 
        reason: 'Wallet not connected',
        smartAccountStatus: SMART_ACCOUNT_STATUS.UNKNOWN
      };
    }

    // Check current smart account status
    const accountStatus = await checkSmartAccountStatus();
    
    // Check wallet capabilities for atomic batch support
    const chainCaps = walletCapabilities?.[chain.id];
    const supportsAtomicBatch = chainCaps?.atomicBatch?.supported;

    return { 
      available: true, 
      chain: SUPPORTED_CHAINS[chain.id].name,
      chainId: chain.id,
      explorer: SUPPORTED_CHAINS[chain.id].explorer,
      smartAccountStatus: accountStatus.status,
      isSmartAccount: accountStatus.isSmartAccount,
      delegatorAddress: accountStatus.delegatorAddress,
      supportsAtomicBatch,
      note: accountStatus.message,
      // Detailed status for UI
      statusDetails: {
        isUpgraded: accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED,
        needsUpgrade: accountStatus.status === SMART_ACCOUNT_STATUS.NOT_UPGRADED,
        upgradeGasCost: '~21,000 gas (one-time)',
        afterUpgrade: 'Transactions will be batched and potentially gasless'
      }
    };
  }, [chain, isConnected, checkSmartAccountStatus, walletCapabilities]);

  /**
   * Ensure we're on the correct chain
   */
  const ensureCorrectChain = useCallback(async (targetChainId) => {
    if (!chain || chain.id === targetChainId) return true;
    
    try {
      setStatusMessage(`Switching to ${SUPPORTED_CHAINS[targetChainId]?.name || 'target chain'}...`);
      await switchChainAsync({ chainId: targetChainId });
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    } catch (err) {
      console.error('Chain switch failed:', err);
      throw new Error(`Please switch to ${SUPPORTED_CHAINS[targetChainId]?.name || 'the correct network'} in MetaMask`);
    }
  }, [chain, switchChainAsync]);

  /**
   * Execute swap using useSendCalls (EIP-5792)
   * 
   * If EOA is already upgraded: Executes directly via smart account (gasless!)
   * If EOA is NOT upgraded: MetaMask prompts for upgrade first (~21k gas)
   */
  const executeSwap = useCallback(async ({ routerHub, swapCallData, targetChainId }) => {
    if (!address || !chain) {
      throw new Error('Wallet not connected');
    }

    const chainId = targetChainId || chain.id;
    
    if (!SUPPORTED_CHAINS[chainId]) {
      throw new Error(`Chain ${chainId} not supported. Use Sepolia or Amoy.`);
    }

    setError(null);
    setTxHash(null);
    setStatus('preparing');

    try {
      // Ensure correct chain
      await ensureCorrectChain(chainId);

      // Check if already upgraded
      const accountStatus = await checkSmartAccountStatus();
      
      if (accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED) {
        setStatusMessage('✅ Smart Account active - executing gasless swap...');
        console.log('📤 EOA already upgraded, executing via Smart Account');
        console.log('   Delegator:', accountStatus.delegatorAddress);
      } else if (accountStatus.status === SMART_ACCOUNT_STATUS.NOT_UPGRADED) {
        setStatusMessage('⚡ First time: MetaMask will prompt to enable Smart Account...');
        console.log('📤 EOA not upgraded - MetaMask will show upgrade prompt');
        console.log('   Note: First transaction costs ~21k gas for upgrade');
      } else {
        setStatusMessage('Preparing transaction...');
        console.log('📤 Smart account status unknown, proceeding anyway');
      }

      const calls = [{
        to: routerHub,
        data: swapCallData,
        value: 0n
      }];

      console.log('📤 Sending via useSendCalls (EIP-5792)');
      console.log('   Chain:', chainId);
      console.log('   To:', routerHub);
      console.log('   Smart Account Status:', accountStatus.status);
      console.log('   Paymaster URL:', SUPPORTED_CHAINS[chainId].paymasterUrl);

      setStatus('signing');
      setStatusMessage('Please confirm in MetaMask...');

      // Try with paymasterService capability (may be ignored by MetaMask)
      const result = await sendCallsAsync({ 
        calls,
        chainId,
        capabilities: {
          paymasterService: {
            url: SUPPORTED_CHAINS[chainId].paymasterUrl
          }
        }
      });

      console.log('✅ Calls submitted, ID:', result);
      setStatus('submitted');
      setSubmissionTime(Date.now()); // Track when we submitted for timeout
      setStatusMessage('Transaction submitted, waiting for confirmation (max 2 min)...');

      return result;

    } catch (err) {
      console.error('Swap error:', err);
      
      // Provide helpful error messages
      let errorMessage = err.message;
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('Chain ID')) {
        errorMessage = 'Please switch to the correct network in MetaMask';
      }
      
      setError(errorMessage);
      setStatus('error');
      setStatusMessage(errorMessage);
      throw err;
    }
  }, [address, chain, sendCallsAsync, ensureCorrectChain, checkSmartAccountStatus]);

  /**
   * Execute approval using useSendCalls (EIP-5792)
   */
  const executeApproval = useCallback(async ({ tokenAddress, spender, amount, targetChainId }) => {
    if (!address || !chain) {
      throw new Error('Wallet not connected');
    }

    if (!tokenAddress || !spender) {
      throw new Error('Token address and spender are required');
    }

    const chainId = targetChainId || chain.id;

    if (!SUPPORTED_CHAINS[chainId]) {
      throw new Error(`Chain ${chainId} not supported. Use Sepolia or Amoy.`);
    }

    setError(null);
    setTxHash(null);
    setStatus('approving');

    try {
      await ensureCorrectChain(chainId);

      const accountStatus = await checkSmartAccountStatus();
      
      if (accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED) {
        setStatusMessage('✅ Executing approval via Smart Account...');
      } else if (accountStatus.status === SMART_ACCOUNT_STATUS.NOT_UPGRADED) {
        setStatusMessage('⚡ First time: MetaMask will prompt to enable Smart Account...');
      } else {
        setStatusMessage('Preparing approval...');
      }

      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, BigInt(amount)]
      });

      const calls = [{
        to: tokenAddress,
        data: approveData,
        value: 0n
      }];

      console.log('📤 Sending approval via useSendCalls (EIP-5792)');
      console.log('   Smart Account Status:', accountStatus.status);
      console.log('   Paymaster URL:', SUPPORTED_CHAINS[chainId].paymasterUrl);

      setStatus('signing');
      setStatusMessage('Please confirm approval in MetaMask...');

      // Try with paymasterService capability (may be ignored by MetaMask)
      const result = await sendCallsAsync({ 
        calls,
        chainId,
        capabilities: {
          paymasterService: {
            url: SUPPORTED_CHAINS[chainId].paymasterUrl
          }
        }
      });

      console.log('✅ Approval submitted, ID:', result);
      setStatus('submitted');
      setSubmissionTime(Date.now());
      setStatusMessage('Approval submitted, waiting for confirmation (max 2 min)...');

      return result;

    } catch (err) {
      console.error('Approval error:', err);
      
      let errorMessage = err.message;
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Approval cancelled by user';
      }
      
      setError(errorMessage);
      setStatus('error');
      setStatusMessage(errorMessage);
      throw err;
    }
  }, [address, chain, sendCallsAsync, ensureCorrectChain, checkSmartAccountStatus]);

  /**
   * Execute batch transaction (approval + swap in one)
   * This is the BEST approach - combines both calls into a single transaction!
   */
  const executeBatch = useCallback(async ({ 
    tokenAddress, 
    spender, 
    amount, 
    routerHub, 
    swapCallData,
    targetChainId 
  }) => {
    if (!address || !chain) {
      throw new Error('Wallet not connected');
    }

    const chainId = targetChainId || chain.id;

    if (!SUPPORTED_CHAINS[chainId]) {
      throw new Error(`Chain ${chainId} not supported. Use Sepolia or Amoy.`);
    }

    setError(null);
    setTxHash(null);
    setStatus('preparing');

    try {
      await ensureCorrectChain(chainId);

      const accountStatus = await checkSmartAccountStatus();
      
      if (accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED) {
        setStatusMessage('✅ Smart Account active - executing batch (approve + swap)...');
        console.log('📤 EOA upgraded - batch will execute atomically');
      } else if (accountStatus.status === SMART_ACCOUNT_STATUS.NOT_UPGRADED) {
        setStatusMessage('⚡ First time: MetaMask will prompt to enable Smart Account...');
        console.log('📤 EOA not upgraded - MetaMask will show upgrade prompt');
        console.log('   After upgrade, approve + swap will execute in one transaction!');
      } else {
        setStatusMessage('Preparing batch transaction...');
      }

      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender, BigInt(amount)]
      });

      const calls = [
        {
          to: tokenAddress,
          data: approveData,
          value: 0n
        },
        {
          to: routerHub,
          data: swapCallData,
          value: 0n
        }
      ];

      console.log('📤 Sending batch via useSendCalls (EIP-5792)');
      console.log('   Calls:', calls.length, '(approve + swap)');
      console.log('   Smart Account Status:', accountStatus.status);
      console.log('   Paymaster URL:', SUPPORTED_CHAINS[chainId].paymasterUrl);

      setStatus('signing');
      setStatusMessage('Please confirm batch transaction in MetaMask...');

      // Try with paymasterService capability (may be ignored by MetaMask)
      const result = await sendCallsAsync({ 
        calls,
        chainId,
        capabilities: {
          paymasterService: {
            url: SUPPORTED_CHAINS[chainId].paymasterUrl
          }
        }
      });

      console.log('✅ Batch submitted, ID:', result);
      setStatus('submitted');
      setSubmissionTime(Date.now());
      setStatusMessage('Batch transaction submitted, waiting for confirmation (max 2 min)...');

      return result;

    } catch (err) {
      console.error('Batch error:', err);
      
      let errorMessage = err.message;
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      }
      
      setError(errorMessage);
      setStatus('error');
      setStatusMessage(errorMessage);
      throw err;
    }
  }, [address, chain, sendCallsAsync, ensureCorrectChain, checkSmartAccountStatus]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setStatus(null);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    setSubmissionTime(null);
    resetSendCalls();
  }, [resetSendCalls]);

  return {
    // Actions
    executeSwap,
    executeApproval,
    executeBatch,
    checkAvailability,
    checkSmartAccountStatus,
    reset,
    
    // State
    isLoading: isLoading || isStatusLoading,
    status,
    statusMessage,
    error,
    txHash,
    callsId,
    callsStatus,
    
    // Smart Account Status (detailed)
    smartAccountStatus,
    isSmartAccount: smartAccountStatus === SMART_ACCOUNT_STATUS.UPGRADED,
    isSmartAccountUpgraded: smartAccountStatus === SMART_ACCOUNT_STATUS.UPGRADED,
    needsSmartAccountUpgrade: smartAccountStatus === SMART_ACCOUNT_STATUS.NOT_UPGRADED,
    delegatorAddress,
    
    // Convenience flags
    isPreparing: status === 'preparing',
    isSigning: status === 'signing',
    isSubmitted: status === 'submitted',
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
    
    // Smart account info (same as EOA!)
    smartAccountAddress: address,
    
    // Chain info
    currentChainId: chain?.id,
    supportedChains: SUPPORTED_CHAINS,
    
    // Wallet capabilities
    walletCapabilities,
    
    // Constants for external use
    SMART_ACCOUNT_STATUS,
  };
}

// Export the status enum for use in other components
export { SMART_ACCOUNT_STATUS };
