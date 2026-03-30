/**
 * useSmartAccount - Hook for EIP-7702 Smart Account functionality
 * 
 * Based on MetaMask's official 7702-Readiness implementation.
 * Uses EIP-5792 wallet_sendCalls - MetaMask handles the 7702 upgrade automatically.
 */
import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';

// Pimlico paymaster configuration
const PIMLICO_API_KEY = import.meta.env.VITE_PIMLICO_API_KEY || '';

// Supported chains for 7702
const SUPPORTED_CHAINS = {
  11155111: { name: 'Sepolia', explorer: 'https://sepolia.etherscan.io' },
  80002: { name: 'Polygon Amoy', explorer: 'https://amoy.polygonscan.com' },
};

export function useSmartAccount() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isSmartAccount, setIsSmartAccount] = useState(false);
  const [capabilities, setCapabilities] = useState({});
  const [supportsAtomic, setSupportsAtomic] = useState(false);
  const [supportsPaymaster, setSupportsPaymaster] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Check if account has code (is upgraded to smart account)
  const checkIsSmartAccount = useCallback(async (ethersProvider, address) => {
    try {
      const code = await ethersProvider.getCode(address);
      return code !== '0x';
    } catch (err) {
      console.error('Error checking smart account status:', err);
      return false;
    }
  }, []);

  // Get wallet capabilities for the current chain
  const getCapabilities = useCallback(async (eipProvider, address, chainIdHex) => {
    try {
      const caps = await eipProvider.request({
        method: 'wallet_getCapabilities',
        params: [address, [chainIdHex]]
      });
      return caps[chainIdHex] || {};
    } catch (err) {
      console.error('Error getting capabilities:', err);
      return {};
    }
  }, []);

  // Update account state
  const updateAccountState = useCallback(async (eipProvider, address) => {
    const ethersProvider = new ethers.BrowserProvider(eipProvider);
    const network = await ethersProvider.getNetwork();
    const chainIdHex = await eipProvider.request({ method: 'eth_chainId' });
    const chainIdNum = parseInt(chainIdHex, 16);
    
    const isSmart = await checkIsSmartAccount(ethersProvider, address);
    const caps = await getCapabilities(eipProvider, address, chainIdHex);
    
    setChainId(chainIdNum);
    setIsSmartAccount(isSmart);
    setCapabilities(caps);
    setSupportsAtomic(!!caps.atomic);
    setSupportsPaymaster(!!caps.paymasterService);
    
    console.log('Account state updated:', {
      address,
      chainId: chainIdNum,
      chainName: network.name,
      isSmartAccount: isSmart,
      capabilities: caps,
      supportsAtomic: !!caps.atomic,
      supportsPaymaster: !!caps.paymasterService
    });
  }, [checkIsSmartAccount, getCapabilities]);

  // Connect wallet
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned');
      }

      setProvider(window.ethereum);
      setAccount(accounts[0]);
      await updateAccountState(window.ethereum, accounts[0]);

      // Listen for account/chain changes
      window.ethereum.on('accountsChanged', async (newAccounts) => {
        if (newAccounts.length > 0) {
          setAccount(newAccounts[0]);
          await updateAccountState(window.ethereum, newAccounts[0]);
        } else {
          disconnect();
        }
      });

      window.ethereum.on('chainChanged', async () => {
        await updateAccountState(window.ethereum, accounts[0]);
      });

    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [updateAccountState]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      if (provider) {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        });
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
    
    setProvider(null);
    setAccount('');
    setChainId(null);
    setIsSmartAccount(false);
    setCapabilities({});
    setSupportsAtomic(false);
    setSupportsPaymaster(false);
  }, [provider]);

  /**
   * Send batch transactions using EIP-5792 wallet_sendCalls
   * MetaMask will automatically prompt for 7702 upgrade if needed
   */
  const sendBatchCalls = useCallback(async (calls, options = {}) => {
    if (!provider || !account) {
      throw new Error('Wallet not connected');
    }

    const chainIdHex = `0x${chainId.toString(16)}`;
    
    // Build the sendCalls params
    const params = {
      version: '2.0.0',
      chainId: chainIdHex,
      from: account,
      atomicRequired: options.atomicRequired !== false, // default true
      calls: calls.map(call => ({
        to: call.to,
        value: call.value ? `0x${BigInt(call.value).toString(16)}` : '0x0',
        data: call.data || '0x'
      }))
    };

    // Add paymaster if supported and requested
    if (options.usePaymaster && supportsPaymaster && PIMLICO_API_KEY) {
      params.capabilities = {
        paymasterService: {
          url: `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`
        }
      };
    }

    console.log('Sending batch calls:', params);

    const result = await provider.request({
      method: 'wallet_sendCalls',
      params: [params]
    });

    console.log('wallet_sendCalls result:', result);
    return result;
  }, [provider, account, chainId, supportsPaymaster]);

  /**
   * Get status of a batch call
   */
  const getCallsStatus = useCallback(async (callId) => {
    if (!provider) {
      throw new Error('Wallet not connected');
    }

    const status = await provider.request({
      method: 'wallet_getCallsStatus',
      params: [callId]
    });

    return status;
  }, [provider]);

  /**
   * Wait for batch call to complete
   */
  const waitForCalls = useCallback(async (callId, timeout = 60000) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = await getCallsStatus(callId);
      
      if (status.status === 200) {
        return {
          success: true,
          receipts: status.receipts,
          txHash: status.receipts?.[0]?.transactionHash
        };
      }
      
      if (status.status >= 400) {
        return {
          success: false,
          error: status.error || 'Transaction failed'
        };
      }
      
      // Wait 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Transaction timeout');
  }, [getCallsStatus]);

  // Get explorer URL for transaction
  const getExplorerUrl = useCallback((txHash) => {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) return null;
    return `${chain.explorer}/tx/${txHash}`;
  }, [chainId]);

  return {
    // State
    account,
    chainId,
    chainName: SUPPORTED_CHAINS[chainId]?.name || 'Unknown',
    isConnected: !!account,
    isSmartAccount,
    capabilities,
    supportsAtomic,
    supportsPaymaster,
    isConnecting,
    error,
    
    // Actions
    connect,
    disconnect,
    sendBatchCalls,
    getCallsStatus,
    waitForCalls,
    getExplorerUrl,
    
    // Helpers
    isSupportedChain: !!SUPPORTED_CHAINS[chainId]
  };
}
