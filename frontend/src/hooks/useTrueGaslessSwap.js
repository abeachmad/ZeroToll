/**
 * useTrueGaslessSwap Hook - TRUE EIP-7702 Gasless Transactions
 * 
 * This hook implements REAL gasless transactions using:
 * 1. MetaMask Smart Accounts Kit for proper UserOp formatting
 * 2. Pimlico bundler for UserOp submission
 * 3. Pimlico paymaster for gas sponsorship
 * 
 * USER PAYS $0 IN GAS FEES!
 * 
 * Requirements:
 * - Wallet must be upgraded to Smart Account (EIP-7702)
 * - Pimlico API key must be configured
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { encodeFunctionData, parseAbi } from 'viem';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import { http } from 'viem';

// ERC20 ABI for approve
const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
]);

// Smart Account Status enum
const SMART_ACCOUNT_STATUS = {
  NOT_UPGRADED: 'NOT_UPGRADED',
  UPGRADED: 'UPGRADED',
  UNKNOWN: 'UNKNOWN',
  CHECKING: 'CHECKING'
};

// Pimlico API Key - should be in env
// eslint-disable-next-line no-undef
const PIMLICO_API_KEY = typeof import.meta !== 'undefined' && import.meta.env?.VITE_PIMLICO_API_KEY 
  ? import.meta.env.VITE_PIMLICO_API_KEY 
  : 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Supported chains for TRUE gasless
const SUPPORTED_CHAINS = {
  80002: { 
    name: 'Polygon Amoy',
    rpc: 'https://rpc-amoy.polygon.technology',
    pimlicoRpc: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    explorer: 'https://amoy.polygonscan.com'
  },
  11155111: { 
    name: 'Ethereum Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    pimlicoRpc: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    explorer: 'https://sepolia.etherscan.io'
  },
};

export function useTrueGaslessSwap() {
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [userOpHash, setUserOpHash] = useState(null);
  const [smartAccountStatus, setSmartAccountStatus] = useState(SMART_ACCOUNT_STATUS.UNKNOWN);
  const [delegatorAddress, setDelegatorAddress] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check if EOA is upgraded to Smart Account
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
  }, [address, publicClient]);

  // Check status on mount and when address/chain changes
  useEffect(() => {
    if (address && publicClient) {
      checkSmartAccountStatus();
    }
  }, [address, publicClient, chain?.id, checkSmartAccountStatus]);

  /**
   * Create bundler client with Pimlico paymaster
   */
  const createGaslessClient = useCallback(async () => {
    if (!address || !publicClient || !walletClient || !chain?.id) {
      throw new Error('Wallet not connected');
    }

    const chainConfig = SUPPORTED_CHAINS[chain.id];
    if (!chainConfig) {
      throw new Error(`Chain ${chain.id} not supported for gasless`);
    }

    // Check smart account status
    const accountStatus = await checkSmartAccountStatus();
    if (accountStatus.status !== SMART_ACCOUNT_STATUS.UPGRADED) {
      throw new Error('Smart Account not enabled. Please upgrade your wallet first.');
    }

    // Create MetaMask Smart Account
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: 'Stateless7702',
      address: address,
      signer: { walletClient }
    });

    // Create Pimlico client for paymaster
    const pimlicoClient = createPimlicoClient({
      chain: chain,
      transport: http(chainConfig.pimlicoRpc),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7'
      }
    });

    // Create Bundler Client with paymaster
    const bundlerClient = createBundlerClient({
      chain: chain,
      transport: http(chainConfig.pimlicoRpc),
      account: smartAccount,
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrices = await pimlicoClient.getUserOperationGasPrice();
          return gasPrices.fast;
        }
      }
    });

    return { bundlerClient, smartAccount, pimlicoClient };
  }, [address, publicClient, walletClient, chain, checkSmartAccountStatus]);

  /**
   * Execute TRUE gasless swap
   * User pays $0 in gas fees!
   */
  const executeGaslessSwap = useCallback(async ({ calls }) => {
    if (!address || !chain) {
      throw new Error('Wallet not connected');
    }

    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setStatus('preparing');
    setIsLoading(true);

    try {
      setStatusMessage('Creating gasless client...');
      const { bundlerClient } = await createGaslessClient();

      setStatus('signing');
      setStatusMessage('Please sign the transaction in MetaMask...');

      console.log('📤 Sending GASLESS UserOperation');
      console.log('   Calls:', calls.length);

      const hash = await bundlerClient.sendUserOperation({ calls });
      
      setUserOpHash(hash);
      setStatus('submitted');
      setStatusMessage('UserOperation submitted, waiting for confirmation...');
      console.log('✅ UserOperation sent:', hash);

      // Wait for receipt
      setStatusMessage('Waiting for transaction confirmation...');
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash,
        timeout: 120000
      });

      setTxHash(receipt.receipt.transactionHash);
      
      if (receipt.success) {
        setStatus('success');
        setStatusMessage('🎉 GASLESS transaction successful! You paid $0 in gas!');
        console.log('🎉 GASLESS SUCCESS!');
        console.log('   TX Hash:', receipt.receipt.transactionHash);
        console.log('   Block:', receipt.receipt.blockNumber);
      } else {
        setStatus('error');
        setError('Transaction failed on-chain');
        setStatusMessage('Transaction failed');
      }

      return receipt;

    } catch (err) {
      console.error('Gasless swap error:', err);
      
      let errorMessage = err.message;
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('Smart Account not enabled')) {
        errorMessage = 'Please upgrade to Smart Account first (use MetaMask settings)';
      }
      
      setError(errorMessage);
      setStatus('error');
      setStatusMessage(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, createGaslessClient]);

  /**
   * Execute gasless approval
   */
  const executeGaslessApproval = useCallback(async ({ tokenAddress, spender, amount }) => {
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

    return executeGaslessSwap({ calls });
  }, [executeGaslessSwap]);

  /**
   * Execute gasless batch (approve + swap)
   * This is the BEST approach - one transaction, zero gas!
   */
  const executeGaslessBatch = useCallback(async ({ 
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

    console.log('📤 Executing GASLESS batch (approve + swap)');
    return executeGaslessSwap({ calls });
  }, [executeGaslessSwap]);

  /**
   * Check availability
   */
  const checkAvailability = useCallback(async () => {
    if (!chain?.id || !SUPPORTED_CHAINS[chain.id]) {
      return { 
        available: false, 
        reason: `Chain ${chain?.id} not supported. Use Sepolia or Amoy.`,
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
      reason: accountStatus.status !== SMART_ACCOUNT_STATUS.UPGRADED 
        ? 'Smart Account not enabled - upgrade required'
        : 'TRUE GASLESS available!'
    };
  }, [chain, isConnected, checkSmartAccountStatus]);

  /**
   * Reset state
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
    // Actions
    executeGaslessSwap,
    executeGaslessApproval,
    executeGaslessBatch,
    checkAvailability,
    checkSmartAccountStatus,
    reset,
    
    // State
    isLoading,
    status,
    statusMessage,
    error,
    txHash,
    userOpHash,
    
    // Smart Account Status
    smartAccountStatus,
    isSmartAccount: smartAccountStatus === SMART_ACCOUNT_STATUS.UPGRADED,
    needsUpgrade: smartAccountStatus === SMART_ACCOUNT_STATUS.NOT_UPGRADED,
    delegatorAddress,
    
    // Convenience flags
    isPreparing: status === 'preparing',
    isSigning: status === 'signing',
    isSubmitted: status === 'submitted',
    isSuccess: status === 'success',
    isError: status === 'error',
    
    // Chain info
    currentChainId: chain?.id,
    supportedChains: SUPPORTED_CHAINS,
    
    // Constants
    SMART_ACCOUNT_STATUS,
  };
}

export { SMART_ACCOUNT_STATUS };
