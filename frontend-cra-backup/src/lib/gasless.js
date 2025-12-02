/**
 * Gasless Transaction Utilities for ZeroToll
 * 
 * Uses permissionless.js with SimpleSmartAccount for gasless transactions
 * Note: EIP-7702 delegation is not persisted on Polygon Amoy, so we use
 * regular SimpleSmartAccount which creates a counterfactual smart wallet.
 */

import { http } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Pimlico configuration
const PIMLICO_API_KEY =
  import.meta.env?.VITE_PIMLICO_API_KEY ||
  process.env.REACT_APP_PIMLICO_API_KEY ||
  'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Supported chains
export const SUPPORTED_CHAINS = {
  80002: { name: 'Polygon Amoy', chain: polygonAmoy },
  11155111: { name: 'Ethereum Sepolia', chain: sepolia },
};

// EntryPoint v0.7 address
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Pimlico URLs per chain
export const getPimlicoUrl = (chainId) =>
  `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`;

/**
 * Check if Pimlico bundler is available for a chain
 */
export async function checkPimlicoAvailability(chainId) {
  try {
    const pimlicoUrl = getPimlicoUrl(chainId);

    console.log('🔍 Checking Pimlico health:', { chainId, url: pimlicoUrl });

    const response = await fetch(pimlicoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_supportedEntryPoints',
        params: [],
      }),
    });

    const data = await response.json();
    console.log('📡 Pimlico response:', data);

    if (data.result && data.result.length > 0) {
      console.log('✅ Pimlico available, entry points:', data.result);
      return { available: true, entryPoints: data.result };
    }

    return { available: false, entryPoints: [] };
  } catch (error) {
    console.error('❌ Pimlico health check failed:', error);
    return { available: false, entryPoints: [], error: error.message };
  }
}

/**
 * Create Pimlico client for bundler and paymaster
 */
export function createPimlicoBundlerClient(chainId) {
  const chain = SUPPORTED_CHAINS[chainId]?.chain;

  if (!chain) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  const pimlicoUrl = getPimlicoUrl(chainId);

  const pimlicoClient = createPimlicoClient({
    chain,
    transport: http(pimlicoUrl),
  });

  console.log('✅ Pimlico client created for chain', chainId);

  return {
    pimlicoClient,
    bundlerUrl: pimlicoUrl,
    chain,
  };
}

/**
 * Create a SimpleSmartAccount for gasless transactions
 * This creates a counterfactual smart contract wallet address
 */
export async function createGaslessAccount(owner, publicClient, chainId) {
  console.log('🔧 Creating gasless smart account...', { chainId });

  const chain = SUPPORTED_CHAINS[chainId]?.chain;
  if (!chain) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  try {
    // Create SimpleSmartAccount with EntryPoint v0.7
    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: owner,
      entryPoint: {
        address: ENTRY_POINT_V07,
        version: '0.7',
      },
    });

    console.log('✅ Gasless smart account created:', smartAccount.address);
    console.log('   Owner EOA:', owner.address);

    return smartAccount;
  } catch (error) {
    console.error('❌ Failed to create gasless account:', error);
    throw error;
  }
}

/**
 * Execute gasless transaction using permissionless.js
 */
export async function executeGaslessTransaction(
  smartAccount,
  calls,
  chainId
) {
  try {
    console.log('🚀 Executing gasless transaction...', { calls: calls.length });

    const chain = SUPPORTED_CHAINS[chainId]?.chain;
    const pimlicoUrl = getPimlicoUrl(chainId);

    // Create Pimlico client
    const pimlicoClient = createPimlicoClient({
      chain,
      transport: http(pimlicoUrl),
    });

    // Create smart account client
    const smartAccountClient = createSmartAccountClient({
      account: smartAccount,
      chain,
      bundlerTransport: http(pimlicoUrl),
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrices = await pimlicoClient.getUserOperationGasPrice();
          return gasPrices.fast;
        },
      },
    });

    console.log('✅ Smart account client created');

    let transactionHash;

    // Send transaction
    console.log('🔄 Sending gasless transaction...');

    if (calls.length === 1) {
      transactionHash = await smartAccountClient.sendTransaction({
        to: calls[0].to,
        value: calls[0].value || 0n,
        data: calls[0].data || '0x',
      });
    } else {
      transactionHash = await smartAccountClient.sendTransaction({
        calls: calls.map((call) => ({
          to: call.to,
          value: call.value || 0n,
          data: call.data || '0x',
        })),
      });
    }

    console.log('✅ Transaction sent:', transactionHash);
    return transactionHash;
  } catch (error) {
    console.error('❌ Gasless transaction failed:', error);
    throw error;
  }
}

/**
 * Check if chain is supported for gasless
 */
export function isChainSupported(chainId) {
  return !!SUPPORTED_CHAINS[chainId];
}

/**
 * Get chain configuration
 */
export function getChainConfig(chainId) {
  return SUPPORTED_CHAINS[chainId] || null;
}
