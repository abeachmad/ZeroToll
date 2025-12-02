/**
 * useMetaMaskSmartAccount Hook - TRUE GASLESS with EIP-7702 + ERC-4337
 * 
 * This uses MetaMask Smart Accounts Kit with:
 * 1. Stateless7702 implementation - EOA becomes smart account (same address!)
 * 2. Pimlico bundler + paymaster - for gasless transactions
 * 3. sendUserOperation - NOT wallet_sendCalls
 * 
 * Based on: https://docs.metamask.io/tutorials/use-erc20-paymaster/
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { 
  createPublicClient, 
  http, 
  encodeFunctionData, 
  parseAbi
} from 'viem';
import { createBundlerClient, createPaymasterClient } from 'viem/account-abstraction';
import { polygonAmoy, sepolia } from 'viem/chains';
// Static import for MetaMask Smart Accounts Kit
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
]);

// Pimlico API Key
const PIMLICO_API_KEY = process.env.REACT_APP_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Chain configurations
const CHAIN_CONFIG = {
  80002: {
    name: 'Polygon Amoy',
    chain: polygonAmoy,
    explorer: 'https://amoy.polygonscan.com',
    bundlerUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    paymasterUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    // Pimlico ERC-20 paymaster address (same on all chains)
    pimlicoPaymaster: '0x777777777777AeC03fd955926DbF81597e66834C'
  },
  11155111: {
    name: 'Ethereum Sepolia',
    chain: sepolia,
    explorer: 'https://sepolia.etherscan.io',
    bundlerUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    paymasterUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://rpc.sepolia.org',
    pimlicoPaymaster: '0x777777777777AeC03fd955926DbF81597e66834C'
  }
};

const STATUS = {
  IDLE: 'idle',
  LOADING_MODULES: 'loading_modules',
  CREATING_ACCOUNT: 'creating_account',
  PREPARING: 'preparing',
  SIGNING: 'signing',
  SUBMITTING: 'submitting',
  CONFIRMING: 'confirming',
  SUCCESS: 'success',
  ERROR: 'error'
};

export function useMetaMaskSmartAccount() {
  const { address, chain, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [status, setStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [userOpHash, setUserOpHash] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [smartAccountAddress, setSmartAccountAddress] = useState(null);
  const [isSmartAccount, setIsSmartAccount] = useState(false);

  // Cache for modules
  const modulesRef = useRef(null);
  const smartAccountRef = useRef(null);
  const bundlerClientRef = useRef(null);

  /**
   * Check if EOA is upgraded to 7702 smart account
   */
  const checkSmartAccountStatus = useCallback(async () => {
    if (!address || !publicClient) return false;

    try {
      const code = await publicClient.getCode({ address });
      const upgraded = code && code !== '0x' && code.startsWith('0xef0100');
      setIsSmartAccount(upgraded);
      
      if (upgraded) {
        console.log('✅ EOA is upgraded to 7702 Smart Account');
        console.log('   Delegator:', '0x' + code.substring(8, 48));
        setSmartAccountAddress(address); // Same address!
      }
      
      return upgraded;
    } catch (err) {
      console.error('Error checking smart account:', err);
      return false;
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (address && publicClient) {
      checkSmartAccountStatus();
    }
  }, [address, publicClient, chain?.id, checkSmartAccountStatus]);

  /**
   * Get modules (already imported statically)
   */
  const getModules = useCallback(() => {
    console.log('📦 Using MetaMask Smart Accounts Kit...');
    console.log('   Implementation enum:', Implementation);
    console.log('   Stateless7702:', Implementation.Stateless7702);
    
    return {
      toMetaMaskSmartAccount,
      Implementation,
      createBundlerClient,
      createPaymasterClient
    };
  }, []);

  /**
   * Initialize the smart account and bundler client
   */
  const initializeSmartAccount = useCallback(async () => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      throw new Error(`Chain ${chain.id} not supported`);
    }

    // Check if already initialized for this address/chain
    if (smartAccountRef.current && bundlerClientRef.current) {
      return {
        smartAccount: smartAccountRef.current,
        bundlerClient: bundlerClientRef.current
      };
    }

    setStatus(STATUS.LOADING_MODULES);
    setStatusMessage('Initializing Smart Accounts Kit...');

    const modules = getModules();

    setStatus(STATUS.CREATING_ACCOUNT);
    setStatusMessage('Creating Stateless7702 Smart Account...');

    // Create public client for the chain
    const chainPublicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl)
    });

    // Create paymaster client
    console.log('📡 Creating Pimlico paymaster client...');
    const paymasterClient = createPaymasterClient({
      transport: http(config.paymasterUrl)
    });

    // Create the Stateless7702 smart account
    // This wraps the existing EOA - SAME ADDRESS!
    console.log('📡 Creating Stateless7702 Smart Account...');
    console.log('   EOA Address:', address);
    console.log('   Implementation:', modules.Implementation.Stateless7702);

    const smartAccount = await modules.toMetaMaskSmartAccount({
      client: chainPublicClient,
      implementation: modules.Implementation.Stateless7702,
      address: address, // Use the EOA address
      signer: {
        // Use walletClient for signing
        walletClient: walletClient
      }
    });

    console.log('✅ Smart Account created:', smartAccount.address);
    setSmartAccountAddress(smartAccount.address);

    // Create bundler client with paymaster
    console.log('📡 Creating Bundler Client with paymaster...');
    const bundlerClient = createBundlerClient({
      client: chainPublicClient,
      transport: http(config.bundlerUrl),
      paymaster: paymasterClient
    });

    console.log('✅ Bundler Client created');

    // Cache for reuse
    smartAccountRef.current = smartAccount;
    bundlerClientRef.current = bundlerClient;

    return { smartAccount, bundlerClient, paymasterClient };
  }, [address, chain, walletClient, loadModules]);

  /**
   * Send a gasless UserOperation
   */
  const sendGaslessUserOp = useCallback(async ({ calls }) => {
    if (!address || !chain) {
      throw new Error('Wallet not connected');
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      throw new Error(`Chain ${chain.id} not supported`);
    }

    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setIsLoading(true);

    try {
      // Initialize smart account and bundler
      const { smartAccount, bundlerClient } = await initializeSmartAccount();

      setStatus(STATUS.PREPARING);
      setStatusMessage('Preparing gasless transaction...');

      // Format calls for sendUserOperation
      const formattedCalls = calls.map(call => ({
        to: call.to,
        data: call.data || '0x',
        value: call.value ? BigInt(call.value) : 0n
      }));

      console.log('📤 Sending UserOperation...');
      console.log('   Calls:', formattedCalls.length);
      console.log('   Smart Account:', smartAccount.address);

      setStatus(STATUS.SIGNING);
      setStatusMessage('Please sign in MetaMask (NO GAS!)...');

      // Send the UserOperation - Pimlico paymaster sponsors gas!
      const hash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: formattedCalls
      });

      console.log('✅ UserOp submitted:', hash);
      setUserOpHash(hash);

      setStatus(STATUS.CONFIRMING);
      setStatusMessage('Waiting for confirmation...');

      // Wait for receipt
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash,
        timeout: 120000
      });

      console.log('✅ Transaction confirmed!');
      console.log('   TX Hash:', receipt.receipt.transactionHash);
      console.log('   Success:', receipt.success);

      setTxHash(receipt.receipt.transactionHash);

      if (receipt.success) {
        setStatus(STATUS.SUCCESS);
        setStatusMessage('🎉 GASLESS transaction successful! You paid $0 in gas!');
      } else {
        throw new Error('Transaction failed on-chain');
      }

      return {
        success: receipt.success,
        txHash: receipt.receipt.transactionHash,
        userOpHash: hash,
        explorerUrl: `${config.explorer}/tx/${receipt.receipt.transactionHash}`
      };

    } catch (err) {
      console.error('❌ Gasless UserOp error:', err);

      let errorMessage = err.message;
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('AA')) {
        errorMessage = `Account Abstraction error: ${err.message}`;
      }

      setError(errorMessage);
      setStatus(STATUS.ERROR);
      setStatusMessage(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, initializeSmartAccount]);

  /**
   * Execute gasless approval
   */
  const executeGaslessApproval = useCallback(async ({ tokenAddress, spender, amount }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return sendGaslessUserOp({
      calls: [{ to: tokenAddress, data: approveData, value: 0n }]
    });
  }, [sendGaslessUserOp]);

  /**
   * Execute gasless batch (approve + swap)
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

    return sendGaslessUserOp({
      calls: [
        { to: tokenAddress, data: approveData, value: 0n },
        { to: routerHub, data: swapCallData, value: 0n }
      ]
    });
  }, [sendGaslessUserOp]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setStatus(STATUS.IDLE);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setIsLoading(false);
  }, []);

  /**
   * Check availability
   */
  const checkAvailability = useCallback(async () => {
    if (!chain?.id) {
      return { available: false, reason: 'No chain connected' };
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      return { available: false, reason: `Chain ${chain.id} not supported` };
    }

    if (!isConnected || !address) {
      return { available: false, reason: 'Wallet not connected' };
    }

    const upgraded = await checkSmartAccountStatus();

    return {
      available: true,
      chain: config.name,
      chainId: chain.id,
      explorer: config.explorer,
      isSmartAccount: upgraded,
      smartAccountAddress: upgraded ? address : null,
      note: upgraded 
        ? '✅ EOA upgraded to 7702 - TRUE GASLESS available!'
        : '⚠️ EOA not upgraded - will be upgraded on first tx'
    };
  }, [chain?.id, isConnected, address, checkSmartAccountStatus]);

  return {
    // Actions
    sendGaslessUserOp,
    executeGaslessApproval,
    executeGaslessBatch,
    initializeSmartAccount,
    checkAvailability,
    checkSmartAccountStatus,
    reset,

    // State
    status,
    statusMessage,
    error,
    txHash,
    userOpHash,
    isLoading,
    smartAccountAddress,
    isSmartAccount,

    // Convenience
    isPreparing: status === STATUS.PREPARING,
    isSigning: status === STATUS.SIGNING,
    isSubmitting: status === STATUS.SUBMITTING,
    isConfirming: status === STATUS.CONFIRMING,
    isSuccess: status === STATUS.SUCCESS,
    isError: status === STATUS.ERROR,

    // Chain info
    chainId: chain?.id,
    supportedChains: CHAIN_CONFIG,
    STATUS
  };
}

export { STATUS, CHAIN_CONFIG };
