/**
 * useHybridGasless Hook - WORKING Gasless Implementation
 * 
 * PROBLEM: MetaMask does NOT support EIP-7702 on testnets (Amoy/Sepolia)
 * SOLUTION: Hybrid approach that uses the right method per network
 * 
 * SUPPORTED METHODS:
 * 1. EIP-7702 via wallet_sendCalls - ONLY on Gnosis Chain (100) and Base (8453)
 * 2. ERC-4337 Smart Accounts via Pimlico - Works on ALL networks including testnets
 * 
 * This hook automatically selects the best method based on the connected network.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { http, encodeFunctionData, parseAbi, createPublicClient, createWalletClient, custom } from 'viem';
import { polygonAmoy, sepolia, gnosis, base } from 'viem/chains';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
]);

// Pimlico API Key
const PIMLICO_API_KEY = process.env.REACT_APP_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// EntryPoint v0.7 address (same on all chains)
const ENTRYPOINT_ADDRESS_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Chain configurations with gasless method
const CHAIN_CONFIG = {
  // TESTNETS - Use ERC-4337 (MetaMask doesn't support 7702 here)
  80002: {
    name: 'Polygon Amoy',
    chain: polygonAmoy,
    method: 'erc4337', // ERC-4337 Smart Accounts
    explorer: 'https://amoy.polygonscan.com',
    bundlerUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    paymasterUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://rpc-amoy.polygon.technology'
  },
  11155111: {
    name: 'Ethereum Sepolia',
    chain: sepolia,
    method: 'erc4337', // ERC-4337 Smart Accounts
    explorer: 'https://sepolia.etherscan.io',
    bundlerUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    paymasterUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://rpc.sepolia.org'
  },
  // MAINNETS - Use EIP-7702 (MetaMask supports it here!)
  100: {
    name: 'Gnosis Chain',
    chain: gnosis,
    method: 'eip7702', // TRUE EIP-7702 via wallet_sendCalls
    explorer: 'https://gnosisscan.io',
    bundlerUrl: `https://api.pimlico.io/v2/100/rpc?apikey=${PIMLICO_API_KEY}`,
    paymasterUrl: `https://api.pimlico.io/v2/100/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://rpc.gnosischain.com'
  },
  8453: {
    name: 'Base',
    chain: base,
    method: 'eip7702', // TRUE EIP-7702 via wallet_sendCalls
    explorer: 'https://basescan.org',
    bundlerUrl: `https://api.pimlico.io/v2/8453/rpc?apikey=${PIMLICO_API_KEY}`,
    paymasterUrl: `https://api.pimlico.io/v2/8453/rpc?apikey=${PIMLICO_API_KEY}`,
    rpcUrl: 'https://mainnet.base.org'
  }
};

const STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  PREPARING: 'preparing',
  SIGNING: 'signing',
  SUBMITTING: 'submitting',
  CONFIRMING: 'confirming',
  SUCCESS: 'success',
  ERROR: 'error'
};

export function useHybridGasless() {
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [status, setStatus] = useState(STATUS.IDLE);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [userOpHash, setUserOpHash] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [smartAccountAddress, setSmartAccountAddress] = useState(null);
  const [gaslessMethod, setGaslessMethod] = useState(null);

  // Cache for dynamically imported modules
  const modulesRef = useRef(null);

  /**
   * Get the gasless method for current chain
   */
  const getGaslessMethod = useCallback(() => {
    if (!chain?.id) return null;
    const config = CHAIN_CONFIG[chain.id];
    return config?.method || null;
  }, [chain?.id]);

  /**
   * Dynamically load ERC-4337 modules (only when needed)
   */
  const loadERC4337Modules = useCallback(async () => {
    if (modulesRef.current) return modulesRef.current;

    try {
      console.log('📦 Loading ERC-4337 modules...');
      
      // Import from permissionless v0.3.x
      const [
        permissionlessMain,
        pimlicoModule,
        accountsModule
      ] = await Promise.all([
        import('permissionless'),
        import('permissionless/clients/pimlico'),
        import('permissionless/accounts')
      ]);

      // Merge all exports
      modulesRef.current = {
        createSmartAccountClient: permissionlessMain.createSmartAccountClient,
        createPimlicoClient: pimlicoModule.createPimlicoClient,
        toSimpleSmartAccount: accountsModule.toSimpleSmartAccount,
        toSafeSmartAccount: accountsModule.toSafeSmartAccount,
      };

      console.log('✅ ERC-4337 modules loaded:', Object.keys(modulesRef.current));
      return modulesRef.current;
    } catch (err) {
      console.error('Failed to load ERC-4337 modules:', err);
      throw new Error(`Failed to load gasless modules: ${err.message}`);
    }
  }, []);

  /**
   * Check if gasless is available and which method will be used
   */
  const checkAvailability = useCallback(async () => {
    if (!chain?.id) {
      return { available: false, reason: 'No chain connected' };
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      return { 
        available: false, 
        reason: `Chain ${chain.id} not supported for gasless. Supported: Amoy, Sepolia, Gnosis, Base` 
      };
    }

    if (!isConnected || !address) {
      return { available: false, reason: 'Wallet not connected' };
    }

    setGaslessMethod(config.method);

    return {
      available: true,
      method: config.method,
      methodName: config.method === 'eip7702' ? 'EIP-7702 (Native)' : 'ERC-4337 (Smart Account)',
      chain: config.name,
      chainId: chain.id,
      explorer: config.explorer,
      isNativeGasless: config.method === 'eip7702',
      note: config.method === 'eip7702' 
        ? '✅ TRUE gasless via MetaMask Smart Account'
        : '✅ Gasless via Pimlico Smart Account (Safe)'
    };
  }, [chain?.id, isConnected, address]);


  /**
   * Execute gasless transaction using EIP-7702 (for Gnosis/Base)
   * MetaMask handles everything via wallet_sendCalls
   */
  const executeViaEIP7702 = useCallback(async ({ calls }) => {
    const config = CHAIN_CONFIG[chain.id];
    
    console.log('🚀 Executing via EIP-7702 (wallet_sendCalls)...');
    setStatusMessage('Preparing EIP-7702 transaction...');

    // Format calls for wallet_sendCalls
    const formattedCalls = calls.map(c => ({
      to: c.to,
      data: c.data || '0x',
      value: c.value ? `0x${BigInt(c.value).toString(16)}` : '0x0'
    }));

    console.log('📤 Calls:', formattedCalls);

    setStatus(STATUS.SIGNING);
    setStatusMessage('Please approve in MetaMask (NO GAS!)...');

    // Use wallet_sendCalls with paymasterService capability
    const result = await walletClient.request({
      method: 'wallet_sendCalls',
      params: [{
        version: '2.0.0',
        chainId: `0x${chain.id.toString(16)}`,
        from: address,
        calls: formattedCalls,
        atomicRequired: true,
        capabilities: {
          paymasterService: {
            url: config.paymasterUrl
          }
        }
      }]
    });

    console.log('✅ wallet_sendCalls result:', result);
    const bundleId = result;
    setUserOpHash(bundleId);

    setStatus(STATUS.CONFIRMING);
    setStatusMessage('Waiting for confirmation...');

    // Poll for receipt
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
        if (!pollError.message?.includes('not found')) {
          console.log('Polling...', pollError.message);
        }
      }
    }

    const txHashResult = receipt?.receipts?.[0]?.transactionHash;
    if (txHashResult) {
      setTxHash(txHashResult);
    }

    return {
      success: true,
      txHash: txHashResult,
      bundleId,
      userOpHash: bundleId,
      method: 'eip7702',
      explorerUrl: txHashResult ? `${config.explorer}/tx/${txHashResult}` : null
    };
  }, [chain?.id, address, walletClient]);

  /**
   * Execute gasless transaction using ERC-4337 (for testnets)
   * Uses Pimlico bundler + Simple Smart Account
   * 
   * NOTE: permissionless v0.3.x uses toSimpleSmartAccount instead of signerToSafeSmartAccount
   */
  const executeViaERC4337 = useCallback(async ({ calls }) => {
    const config = CHAIN_CONFIG[chain.id];
    
    console.log('🚀 Executing via ERC-4337 (Pimlico)...');
    setStatusMessage('Loading Smart Account modules...');

    // Load ERC-4337 modules dynamically
    const modules = await loadERC4337Modules();
    const { 
      createSmartAccountClient,
      toSimpleSmartAccount,
      createPimlicoClient
    } = modules;

    setStatusMessage('Creating Smart Account...');

    // Create a public client for the chain
    const chainPublicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl)
    });

    // Create Pimlico client for paymaster
    const pimlicoClient = createPimlicoClient({
      chain: config.chain,
      transport: http(config.paymasterUrl),
      entryPoint: {
        address: ENTRYPOINT_ADDRESS_V07,
        version: '0.7'
      }
    });

    console.log('✅ Pimlico client created');

    // Create a local wallet client for signing
    const localWalletClient = createWalletClient({
      account: address,
      chain: config.chain,
      transport: custom(window.ethereum)
    });

    // Create Simple Smart Account from the connected wallet
    // This creates a counterfactual account that the user controls
    const simpleAccount = await toSimpleSmartAccount({
      client: chainPublicClient,
      owner: localWalletClient,
      entryPoint: {
        address: ENTRYPOINT_ADDRESS_V07,
        version: '0.7'
      }
    });

    console.log('✅ Simple Smart Account created:', simpleAccount.address);
    setSmartAccountAddress(simpleAccount.address);

    // Create Smart Account Client with paymaster
    const smartAccountClient = createSmartAccountClient({
      account: simpleAccount,
      chain: config.chain,
      bundlerTransport: http(config.bundlerUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrices = await pimlicoClient.getUserOperationGasPrice();
          return gasPrices.fast;
        }
      }
    });

    console.log('✅ Smart Account Client created');

    // Prepare calls
    const preparedCalls = calls.map(c => ({
      to: c.to,
      data: c.data || '0x',
      value: BigInt(c.value || 0)
    }));

    console.log('📤 Sending UserOperation with', preparedCalls.length, 'calls');

    setStatus(STATUS.SIGNING);
    setStatusMessage('Please sign in MetaMask (NO GAS!)...');

    // Send UserOperation
    const hash = await smartAccountClient.sendUserOperation({
      calls: preparedCalls
    });

    console.log('✅ UserOp submitted:', hash);
    setUserOpHash(hash);

    setStatus(STATUS.CONFIRMING);
    setStatusMessage('Waiting for confirmation...');

    // Wait for receipt
    const receipt = await smartAccountClient.waitForUserOperationReceipt({
      hash,
      timeout: 120000
    });

    console.log('✅ Transaction confirmed!');
    console.log('   TX Hash:', receipt.receipt.transactionHash);

    setTxHash(receipt.receipt.transactionHash);

    return {
      success: receipt.success,
      txHash: receipt.receipt.transactionHash,
      userOpHash: hash,
      method: 'erc4337',
      smartAccountAddress: simpleAccount.address,
      explorerUrl: `${config.explorer}/tx/${receipt.receipt.transactionHash}`
    };
  }, [chain?.id, address, walletClient, loadERC4337Modules]);

  /**
   * Main execution function - automatically selects the right method
   */
  const executeGasless = useCallback(async ({ calls }) => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    const config = CHAIN_CONFIG[chain.id];
    if (!config) {
      throw new Error(`Chain ${chain.id} not supported for gasless`);
    }

    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setStatus(STATUS.PREPARING);
    setIsLoading(true);

    try {
      console.log(`\n🎯 Gasless execution on ${config.name}`);
      console.log(`   Method: ${config.method}`);
      console.log(`   Address: ${address}`);

      let result;

      if (config.method === 'eip7702') {
        // Use EIP-7702 for Gnosis/Base
        result = await executeViaEIP7702({ calls });
      } else {
        // Use ERC-4337 for testnets
        result = await executeViaERC4337({ calls });
      }

      setStatus(STATUS.SUCCESS);
      setStatusMessage(`🎉 Gasless transaction successful! You paid $0 in gas!`);

      return result;

    } catch (err) {
      console.error('Gasless execution error:', err);

      let errorMessage = err.message;

      // Handle specific errors
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('EIP-7702 not supported')) {
        // Fallback to ERC-4337 if EIP-7702 fails
        console.log('⚠️ EIP-7702 not supported, falling back to ERC-4337...');
        try {
          const result = await executeViaERC4337({ calls });
          setStatus(STATUS.SUCCESS);
          setStatusMessage(`🎉 Gasless transaction successful via fallback!`);
          return result;
        } catch (fallbackErr) {
          errorMessage = fallbackErr.message;
        }
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Paymaster rejected: insufficient sponsorship funds';
      } else if (err.message?.includes('AA')) {
        // Account Abstraction specific errors
        errorMessage = `Smart Account error: ${err.message}`;
      }

      setError(errorMessage);
      setStatus(STATUS.ERROR);
      setStatusMessage(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, chain, walletClient, executeViaEIP7702, executeViaERC4337]);


  /**
   * Execute gasless ERC20 approval
   */
  const executeGaslessApproval = useCallback(async ({ tokenAddress, spender, amount }) => {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, BigInt(amount)]
    });

    return executeGasless({
      calls: [{ to: tokenAddress, data: approveData, value: 0n }]
    });
  }, [executeGasless]);

  /**
   * Execute gasless batch (approve + swap in one transaction)
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

    return executeGasless({
      calls: [
        { to: tokenAddress, data: approveData, value: 0n },
        { to: routerHub, data: swapCallData, value: 0n }
      ]
    });
  }, [executeGasless]);

  /**
   * Execute gasless swap only (when already approved)
   */
  const executeGaslessSwap = useCallback(async ({ routerHub, swapCallData }) => {
    return executeGasless({
      calls: [{ to: routerHub, data: swapCallData, value: 0n }]
    });
  }, [executeGasless]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setStatus(STATUS.IDLE);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
    setUserOpHash(null);
    setIsLoading(false);
  }, []);

  // Update gasless method when chain changes
  useEffect(() => {
    if (chain?.id) {
      const method = getGaslessMethod();
      setGaslessMethod(method);
    }
  }, [chain?.id, getGaslessMethod]);

  return {
    // Actions
    executeGasless,
    executeGaslessApproval,
    executeGaslessBatch,
    executeGaslessSwap,
    checkAvailability,
    reset,

    // State
    isLoading,
    status,
    statusMessage,
    error,
    txHash,
    userOpHash,
    smartAccountAddress,
    gaslessMethod,

    // Convenience flags
    isPreparing: status === STATUS.PREPARING,
    isSigning: status === STATUS.SIGNING,
    isSubmitting: status === STATUS.SUBMITTING,
    isConfirming: status === STATUS.CONFIRMING,
    isSuccess: status === STATUS.SUCCESS,
    isError: status === STATUS.ERROR,

    // Chain info
    currentChainId: chain?.id,
    supportedChains: CHAIN_CONFIG,
    isEIP7702: gaslessMethod === 'eip7702',
    isERC4337: gaslessMethod === 'erc4337',

    // Constants
    STATUS,
    CHAIN_CONFIG
  };
}

export { STATUS, CHAIN_CONFIG };
