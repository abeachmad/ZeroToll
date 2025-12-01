/**
 * EIP-7702 Utilities for ZeroToll
 * 
 * Helper functions for EIP-7702 gasless transactions.
 * 
 * For browser users with MetaMask:
 * - Use the useGaslessSwap hook which uses Wagmi's useSendCalls
 * - MetaMask handles the EIP-7702 upgrade automatically
 * 
 * For testing with private key:
 * - Use the functions in this file with @metamask/delegation-toolkit
 */

import { http, encodeFunctionData, parseAbi } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';

// Supported chains for EIP-7702
export const SUPPORTED_CHAINS = {
  80002: { name: 'Polygon Amoy', chain: polygonAmoy },
  11155111: { name: 'Ethereum Sepolia', chain: sepolia },
};

// EntryPoint v0.7 address (used by ERC-4337)
export const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Pimlico configuration
const PIMLICO_API_KEY = import.meta.env?.VITE_PIMLICO_API_KEY || 
                        process.env.REACT_APP_PIMLICO_API_KEY || 
                        'pim_SBVmcVZ3jZgcvmDWUSE6QR';

/**
 * Get Pimlico bundler URL for a chain
 */
export const getPimlicoUrl = (chainId) => 
  `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`;

/**
 * Check if an address has been upgraded to a smart account (EIP-7702)
 * 
 * EIP-7702 sets the account code to: 0xef0100 || delegator_address
 */
export async function isSmartAccount(address, publicClient) {
  try {
    const code = await publicClient.getCode({ address });
    
    if (!code || code === '0x') {
      return { 
        isSmartAccount: false, 
        isFreshEOA: true,
        delegatorAddress: null 
      };
    }
    
    // EIP-7702: 0xef0100 || address represents delegation
    if (code.toLowerCase().startsWith('0xef0100')) {
      const delegatorAddress = `0x${code.substring(8, 48)}`.toLowerCase();
      return {
        isSmartAccount: true,
        isFreshEOA: false,
        delegatorAddress,
      };
    }
    
    // Has code but not EIP-7702 delegation
    return {
      isSmartAccount: true,
      isFreshEOA: false,
      delegatorAddress: null,
    };
    
  } catch (error) {
    console.error('Error checking smart account status:', error);
    return { isSmartAccount: false, isFreshEOA: false, delegatorAddress: null };
  }
}

/**
 * Check if Pimlico bundler is available for a chain
 */
export async function checkPimlicoAvailability(chainId) {
  try {
    const pimlicoUrl = getPimlicoUrl(chainId);
    
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
    
    if (data.result && data.result.length > 0) {
      return { available: true, entryPoints: data.result };
    }
    
    return { available: false, entryPoints: [] };
  } catch (error) {
    console.error('Pimlico health check failed:', error);
    return { available: false, error: error.message };
  }
}

/**
 * Encode ERC20 approve call
 */
export function encodeApproveCall(spender, amount) {
  return encodeFunctionData({
    abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
    functionName: 'approve',
    args: [spender, BigInt(amount)],
  });
}

/**
 * Encode ERC20 transfer call
 */
export function encodeTransferCall(to, amount) {
  return encodeFunctionData({
    abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
    functionName: 'transfer',
    args: [to, BigInt(amount)],
  });
}

/**
 * Get chain configuration
 */
export function getChainConfig(chainId) {
  return SUPPORTED_CHAINS[chainId] || null;
}

/**
 * Check if chain is supported for gasless
 */
export function isChainSupported(chainId) {
  return !!SUPPORTED_CHAINS[chainId];
}

/**
 * Format address for display
 */
export function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
