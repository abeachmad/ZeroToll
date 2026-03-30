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

import { http, encodeFunctionData, numberToHex, parseAbi } from 'viem';
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
                        process.env.REACT_APP_PIMLICO_API_KEY;

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

function normalizeSignedAuthorization(authorization) {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  const address = value?.address || value?.contractAddress;

  if (!value || !address || !value.r || !value.s) {
    throw new Error('Wallet returned an invalid EIP-7702 authorization.');
  }

  const rawYParity =
    typeof value.yParity !== 'undefined' ? value.yParity : value.v;
  const normalizedYParity =
    typeof rawYParity === 'undefined'
      ? undefined
      : (() => {
          const parsed = BigInt(rawYParity);
          return Number(parsed >= 27n ? parsed - 27n : parsed);
        })();

  return {
    address,
    chainId: Number(BigInt(value.chainId)),
    nonce: BigInt(value.nonce),
    ...(typeof normalizedYParity !== 'undefined'
      ? { yParity: normalizedYParity }
      : {}),
    r: value.r,
    s: value.s,
  };
}

/**
 * Sign an EIP-7702 authorization in a way that works for both local accounts
 * and injected JSON-RPC wallets like MetaMask.
 */
export async function signEip7702Authorization({
  walletClient,
  publicClient,
  account,
  chainId,
  contractAddress,
  executor = 'self',
}) {
  if (!walletClient) throw new Error('Wallet client not available.');
  if (!publicClient) throw new Error('Public client not available.');
  if (!account) throw new Error('Wallet account not available.');
  if (!contractAddress) throw new Error('Delegate contract not configured.');

  const accountType = walletClient.account?.type;

  if (accountType !== 'json-rpc' && typeof walletClient.signAuthorization === 'function') {
    const signedAuthorization = await walletClient.signAuthorization({
      account,
      chainId,
      contractAddress,
      executor,
    });

    return normalizeSignedAuthorization(signedAuthorization);
  }

  const preparedAuthorization =
    typeof walletClient.prepareAuthorization === 'function'
      ? await walletClient.prepareAuthorization({
          account,
          chainId,
          contractAddress,
          executor,
        })
      : {
          address: contractAddress,
          chainId,
          nonce:
            (await publicClient.getTransactionCount({
              address: account,
              blockTag: 'pending',
            })) + (executor === 'self' ? 1 : 0),
        };

  try {
    const signedAuthorization = await walletClient.request({
      method: 'wallet_signAuthorization',
      params: [
        {
          address: preparedAuthorization.address,
          chainId: numberToHex(preparedAuthorization.chainId),
          nonce: numberToHex(preparedAuthorization.nonce),
        },
      ],
    });

    return normalizeSignedAuthorization(signedAuthorization);
  } catch (error) {
    const message =
      error?.shortMessage || error?.message || 'Unknown wallet error.';

    throw new Error(
      `Wallet does not support EIP-7702 authorization signing via JSON-RPC. ${message}`,
    );
  }
}
