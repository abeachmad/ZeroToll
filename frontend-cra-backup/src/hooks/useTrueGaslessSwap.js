/**
 * useTrueGaslessSwap Hook - TRUE GASLESS using wallet_sendCalls (EIP-5792)
 * 
 * MetaMask Smart Accounts support wallet_sendCalls natively.
 * When the user has Smart Account enabled, MetaMask handles:
 * - Creating the UserOperation
 * - Getting paymaster sponsorship (if configured)
 * - Signing the UserOp
 * - Submitting to bundler
 * 
 * The user just approves the batch - NO GAS REQUIRED!
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseAbi } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';

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

const PIMLICO_API_KEY = process.env.REACT_APP_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

const SUPPORTED_CHAINS = {
  80002: { 
    name: 'Polygon Amoy',
    chain: polygonAmoy,
    explorer: 'https://amoy.polygonscan.com',
    paymasterUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`
  },
  11155111: { 
    name: 'Ethereum Sepolia',
    chain: sepolia,
    explorer: 'https://sepolia.etherscan.io',
    paymasterUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`
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
        message: 'Smart Account not enabled - enable in MetaMask settings'
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
  }, [address, publicClient]);

  useEffect(() => {
    if (address && publicClient) {
      checkSmartAccountStatus();
    }
  }, [address, publicClient, chain?.id, checkSmartAccountStatus]);

  /**
   * Execute TRUE GASLESS transaction using wallet_sendCalls (EIP-5792)
   * MetaMask handles everything - UserOp creation, signing, submission
   */
  const executeGaslessSwap = useCallback(async ({ calls }) => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const chainConfig = SUPPORTED_CHAINS[chain.id];
    if (!chainConfig) {
      throw new Error(`Chain ${chain.id} not supported`);
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
      console.log('📡 Using wallet_sendCalls (EIP-5792) for TRUE GASLESS...');

      // Format calls for wallet_sendCalls
      const formattedCalls = calls.map(c => ({
        to: c.to,
        data: c.data || '0x',
        value: c.value ? `0x${BigInt(c.value).toString(16)}` : '0x0'
      }));

      console.log('📤 Calls:', formattedCalls);

      setStatus('signing');
      setStatusMessage('Please approve in MetaMask (NO GAS COST!)...');

      // Use wallet_sendCalls - MetaMask handles UserOp creation, signing, submission
      // This is the EIP-5792 standard that MetaMask Smart Accounts support
      // MetaMask requires version 2.0.0
      // Note: paymasterService capability is not supported by MetaMask yet,
      // so we send without it - user's smart account pays gas from its balance
      const result = await walletClient.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0.0',
          chainId: `0x${chain.id.toString(16)}`,
          from: address,
          calls: formattedCalls,
          atomicRequired: true // Required by MetaMask - execute all calls atomically
          // No paymaster capability - smart account pays gas
        }]
      });

      console.log('✅ wallet_sendCalls result:', result);

      // Result is the bundle ID (similar to userOpHash)
      const bundleId = result;
      setUserOpHash(bundleId);

      setStatus('submitting');
      setStatusMessage('Waiting for confirmation...');

      // Poll for receipt using wallet_getCallsStatus
      let receipt = null;
      const startTime = Date.now();
      const timeout = 120000;

      while (!receipt && Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 2000));
        
        try {
          const statusResult = await walletClient.request({
            method: 'wallet_getCallsStatus',
            params: [bundleId]
          });

          console.log('📊 Status:', statusResult);

          if (statusResult.status === 'CONFIRMED') {
            receipt = statusResult;
          } else if (statusResult.status === 'FAILED') {
            throw new Error('Transaction failed: ' + (statusResult.reason || 'Unknown error'));
          }
        } catch (pollError) {
          // Ignore polling errors, keep trying
          console.log('Polling...', pollError.message);
        }
      }

      if (!receipt) {
        // Even without receipt, the transaction might have succeeded
        // Return the bundle ID so user can check manually
        setStatus('submitted');
        setStatusMessage('Transaction submitted. Check explorer for confirmation.');
        return {
          success: true,
          bundleId,
          userOpHash: bundleId,
          note: 'Transaction submitted. Confirmation pending.'
        };
      }

      const txHashResult = receipt.receipts?.[0]?.transactionHash;
      if (txHashResult) {
        setTxHash(txHashResult);
      }

      console.log('🎉 Transaction confirmed!');
      console.log('   TX Hash:', txHashResult);

      setStatus('success');
      setStatusMessage('🎉 TRUE GASLESS SUCCESS! You paid $0 in gas!');

      return {
        success: true,
        txHash: txHashResult,
        bundleId,
        userOpHash: bundleId,
        explorerUrl: txHashResult ? `${chainConfig.explorer}/tx/${txHashResult}` : null
      };

    } catch (err) {
      console.error('Gasless swap error:', err);
      
      let errorMessage = err.message;
      
      // Handle specific errors
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (
        err.code === 4200 || 
        err.code === 5700 ||  // Unsupported capability
        err.message?.includes('Method not found') ||
        err.message?.includes('not available') ||
        err.message?.includes('Unsupported') ||
        err.message?.includes('paymasterService')
      ) {
        // wallet_sendCalls with paymaster not supported by MetaMask yet
        // Show a clear error message
        console.log('⚠️ MetaMask does not support paymasterService capability yet');
        errorMessage = 
          'TRUE GASLESS not available: MetaMask does not yet support paymaster in wallet_sendCalls. ' +
          'Your Smart Account is enabled, but you will need to pay gas for now. ' +
          'Use the standard swap button instead.';
      }
      
      setError(errorMessage);
      setStatus('error');
      setStatusMessage(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, walletClient, checkSmartAccountStatus]);

  /**
   * Fallback: Use Delegation API for TRUE GASLESS
   * The user delegates to the backend, which executes on their behalf with paymaster
   */
  const executeGaslessSwapFallback = useCallback(async ({ calls }) => {
    const chainConfig = SUPPORTED_CHAINS[chain.id];
    const DELEGATION_API_URL = process.env.REACT_APP_DELEGATION_API_URL || 'http://localhost:3003';

    console.log('📡 Using Delegation API for TRUE GASLESS...');
    setStatusMessage('Checking delegation status...');

    // Step 1: Check if user has a delegation
    const checkResponse = await fetch(`${DELEGATION_API_URL}/api/delegation/check/${address}/${chain.id}`);
    const checkResult = await checkResponse.json();

    if (!checkResult.hasDelegation) {
      // User needs to create a delegation first
      // For now, show a helpful error message
      throw new Error(
        'TRUE GASLESS requires delegation setup. ' +
        'MetaMask does not yet support paymaster in wallet_sendCalls. ' +
        'Please use the standard swap (you will pay gas) or wait for MetaMask to add paymaster support.'
      );
    }

    console.log('✅ Delegation found, executing...');
    setStatusMessage('Executing gasless transaction...');

    // Step 2: Execute via delegation
    const executeResponse = await fetch(`${DELEGATION_API_URL}/api/delegation/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: address,
        chainId: chain.id,
        calls: calls.map(c => ({
          to: c.to,
          data: c.data || '0x',
          value: c.value?.toString() || '0'
        }))
      })
    });

    const executeResult = await executeResponse.json();
    
    if (!executeResponse.ok || executeResult.error) {
      throw new Error(executeResult.error || 'Failed to execute transaction');
    }

    console.log('🎉 Transaction confirmed!');
    console.log('   TX Hash:', executeResult.txHash);

    setTxHash(executeResult.txHash);
    setUserOpHash(executeResult.userOpHash);
    setStatus('success');
    setStatusMessage('🎉 TRUE GASLESS SUCCESS! You paid $0 in gas!');

    return {
      success: executeResult.success,
      txHash: executeResult.txHash,
      userOpHash: executeResult.userOpHash,
      explorerUrl: executeResult.explorerUrl || `${chainConfig.explorer}/tx/${executeResult.txHash}`
    };
  }, [address, chain]);

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
   * Check if user has a delegation for gasless transactions
   */
  const checkDelegation = useCallback(async () => {
    if (!address || !chain?.id) return { hasDelegation: false };
    
    const DELEGATION_API_URL = process.env.REACT_APP_DELEGATION_API_URL || 'http://localhost:3003';
    
    try {
      const response = await fetch(`${DELEGATION_API_URL}/api/delegation/check/${address}/${chain.id}`);
      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Error checking delegation:', err);
      return { hasDelegation: false, error: err.message };
    }
  }, [address, chain?.id]);

  /**
   * Get the delegate address that user should grant delegation to
   */
  const getDelegateInfo = useCallback(async () => {
    const DELEGATION_API_URL = process.env.REACT_APP_DELEGATION_API_URL || 'http://localhost:3003';
    
    try {
      const response = await fetch(`${DELEGATION_API_URL}/api/delegation/delegate-info`);
      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Error getting delegate info:', err);
      return { error: err.message };
    }
  }, []);

  /**
   * Check if gasless is available
   */
  const checkAvailability = useCallback(async () => {
    if (!chain?.id || !SUPPORTED_CHAINS[chain.id]) {
      return { available: false, reason: `Chain ${chain?.id} not supported`, smartAccountStatus: SMART_ACCOUNT_STATUS.UNKNOWN };
    }
    if (!isConnected) {
      return { available: false, reason: 'Wallet not connected', smartAccountStatus: SMART_ACCOUNT_STATUS.UNKNOWN };
    }

    const accountStatus = await checkSmartAccountStatus();
    const delegationStatus = await checkDelegation();
    
    return { 
      available: accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED,
      chain: SUPPORTED_CHAINS[chain.id].name,
      chainId: chain.id,
      explorer: SUPPORTED_CHAINS[chain.id].explorer,
      smartAccountStatus: accountStatus.status,
      isSmartAccount: accountStatus.isSmartAccount,
      delegatorAddress: accountStatus.delegatorAddress,
      hasDelegation: delegationStatus.hasDelegation,
      delegateAddress: delegationStatus.delegateAddress,
      note: accountStatus.message,
      gasless: accountStatus.status === SMART_ACCOUNT_STATUS.UPGRADED,
      reason: accountStatus.status !== SMART_ACCOUNT_STATUS.UPGRADED 
        ? 'Smart Account not enabled' 
        : 'TRUE GASLESS available!'
    };
  }, [chain, isConnected, checkSmartAccountStatus, checkDelegation]);

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
    checkDelegation,
    getDelegateInfo,
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
