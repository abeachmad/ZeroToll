/**
 * React Hook for EIP-7702 Smart Account Management
 * 
 * Uses viem's built-in account abstraction features
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { toast } from 'sonner';
import {
  isSmartAccount,
  create7702SmartAccount,
  createPimlicoBundlerClient,
  executeGaslessTransaction,
  checkPimlicoAvailability,
  checkWalletCapabilities,
  SUPPORTED_CHAINS,
} from '../lib/eip7702';

export function useSmartAccount() {
  const { address, isConnected, chain } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [smartAccountStatus, setSmartAccountStatus] = useState({
    isChecking: true,
    isSmartAccount: false,
    delegatorAddress: null,
    smartAccount: null,
    bundlerClient: null,
  });
  
  const [pimlicoAvailable, setPimlicoAvailable] = useState(false);
  const [walletCaps, setWalletCaps] = useState({
    supportsBatching: false,
    supportsPaymaster: false,
    supportsEip7702: false,
  });
  
  // Check if address is a smart account
  const checkSmartAccount = useCallback(async () => {
    if (!address || !publicClient || !chain) {
      setSmartAccountStatus({
        isChecking: false,
        isSmartAccount: false,
        delegatorAddress: null,
        smartAccount: null,
        bundlerClient: null,
      });
      return;
    }
    
    try {
      setSmartAccountStatus(prev => ({ ...prev, isChecking: true }));
      
      const result = await isSmartAccount(address, chain.id, publicClient);
      
      let smartAccount = null;
      let bundlerClient = null;
      
      // Create smart account wrapper if wallet is connected
      if (SUPPORTED_CHAINS[chain.id]) {
        try {
          // Create bundler client first (doesn't need walletClient)
          try {
            const clients = createPimlicoBundlerClient(chain.id, publicClient);
            bundlerClient = clients;
            console.log('✅ Bundler client created');
          } catch (bundlerError) {
            console.error('Failed to create bundler client:', bundlerError);
          }
          
          // Create smart account wrapper if walletClient is available
          if (walletClient) {
            console.log('🔧 Creating smart account wrapper for chain:', chain.id);
            
            smartAccount = await create7702SmartAccount(
              walletClient,
              publicClient,
              chain.id
            );
            
            console.log('✅ Smart account wrapper created:', smartAccount?.address);
          } else {
            console.log('⚠️ WalletClient not ready yet, will retry...');
          }
        } catch (error) {
          console.error('Failed to create smart account:', error);
        }
      } else {
        console.log('⚠️ Cannot create smart account:', {
          hasWalletClient: !!walletClient,
          chainSupported: !!SUPPORTED_CHAINS[chain?.id],
          chainId: chain?.id,
        });
      }
      
      // Check if gasless is supported
      // - Fresh EOAs: YES (will be upgraded to SimpleSmartAccount on first tx)
      // - SimpleSmartAccount: YES
      // - MetaMask Delegator: NO (MetaMask disabled signing)
      const gaslessSupported = result.gaslessSupported !== false;
      
      if (result.isMetaMaskDelegator) {
        console.warn('⚠️ MetaMask StatelessDeleGator detected - gasless NOT supported');
        toast.error('Your account uses MetaMask delegation which currently does not support gasless transactions. MetaMask has disabled this feature in their wallet.', {
          duration: 10000,
        });
      } else if (result.isFreshEOA) {
        console.log('✅ Fresh EOA - gasless supported (will upgrade to SimpleSmartAccount)');
      } else if (result.isSmartAccount && gaslessSupported) {
        console.log('✅ Smart account with gasless support detected');
      }
      
      setSmartAccountStatus({
        isChecking: false,
        isSmartAccount: result.isSmartAccount,
        isFreshEOA: result.isFreshEOA || false,
        delegatorAddress: result.delegatorAddress,
        isMetaMaskDelegator: result.isMetaMaskDelegator || false,
        gaslessSupported,
        smartAccount: gaslessSupported ? smartAccount : null,
        bundlerClient: gaslessSupported ? bundlerClient : null,
      });
    } catch (error) {
      console.error('Error checking smart account:', error);
      setSmartAccountStatus({
        isChecking: false,
        isSmartAccount: false,
        delegatorAddress: null,
        smartAccount: null,
        bundlerClient: null,
      });
    }
  }, [address, publicClient, walletClient, chain]);
  
  // Check Pimlico availability
  const checkPimlico = useCallback(async () => {
    if (!chain) {
      console.log('⚠️ No chain connected, skipping Pimlico check');
      return;
    }
    
    console.log('🔍 Checking Pimlico for chain:', chain.id);
    
    try {
      const health = await checkPimlicoAvailability(chain.id);
      setPimlicoAvailable(health.available);
      
      if (health.available) {
        console.log('✅ Pimlico available for chain', chain.id, 'Entry points:', health.entryPoints);
      } else {
        console.warn('⚠️ Pimlico not available:', health.error);
        // Retry once after 2 seconds
        setTimeout(async () => {
          console.log('🔄 Retrying Pimlico health check...');
          const retryHealth = await checkPimlicoAvailability(chain.id);
          setPimlicoAvailable(retryHealth.available);
          if (retryHealth.available) {
            console.log('✅ Pimlico available on retry');
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Pimlico health check failed:', error);
      setPimlicoAvailable(false);
    }
  }, [chain]);

  
  // Send gasless transaction
  const sendGaslessTransaction = useCallback(async (calls) => {
    let { smartAccount, bundlerClient } = smartAccountStatus;
    
    // If smart account not ready but we have walletClient, create it now
    if (!smartAccount && walletClient && SUPPORTED_CHAINS[chain?.id]) {
      console.log('🔧 Creating smart account on-demand...');
      try {
        smartAccount = await create7702SmartAccount(walletClient, publicClient, chain.id);
        console.log('✅ Smart account created on-demand:', smartAccount?.address);
      } catch (error) {
        console.error('Failed to create smart account on-demand:', error);
        throw new Error('Failed to create smart account. Please try again.');
      }
    }
    
    if (!smartAccount) {
      throw new Error('Smart account not ready. Please connect your wallet.');
    }
    
    if (!pimlicoAvailable) {
      throw new Error('Pimlico bundler not available');
    }
    
    console.log('🚀 Sending gasless transaction...', { calls: calls.length });
    
    try {
      const txHash = await executeGaslessTransaction(
        smartAccount,
        calls,
        bundlerClient,
        publicClient,
        chain.id,
        walletClient // Pass wallet client for EIP-7702 authorization signing
      );
      
      console.log('✅ Transaction submitted:', txHash);
      return txHash;
      
    } catch (error) {
      console.error('❌ Gasless transaction failed:', error);
      throw error;
    }
  }, [smartAccountStatus, pimlicoAvailable, publicClient, chain, walletClient]);
  
  // Check on mount and when dependencies change
  useEffect(() => {
    if (isConnected && address && publicClient) {
      checkSmartAccount();
      checkPimlico();
    }
  }, [isConnected, address, publicClient, walletClient, checkSmartAccount, checkPimlico]);
  
  // Computed: is gasless ready?
  // Requires: Pimlico available AND (smart account wrapper OR fresh EOA with wallet connected)
  // Works for: Fresh EOAs (will upgrade) OR existing SimpleSmartAccount
  // Does NOT work for: MetaMask StatelessDeleGator
  const isGaslessReady = pimlicoAvailable && 
                         (!!smartAccountStatus.smartAccount || (smartAccountStatus.isFreshEOA && !!walletClient)) && 
                         smartAccountStatus.gaslessSupported !== false;
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 Gasless ready status:', {
      pimlicoAvailable,
      hasSmartAccount: !!smartAccountStatus.smartAccount,
      gaslessSupported: smartAccountStatus.gaslessSupported,
      isMetaMaskDelegator: smartAccountStatus.isMetaMaskDelegator,
      isGaslessReady,
      chainId: chain?.id,
    });
  }, [pimlicoAvailable, smartAccountStatus, isGaslessReady, chain]);
  
  return {
    // Status
    isChecking: smartAccountStatus.isChecking,
    isSmartAccount: smartAccountStatus.isSmartAccount,
    isFreshEOA: smartAccountStatus.isFreshEOA || false,
    delegatorAddress: smartAccountStatus.delegatorAddress,
    isMetaMaskDelegator: smartAccountStatus.isMetaMaskDelegator || false,
    gaslessSupported: smartAccountStatus.gaslessSupported !== false,
    
    // Clients
    smartAccount: smartAccountStatus.smartAccount,
    bundlerClient: smartAccountStatus.bundlerClient,
    
    // Wallet capabilities
    walletCaps,
    
    // Pimlico
    pimlicoAvailable,
    
    // Actions
    sendGaslessTransaction,
    refresh: checkSmartAccount,
    
    // Computed
    isGaslessReady,
    
    // Legacy compatibility
    smartAccountClient: smartAccountStatus.smartAccount,
    pimlicoClient: smartAccountStatus.bundlerClient,
    isMetaMaskSmartAccount: smartAccountStatus.isSmartAccount,
    canUpgrade: isConnected && !smartAccountStatus.isSmartAccount && pimlicoAvailable,
    isUpgrading: false,
    upgrade: async () => {
      toast.info('Account will be upgraded on first gasless transaction');
      return { success: true };
    },
  };
}
