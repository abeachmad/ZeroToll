/**
 * useGaslessSmartAccount - Hook for EIP-7702 Smart Account with Pimlico Paymaster
 * 
 * Uses wallet_sendCalls with paymasterService capability for gasless transactions
 */
import { useState, useCallback } from 'react';
import { createPublicClient, http } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';

// Chain configurations
const CHAINS = {
  11155111: sepolia,
  80002: polygonAmoy
};

const CHAIN_NAMES = {
  11155111: 'Sepolia',
  80002: 'Polygon Amoy'
};

const EXPLORERS = {
  11155111: 'https://sepolia.etherscan.io',
  80002: 'https://amoy.polygonscan.com'
};

// Pimlico API key from env
const PIMLICO_API_KEY = import.meta.env.VITE_PIMLICO_API_KEY || '';

// Get Pimlico RPC URL for a chain
const getPimlicoUrl = (chainId) => {
  return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`;
};

export function useGaslessSmartAccount() {
  const [account, setAccount] = useState('');
  const [chainId, setChainId] = useState(null);
  const [isSmartAccount, setIsSmartAccount] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [capabilities, setCapabilities] = useState({});

  // Check if EOA has code (is upgraded)
  const checkIsSmartAccount = useCallback(async (address, chainIdNum) => {
    try {
      const chain = CHAINS[chainIdNum];
      if (!chain) return false;
      
      const publicClient = createPublicClient({
        chain,
        transport: http()
      });
      
      const code = await publicClient.getCode({ address });
      return code && code !== '0x';
    } catch (err) {
      console.error('Error checking smart account:', err);
      return false;
    }
  }, []);

  // Get wallet capabilities
  const getCapabilities = useCallback(async (address, chainIdHex) => {
    try {
      const caps = await window.ethereum.request({
        method: 'wallet_getCapabilities',
        params: [address, [chainIdHex]]
      });
      return caps[chainIdHex] || {};
    } catch (err) {
      console.error('Error getting capabilities:', err);
      return {};
    }
  }, []);

  // Refresh state
  const refreshState = useCallback(async (addr, chainNum) => {
    const chainHex = `0x${chainNum.toString(16)}`;
    const isSmart = await checkIsSmartAccount(addr, chainNum);
    const caps = await getCapabilities(addr, chainHex);
    
    setIsSmartAccount(isSmart);
    setCapabilities(caps);
    
    console.log('State refreshed:', { addr, chainNum, isSmart, caps });
    return { isSmart, caps };
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

      if (!accounts?.length) {
        throw new Error('No accounts returned');
      }

      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdNum = parseInt(chainIdHex, 16);
      
      setAccount(accounts[0]);
      setChainId(chainIdNum);
      setIsConnected(true);
      
      await refreshState(accounts[0], chainIdNum);

      // Listen for changes
      window.ethereum.on('accountsChanged', async (newAccounts) => {
        if (newAccounts.length > 0) {
          setAccount(newAccounts[0]);
          const currentChainHex = await window.ethereum.request({ method: 'eth_chainId' });
          await refreshState(newAccounts[0], parseInt(currentChainHex, 16));
        } else {
          disconnect();
        }
      });

      window.ethereum.on('chainChanged', async (newChainIdHex) => {
        const newChainIdNum = parseInt(newChainIdHex, 16);
        setChainId(newChainIdNum);
      });

    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [refreshState]);

  // Disconnect
  const disconnect = useCallback(() => {
    setAccount('');
    setChainId(null);
    setIsSmartAccount(false);
    setIsConnected(false);
    setCapabilities({});
    setError(null);
  }, []);

  // Upgrade to Smart Account
  const upgradeToSmartAccount = useCallback(async () => {
    if (!account || !chainId) throw new Error('Not connected');

    const chainIdHex = `0x${chainId.toString(16)}`;
    
    const result = await window.ethereum.request({
      method: 'wallet_sendCalls',
      params: [{
        version: '2.0.0',
        chainId: chainIdHex,
        from: account,
        atomicRequired: true,
        calls: [{ to: account, value: '0x0', data: '0x' }]
      }]
    });

    // Poll for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const status = await window.ethereum.request({
          method: 'wallet_getCallsStatus',
          params: [result.id]
        });
        if (status.status === 200) {
          const { isSmart } = await refreshState(account, chainId);
          return { success: true, isSmartAccount: isSmart, txHash: status.receipts?.[0]?.transactionHash };
        }
        if (status.status >= 400) throw new Error(status.error || 'Failed');
      } catch (err) {
        if (!err.message?.includes('not found')) throw err;
      }
    }
    throw new Error('Timeout');
  }, [account, chainId, refreshState]);

  // Send gasless batch
  const sendGaslessBatch = useCallback(async (calls, options = {}) => {
    if (!account || !chainId) throw new Error('Not connected');

    const chainIdHex = `0x${chainId.toString(16)}`;
    
    const params = {
      version: '2.0.0',
      chainId: chainIdHex,
      from: account,
      atomicRequired: options.atomicRequired !== false,
      calls: calls.map(c => ({
        to: c.to,
        value: c.value ? `0x${BigInt(c.value).toString(16)}` : '0x0',
        data: c.data || '0x'
      }))
    };

    // Add paymaster if we have API key
    if (PIMLICO_API_KEY) {
      params.capabilities = {
        paymasterService: { url: getPimlicoUrl(chainId) }
      };
    }

    console.log('Sending:', params);

    const result = await window.ethereum.request({
      method: 'wallet_sendCalls',
      params: [params]
    });

    // Poll for completion
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const status = await window.ethereum.request({
          method: 'wallet_getCallsStatus',
          params: [result.id]
        });
        if (status.status === 200) {
          const txHash = status.receipts?.[0]?.transactionHash;
          await refreshState(account, chainId);
          return { success: true, txHash, explorerUrl: `${EXPLORERS[chainId]}/tx/${txHash}` };
        }
        if (status.status >= 400) throw new Error(status.error || 'Failed');
      } catch (err) {
        if (!err.message?.includes('not found')) throw err;
      }
    }
    throw new Error('Timeout');
  }, [account, chainId, refreshState]);

  return {
    account, chainId, chainName: CHAIN_NAMES[chainId] || 'Unknown',
    isConnected, isSmartAccount, isConnecting, error, capabilities,
    supportsAtomic: !!capabilities?.atomic,
    supportsPaymaster: !!capabilities?.paymasterService?.supported,
    isSupportedChain: !!CHAINS[chainId],
    hasPimlicoKey: !!PIMLICO_API_KEY,
    explorerUrl: EXPLORERS[chainId],
    connect, disconnect, upgradeToSmartAccount, sendGaslessBatch,
    refreshState: () => account && chainId ? refreshState(account, chainId) : Promise.resolve()
  };
}
