/**
 * useTrueGaslessSwapV2 Hook - TRUE EIP-7702 Gasless Transactions
 * 
 * This implementation follows MetaMask's official documentation.
 * Uses dynamic imports to avoid webpack bundling issues with @metamask/smart-accounts-kit
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { http, encodeFunctionData, parseAbi } from 'viem';

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

// Pimlico API Key
const PIMLICO_API_KEY = process.env.REACT_APP_PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

const SUPPORTED_CHAINS = {
  80002: { 
    name: 'Polygon Amoy',
    explorer: 'https://amoy.polygonscan.com',
    pimlicoRpc: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`
  },
  11155111: { 
    name: 'Ethereum Sepolia',
    explorer: 'https://sepolia.etherscan.io',
    pimlicoRpc: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`
  },
};

export function useTrueGaslessSwapV2() {
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
  
  // Cache for dynamically imported modules
  const modulesRef = useRef(null);

  /**
   * Dynamically load the required modules
   */
  const loadModules = useCallback(async () => {
    if (modulesRef.current) return modulesRef.current;
    
    try {
      const [
        { createBundlerClient, entryPoint07Address },
        { createPimlicoClient },
        { toMetaMaskSmartAccount }
      ] = await Promise.all([
        import('viem/account-abstraction'),
        import('permissionless/clients/pimlico'),
        import('@metamask/smart-accounts-kit')
      ]);
      
      modulesRef.current = {
        createBundlerClient,
        entryPoint07Address,
        createPimlicoClient,
        toMetaMaskSmartAccount
      };
      
      return modulesRef.current;
    } catch (err) {
      console.error('Failed to load modules:', err);
      throw new Error('Failed to load gasless transaction modules');
    }
  }, []);

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

  useEffect(() => {
    if (address && publicClient) {
      checkSmartAccountStatus();
    }
  }, [address, publicClient, chain?.id, checkSmartAccountStatus]);

  /**
   * Execute a gasless transaction using MetaMask Smart Accounts Kit
   */
  const executeGaslessSwap = useCallback(async ({ calls }) => {
    if (!address || !chain || !walletClient || !publicClient) {
      throw new Error('Wallet not connected');
    }

    const chainConfig = SUPPORTED_CHAINS[chain.id];
    if (!chainConfig) {
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
      setStatusMessage('Loading gasless modules...');
      
      // Dynamically load modules
      const modules = await loadModules();
      const { createBundlerClient, entryPoint07Address, createPimlicoClient, toMetaMaskSmartAccount } = modules;

      setStatusMessage('Creating Smart Account instance...');
      console.log('📡 Creating MetaMask Smart Account...');
      console.log('   Address:', address);
      console.log('   Chain:', chain.id);

      // Step 1: Create MetaMask Smart Account with walletClient signer
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: 'Stateless7702',
        address: address,
        signer: { walletClient }
      });

      console.log('✅ Smart Account created');

      // Step 2: Create Pimlico paymaster client
      setStatusMessage('Setting up paymaster...');
      const pimlicoClient = createPimlicoClient({
        chain: chain,
        transport: http(chainConfig.pimlicoRpc),
        entryPoint: {
          address: entryPoint07Address,
          version: '0.7'
        }
      });

      console.log('✅ Pimlico client created');

      // Step 3: Create Bundler client with paymaster
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

      console.log('✅ Bundler client created');

      // Step 4: Prepare calls
      const preparedCalls = calls.map(c => ({
        to: c.to,
        data: c.data || '0x',
        value: BigInt(c.value || 0)
      }));

      console.log('📤 Sending UserOperation...');
      console.log('   Calls:', preparedCalls.length);

      setStatus('signing');
      setStatusMessage('Please confirm in MetaMask (NO GAS!)...');

      // Step 5: Send UserOperation
      const hash = await bundlerClient.sendUserOperation({
        calls: preparedCalls
      });

      console.log('✅ UserOp submitted:', hash);
      setUserOpHash(hash);

      setStatus('submitting');
      setStatusMessage('Waiting for confirmation...');

      // Step 6: Wait for receipt
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash,
        timeout: 120000
      });

      console.log('✅ Transaction confirmed!');
      console.log('   TX Hash:', receipt.receipt.transactionHash);
      console.log('   Success:', receipt.success);

      setTxHash(receipt.receipt.transactionHash);
      
      if (receipt.success) {
        setStatus('success');
        setStatusMessage('🎉 GASLESS transaction successful! You paid $0 in gas!');
        console.log('🎉 GASLESS SUCCESS!');
      } else {
        setStatus('error');
        setError('Transaction failed on-chain');
        setStatusMessage('Transaction failed');
      }

      return {
        success: receipt.success,
        receipt: receipt.receipt,
        userOpHash: hash,
        explorerUrl: `${chainConfig.explorer}/tx/${receipt.receipt.transactionHash}`
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
  }, [address, chain, walletClient, publicClient, checkSmartAccountStatus, loadModules]);

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
