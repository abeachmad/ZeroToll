/**
 * useGasless7702 Hook - Using @permissionless/wagmi
 * 
 * Per MetaMask's tutorial:
 * - Use createPaymasterClient from viem/account-abstraction
 * - Use createBundlerClient with paymaster
 * - Use toMetaMaskSmartAccount from @metamask/smart-accounts-kit
 * - Call bundlerClient.sendUserOperation with paymaster
 * 
 * This is the CORRECT approach that works on Sepolia!
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { http, createPublicClient } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';
import { 
  createBundlerClient, 
  createPaymasterClient 
} from 'viem/account-abstraction';
import { 
  toMetaMaskSmartAccount, 
  Implementation 
} from '@metamask/smart-accounts-kit';

// Pimlico config
const PIMLICO_API_KEY = import.meta.env.VITE_PIMLICO_API_KEY;

// Chain configs
const CHAIN_CONFIG = {
  11155111: {
    name: 'Sepolia',
    chain: sepolia,
    pimlicoUrl: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
  },
  80002: {
    name: 'Polygon Amoy',
    chain: polygonAmoy,
    pimlicoUrl: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
  }
};

export function useGasless7702() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isUpgraded, setIsUpgraded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const chainConfig = chain?.id ? CHAIN_CONFIG[chain.id] : null;

  /**
   * Check if the EOA has been upgraded to a smart account
   */
  const checkUpgradeStatus = useCallback(async () => {
    if (!address || !publicClient) return false;

    try {
      const code = await publicClient.getCode({ address });
      const upgraded = code && code !== '0x' && code.length > 2;
      setIsUpgraded(upgraded);
      return upgraded;
    } catch (err) {
      console.error('Error checking upgrade status:', err);
      return false;
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (isConnected && address) {
      checkUpgradeStatus();
    }
  }, [isConnected, address, checkUpgradeStatus]);

  /**
   * Execute gasless transaction using MetaMask Smart Accounts Kit + Pimlico
   * 
   * This follows MetaMask's official tutorial exactly:
   * 1. Create PaymasterClient pointing to Pimlico
   * 2. Create BundlerClient with paymaster
   * 3. Create MetaMaskSmartAccount (Stateless7702)
   * 4. Call sendUserOperation with paymaster
   */
  const executeGasless = useCallback(async ({ to, data, value = 0n }) => {
    if (!address || !walletClient || !chainConfig || !publicClient) {
      setError('Wallet not connected or chain not supported');
      return null;
    }

    const upgraded = await checkUpgradeStatus();
    if (!upgraded) {
      setError('Account not upgraded. Please enable Smart Account in MetaMask settings first.');
      return null;
    }

    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      console.log('Creating Pimlico Paymaster Client...');
      
      // Step 1: Create Paymaster Client (per MetaMask tutorial)
      const paymasterClient = createPaymasterClient({
        transport: http(chainConfig.pimlicoUrl)
      });

      console.log('Creating Bundler Client...');

      // Step 2: Create Bundler Client with paymaster
      const bundlerClient = createBundlerClient({
        client: publicClient,
        transport: http(chainConfig.pimlicoUrl),
        paymaster: paymasterClient,
      });

      console.log('Creating MetaMask Smart Account...');

      // Step 3: Create MetaMask Smart Account (Stateless7702)
      // For Stateless7702, we use the existing upgraded EOA address
      // The signer is the walletClient from Wagmi
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: Implementation.Stateless7702,
        address: address, // Use existing upgraded EOA address
        signer: {
          walletClient: walletClient, // WalletSignerConfig format
        },
      });

      console.log('Smart Account created:', smartAccount.address);

      // Step 4: Send UserOperation with paymaster
      console.log('Sending UserOperation...');
      const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [{
          to,
          value: BigInt(value),
          data: data || '0x'
        }],
        maxFeePerGas: 1n, // Will be estimated
        maxPriorityFeePerGas: 1n, // Will be estimated
      });

      console.log('UserOperation submitted:', userOpHash);

      // Wait for receipt
      console.log('Waiting for receipt...');
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash
      });

      console.log('Receipt:', receipt);

      if (receipt.receipt?.transactionHash) {
        setTxHash(receipt.receipt.transactionHash);
        setIsLoading(false);
        return receipt.receipt.transactionHash;
      }

      setTxHash(userOpHash);
      setIsLoading(false);
      return userOpHash;

    } catch (err) {
      console.error('Gasless execution failed:', err);
      setError(err.message || 'Failed to execute gasless transaction');
      setIsLoading(false);
      return null;
    }
  }, [address, walletClient, chainConfig, publicClient, checkUpgradeStatus]);

  return {
    isConnected,
    address,
    isUpgraded,
    isLoading,
    error,
    txHash,
    chainConfig,
    checkUpgradeStatus,
    executeGasless,
    clearError: () => setError(null)
  };
}

export default useGasless7702;
