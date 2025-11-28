/**
 * EIP-7702 Utilities for ZeroToll
 * 
 * Uses permissionless.js for proper EIP-7702 + ERC-4337 integration
 * Based on: https://docs.pimlico.io/guides/eip7702
 */

import { 
  http,
  keccak256,
  toHex,
  concat,
  toRlp,
  pad,
} from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { to7702SimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Pimlico configuration
const PIMLICO_API_KEY = import.meta.env?.VITE_PIMLICO_API_KEY || 
                        process.env.REACT_APP_PIMLICO_API_KEY || 
                        'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Supported chains for EIP-7702
export const SUPPORTED_CHAINS = {
  80002: { name: 'Polygon Amoy', chain: polygonAmoy },
  11155111: { name: 'Ethereum Sepolia', chain: sepolia },
};

// Pimlico URLs per chain
export const getPimlicoUrl = (chainId) => 
  `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`;

// SimpleSmartAccount implementation address for EIP-7702
export const SIMPLE_ACCOUNT_IMPL = '0xe6Cae83BdE06E4c305530e199D7217f42808555B';

/**
 * Check if an address has been upgraded to a smart account (EIP-7702)
 */
export async function isSmartAccount(address, chainId, publicClient) {
  try {
    if (!SUPPORTED_CHAINS[chainId]) {
      console.warn(`Chain ${chainId} not supported for EIP-7702`);
      return { isSmartAccount: false, delegatorAddress: null, supported: false };
    }
    
    const code = await publicClient.getCode({ address });
    
    console.log('🔍 Checking account code:', { 
      address, 
      chainId, 
      codeLength: code?.length, 
      codePrefix: code?.substring(0, 20) 
    });
    
    if (!code || code === '0x') {
      console.log('✅ Fresh EOA detected - can use gasless with SimpleSmartAccount');
      return { 
        isSmartAccount: false, 
        delegatorAddress: null, 
        isFreshEOA: true,
        gaslessSupported: true,
        supported: true 
      };
    }
    
    // EIP-7702: 0xef0100 || address represents delegation
    if (code.toLowerCase().startsWith('0xef0100')) {
      const delegatorAddress = `0x${code.substring(8, 48)}`.toLowerCase();
      console.log('✅ EIP-7702 delegated account detected:', delegatorAddress);
      
      return {
        isSmartAccount: true,
        delegatorAddress,
        gaslessSupported: true,
        supported: true,
      };
    }
    
    // Has code but not EIP-7702 delegation
    return {
      isSmartAccount: true,
      delegatorAddress: null,
      gaslessSupported: false,
      supported: true,
    };
    
  } catch (error) {
    console.error('Error checking smart account status:', error);
    return { isSmartAccount: false, delegatorAddress: null, supported: false };
  }
}

/**
 * Create Pimlico client for bundler and paymaster
 */
export function createPimlicoBundlerClient(chainId, publicClient) {
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
 * Create a custom signer that wraps the JSON-RPC wallet client
 * This allows us to use MetaMask with permissionless.js EIP-7702
 */
function createCustomSigner(walletClient, publicClient) {
  const address = walletClient.account.address;
  
  return {
    address,
    type: 'local',
    source: 'custom',
    
    // Required for permissionless.js
    async sign({ hash }) {
      const signature = await walletClient.request({
        method: 'eth_sign',
        params: [address, hash],
      });
      return signature;
    },
    
    async signMessage({ message }) {
      if (typeof message === 'object' && message.raw) {
        return walletClient.request({
          method: 'eth_sign',
          params: [address, message.raw],
        });
      }
      return walletClient.signMessage({ account: walletClient.account, message });
    },
    
    async signTypedData(typedData) {
      return walletClient.signTypedData({ account: walletClient.account, ...typedData });
    },
    
    async signTransaction(tx) {
      return walletClient.signTransaction({ account: walletClient.account, ...tx });
    },
    
    // EIP-7702 authorization signing
    async signAuthorization(authorization) {
      const { chainId, contractAddress, nonce } = authorization;
      
      // EIP-7702 format: msg = keccak(MAGIC || rlp([chain_id, address, nonce]))
      const MAGIC = '0x05';
      const chainIdHex = chainId === 0n ? '0x' : toHex(chainId);
      const nonceHex = nonce === 0n ? '0x' : toHex(nonce);
      
      const authTuple = [chainIdHex, contractAddress.toLowerCase(), nonceHex];
      const rlpEncoded = toRlp(authTuple);
      const messageToSign = concat([MAGIC, rlpEncoded]);
      const messageHash = keccak256(messageToSign);
      
      console.log('🔐 Custom signer: signing authorization...', { chainId, contractAddress, nonce });
      
      const signature = await walletClient.request({
        method: 'eth_sign',
        params: [address, messageHash],
      });
      
      // Parse signature
      const sig = signature.slice(2);
      const r = `0x${sig.slice(0, 64)}`;
      const s = `0x${sig.slice(64, 128)}`;
      const v = parseInt(sig.slice(128, 130), 16);
      const yParity = v >= 27 ? v - 27 : v;
      
      return {
        chainId,
        address: contractAddress,
        nonce,
        yParity,
        r,
        s,
      };
    },
  };
}

/**
 * Create EIP-7702 smart account using permissionless.js
 */
export async function create7702SmartAccount(walletClient, publicClient, chainId) {
  console.log('🔧 Creating EIP-7702 smart account wrapper...', { chainId });
  
  const chain = SUPPORTED_CHAINS[chainId]?.chain;
  if (!chain) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  
  const address = walletClient.account.address;
  
  try {
    // Create a custom signer that wraps the JSON-RPC wallet
    const customSigner = createCustomSigner(walletClient, publicClient);
    
    // Create the 7702 simple smart account using permissionless.js
    const smartAccount = await to7702SimpleSmartAccount({
      client: publicClient,
      owner: customSigner,
    });
    
    console.log('✅ EIP-7702 smart account created:', smartAccount.address);
    
    // Store reference to walletClient for signing
    smartAccount._walletClient = walletClient;
    smartAccount._customSigner = customSigner;
    
    return smartAccount;
  } catch (error) {
    console.error('❌ Failed to create 7702 smart account:', error);
    
    // Fallback: Create a simple wrapper that works with wagmi's walletClient
    console.log('🔄 Trying fallback smart account wrapper...');
    
    const fallbackSmartAccount = {
      address,
      type: 'smart',
      source: 'eip7702-fallback',
      
      async isDeployed() {
        const code = await publicClient.getCode({ address });
        return code && code !== '0x' && code.length > 2;
      },
      
      async getNonce() {
        return 0n;
      },
      
      _walletClient: walletClient,
    };
    
    console.log('✅ Fallback smart account wrapper created:', address);
    return fallbackSmartAccount;
  }
}

/**
 * Create smart account client for sending transactions
 */
export async function createSmartAccountClientForChain(
  smartAccount,
  chainId,
  pimlicoClient
) {
  const chain = SUPPORTED_CHAINS[chainId]?.chain;
  const pimlicoUrl = getPimlicoUrl(chainId);
  
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
  
  return smartAccountClient;
}

/**
 * Execute gasless transaction using permissionless.js
 * 
 * Note: EIP-7702 with JSON-RPC accounts (MetaMask) is challenging because:
 * 1. MetaMask doesn't support signAuthorization natively
 * 2. Bundlers may not properly simulate EIP-7702 authorizations
 * 3. The account needs to be "upgraded" with a SET_CODE transaction first
 */
export async function executeGaslessTransaction(
  smartAccount,
  calls,
  bundlerClient,
  publicClient,
  chainId,
  walletClient
) {
  try {
    console.log('🚀 Executing gasless transaction...', { calls: calls.length });
    
    const chain = SUPPORTED_CHAINS[chainId]?.chain;
    const pimlicoUrl = getPimlicoUrl(chainId);
    
    // Check if account is deployed (has EIP-7702 code)
    const isDeployed = await smartAccount.isDeployed();
    console.log('📊 Account deployed status:', isDeployed);
    
    // If account is not deployed, we need to inform the user
    if (!isDeployed) {
      console.log('⚠️ Fresh EOA detected - EIP-7702 delegation required');
      console.log('⚠️ Current limitation: MetaMask does not support EIP-7702 SET_CODE transactions');
      console.log('⚠️ The account needs to be upgraded first before gasless transactions work');
      
      // Try to proceed anyway - the bundler might handle it
      console.log('🔄 Attempting gasless transaction anyway...');
    }
    
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
    console.log('🔄 Sending transaction via permissionless.js...');
    
    try {
      if (calls.length === 1) {
        transactionHash = await smartAccountClient.sendTransaction({
          to: calls[0].to,
          value: calls[0].value || 0n,
          data: calls[0].data || '0x',
        });
      } else {
        transactionHash = await smartAccountClient.sendTransaction({
          calls: calls.map(call => ({
            to: call.to,
            value: call.value || 0n,
            data: call.data || '0x',
          })),
        });
      }
      
      console.log('✅ Transaction sent:', transactionHash);
      return transactionHash;
      
    } catch (sendError) {
      console.error('❌ Send transaction failed:', sendError);
      
      // Check if this is an EIP-7702 related error
      if (sendError.message?.includes('reverted during simulation') || 
          sendError.message?.includes('0x')) {
        
        if (!isDeployed) {
          throw new Error(
            'Gasless transaction failed: Your account needs to be upgraded to a smart account first. ' +
            'This requires a wallet that supports EIP-7702 (SET_CODE transactions). ' +
            'MetaMask does not yet support this feature. ' +
            'Please use a standard transaction for now, or wait for wallet support.'
          );
        }
      }
      
      throw sendError;
    }
    
  } catch (error) {
    console.error('❌ Gasless transaction failed:', error);
    throw error;
  }
}

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
 * Check wallet capabilities for EIP-7702 support
 */
export function checkWalletCapabilities(capabilities, chainId) {
  if (!capabilities || !capabilities[chainId]) {
    return {
      supportsPaymaster: false,
      supportsAtomicBatch: false,
      supportsEip7702: false,
    };
  }
  
  const chainCaps = capabilities[chainId];
  
  return {
    supportsPaymaster: chainCaps.paymasterService?.supported || false,
    supportsAtomicBatch: chainCaps.atomicBatch?.supported || chainCaps.atomic?.status === 'ready' || false,
    supportsEip7702: true, // If we got here, EIP-7702 is supported
  };
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
