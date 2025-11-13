/**
 * useGaslessSwap Hook
 * 
 * React hook for executing gasless swaps using Account Abstraction (ERC-4337)
 */

import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import {
  executeGaslessSwap,
  executeGaslessApproval,
  checkPolicyServerHealth,
  checkBundlerHealth,
  getSmartAccountAddress
} from '../lib/accountAbstraction';

export function useGaslessSwap() {
  const { address, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  
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
      const [policyServerOk, bundlerOk] = await Promise.all([
        checkPolicyServerHealth(),
        checkBundlerHealth()
      ]);

      return {
        available: policyServerOk && bundlerOk,
        policyServer: policyServerOk,
        bundler: bundlerOk
      };
    } catch (err) {
      console.error('Availability check failed:', err);
      return {
        available: false,
        policyServer: false,
        bundler: false
      };
    }
  }, []);

  /**
   * Execute a gasless swap
   * 
   * @param {Object} params
   * @param {string} params.routerHub - RouterHub contract address
   * @param {string} params.swapCallData - Encoded executeRoute call
   * @returns {Promise<string>} Transaction hash
   */
  const executeSwap = useCallback(async ({ routerHub, swapCallData }) => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setStatus('building');
    setStatusMessage('Preparing gasless swap...');

    try {
      // Check availability first
      const availability = await checkAvailability();
      if (!availability.available) {
        const missing = [];
        if (!availability.policyServer) missing.push('Policy Server');
        if (!availability.bundler) missing.push('Bundler');
        throw new Error(`Services unavailable: ${missing.join(', ')}`);
      }

      // Get smart account address
      const smartAccount = getSmartAccountAddress(address);

      // Create ethers provider and signer from wagmi
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();

      // Status update callback
      const onStatusUpdate = (newStatus, message) => {
        setStatus(newStatus);
        setStatusMessage(message);
      };

      // Execute gasless swap
      const transactionHash = await executeGaslessSwap({
        smartAccount,
        routerHub,
        swapCallData,
        chainId: chain.id,
        provider,
        signer,
        onStatusUpdate
      });

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
  }, [address, chain, walletClient, checkAvailability]);

  /**
   * Execute a gasless token approval
   * 
   * @param {Object} params
   * @param {string} params.tokenAddress - ERC20 token address
   * @param {string} params.spenderAddress - Spender address (RouterHub)
   * @param {string} params.amount - Amount to approve
   * @returns {Promise<string>} Transaction hash
   */
  const executeApproval = useCallback(async ({ tokenAddress, spenderAddress, amount }) => {
    if (!address || !chain || !walletClient) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);
    setStatus('building');
    setStatusMessage('Preparing gasless approval...');

    try {
      // Check availability first
      const availability = await checkAvailability();
      if (!availability.available) {
        const missing = [];
        if (!availability.policyServer) missing.push('Policy Server');
        if (!availability.bundler) missing.push('Bundler');
        throw new Error(`Services unavailable: ${missing.join(', ')}`);
      }

      // Get smart account address
      const smartAccount = getSmartAccountAddress(address);

      // Create ethers provider and signer from wagmi
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();

      // Status update callback
      const onStatusUpdate = (newStatus, message) => {
        setStatus(newStatus);
        setStatusMessage(message);
      };

      // Execute gasless approval
      const transactionHash = await executeGaslessApproval({
        smartAccount,
        tokenAddress,
        spenderAddress,
        amount,
        chainId: chain.id,
        provider,
        signer,
        onStatusUpdate
      });

      setTxHash(transactionHash);
      setStatus('success');
      setStatusMessage('Approval completed (no gas fee)!');
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
  }, [address, chain, walletClient, checkAvailability]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setStatus(null);
    setStatusMessage('');
    setError(null);
    setTxHash(null);
  }, []);

  return {
    executeSwap,
    executeApproval,
    checkAvailability,
    reset,
    isLoading,
    status,
    statusMessage,
    error,
    txHash,
    // Convenience flags
    isBuilding: status === 'building',
    isRequesting: status === 'requesting',
    isSponsoring: status === 'sponsoring',
    isSigning: status === 'signing',
    isSubmitting: status === 'submitting',
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error'
  };
}
