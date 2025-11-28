/**
 * useGaslessSwap Hook
 * 
 * React hook for executing gasless swaps using EIP-7702 + Pimlico
 */

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import {
  create7702SmartAccount,
  executeGaslessTransaction,
  checkPimlicoAvailability,
  SUPPORTED_CHAINS
} from '../lib/eip7702';

export function useGaslessSwap() {
  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  /**
   * Check if gasless swaps are available
   */
  const checkAvailability = useCallback(async () => {
    try {
      if (!chain?.id || !SUPPORTED_CHAINS[chain.id]) {
        return { available: false, policyServer: false, bundler: false };
      }
      
      const health = await checkPimlicoAvailability(chain.id);
      return {
        available: health.available,
        policyServer: true, // Not needed with Pimlico
        bundler: health.available
      };
    } catch (err) {
      console.error('Availability check failed:', err);
      return { available: false, policyServer: false, bundler: false };
    }
  }, [chain]);

  /**
   * Execute a gasless swap
   */
  const executeSwap = useCallback(async ({ routerHub, swapCallData }) => {
    if (!address || !walletClient || !publicClient || !chain) {
      throw new Error('Wallet not connected');
    }

    if (!SUPPORTED_CHAINS[chain.id]) {
      throw new Error(`Chain ${chain.id} not supported for gasless swaps`);
    }

    setIsLoading(true);
    setError(null);
    setStatus('preparing');
    setStatusMessage('Preparing gasless transaction...');

    try {
      // Check availability
      const availability = await checkAvailability();
      if (!availability.available) {
        throw new Error('Pimlico bundler not available');
      }

      // Create EIP-7702 smart account (keeps your EOA address!)
      setStatus('creating');
      setStatusMessage('Creating smart account...');
      
      const smartAccount = await create7702SmartAccount(
        walletClient,
        publicClient,
        chain.id
      );
      
      console.log('✅ Smart account:', smartAccount.address);
      console.log('   Your EOA:', address);

      // Prepare the call
      const calls = [{
        to: routerHub,
        value: 0n,
        data: swapCallData
      }];

      // Execute gasless transaction
      setStatus('executing');
      setStatusMessage('Executing gasless swap...');
      
      const transactionHash = await executeGaslessTransaction(
        smartAccount,
        calls,
        null, // bundlerClient - will be created inside
        publicClient,
        chain.id,
        walletClient
      );

      setTxHash(transactionHash);
      setStatus('success');
      setStatusMessage('Swap completed successfully!');
      setIsLoading(false);

      return transactionHash;

    } catch (err) {
      console.error('Gasless swap error:', err);
      setError(err.message);
      setStatus('error');
      setStatusMessage(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [address, walletClient, publicClient, chain, checkAvailability]);

  /**
   * Execute a gasless approval
   */
  const executeApproval = useCallback(async ({ tokenAddress, spender, amount }) => {
    if (!address || !walletClient || !publicClient || !chain) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);
    setStatus('approving');
    setStatusMessage('Approving token...');

    try {
      const smartAccount = await create7702SmartAccount(
        walletClient,
        publicClient,
        chain.id
      );

      // ERC20 approve call
      const approveData = `0x095ea7b3${spender.slice(2).padStart(64, '0')}${BigInt(amount).toString(16).padStart(64, '0')}`;
      
      const calls = [{
        to: tokenAddress,
        value: 0n,
        data: approveData
      }];

      const transactionHash = await executeGaslessTransaction(
        smartAccount,
        calls,
        null,
        publicClient,
        chain.id,
        walletClient
      );

      setTxHash(transactionHash);
      setStatus('success');
      setStatusMessage('Approval completed!');
      setIsLoading(false);

      return transactionHash;

    } catch (err) {
      console.error('Gasless approval error:', err);
      setError(err.message);
      setStatus('error');
      setStatusMessage(err.message);
      setIsLoading(false);
      throw err;
    }
  }, [address, walletClient, publicClient, chain]);

  return {
    executeSwap,
    executeApproval,
    checkAvailability,
    isLoading,
    status,
    statusMessage,
    error,
    txHash,
    reset: useCallback(() => {
      setIsLoading(false);
      setStatus(null);
      setStatusMessage('');
      setError(null);
      setTxHash(null);
    }, [])
  };
}
