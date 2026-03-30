/**
 * ZeroToll Hybrid Self-Hosted Relayer
 * 
 * Uses Pimlico bundler + Our VerifyingPaymaster
 * This gives us control over gas sponsorship while using Pimlico's reliable bundler
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import {
  createPublicClient,
  http,
  verifyTypedData,
  encodeFunctionData,
  parseAbi,
  getAddress
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { warnLegacyService } from '../legacy-service-warning.mjs';

// Load env
config({ path: '.env' });
config({ path: '.env.credentials' });
warnLegacyService('backend/legacy/hybrid-self-hosted-relayer.mjs', 'backend/phase2-relayer.mjs');

const app = express();
app.use(cors());
app.use(express.json());

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;

if (!RELAYER_PRIVATE_KEY || !PIMLICO_API_KEY) {
  console.error('Missing RELAYER_PRIVATE_KEY or PIMLICO_API_KEY');
  process.exit(1);
}

// Chain config with our paymasters
const CHAIN_CONFIG = {
  11155111: {
    name: 'sepolia',
    chain: sepolia,
    router: '0x577560699EF88e99f15d04df57c9552056d2a10D',
    paymaster: process.env.SEPOLIA_VERIFYING_PAYMASTER,
    pimlicoUrl: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io/tx/'
  },
  80002: {
    name: 'polygon-amoy',
    chain: polygonAmoy,
    router: '0xc75df1943d6EFE04b422b9bB45509782609Fc67a',
    paymaster: process.env.AMOY_VERIFYING_PAYMASTER,
    pimlicoUrl: `https://api.pimlico.io/v2/polygon-amoy/rpc?apikey=${PIMLICO_API_KEY}`,
    rpc: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com/tx/'
  }
};

const SWAP_INTENT_TYPES = {
  SwapIntent: [
    { name: 'user', type: 'address' },
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'chainId', type: 'uint256' }
  ]
};

const getDomain = (routerAddress, chainId) => ({
  name: 'ZeroTollRouter',
  version: '1',
  chainId: chainId,
  verifyingContract: routerAddress
});

const ROUTER_ABI = parseAbi([
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]);

const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
console.log('Relayer EOA:', relayerAccount.address);

const intents = new Map();
const chainClients = {};

// Initialize chain clients with Pimlico bundler but our paymaster
async function getChainClients(chainId) {
  if (chainClients[chainId]) {
    return chainClients[chainId];
  }

  const chainConfig = CHAIN_CONFIG[chainId];
  if (!chainConfig) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  console.log(`Initializing ${chainConfig.name}...`);

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc)
  });

  // Create Pimlico client (bundler only, we'll use our paymaster)
  const pimlicoClient = createPimlicoClient({
    transport: http(chainConfig.pimlicoUrl),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });

  // Create simple smart account
  const simpleAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: relayerAccount,
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });

  console.log(`  Smart Account: ${simpleAccount.address}`);
  console.log(`  Our Paymaster: ${chainConfig.paymaster || 'NOT SET'}`);

  // Create smart account client with Pimlico bundler
  // Note: We're using Pimlico's paymaster for now, but could switch to ours
  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: chainConfig.chain,
    bundlerTransport: http(chainConfig.pimlicoUrl),
    paymaster: pimlicoClient, // Using Pimlico paymaster for reliability
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      }
    }
  });

  chainClients[chainId] = {
    publicClient,
    pimlicoClient,
    smartAccountClient,
    smartAccountAddress: simpleAccount.address,
    chainConfig
  };

  console.log(`✓ ${chainConfig.name} initialized`);
  return chainClients[chainId];
}

// Swap with permit endpoint
app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;
    
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported` });
    }

    if (!permit?.v || !permit?.r || !permit?.s) {
      return res.status(400).json({ error: 'Missing permit' });
    }

    const clients = await getChainClients(chainId);
    const routerAddress = chainConfig.router;

    // Verify intent signature
    const message = {
      user: getAddress(intent.user),
      tokenIn: getAddress(intent.tokenIn),
      tokenOut: getAddress(intent.tokenOut),
      amountIn: BigInt(intent.amountIn),
      minAmountOut: BigInt(intent.minAmountOut),
      deadline: BigInt(intent.deadline),
      nonce: BigInt(intent.nonce),
      chainId: BigInt(chainId)
    };

    const isValid = await verifyTypedData({
      address: message.user,
      domain: getDomain(routerAddress, chainId),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    console.log('✓ Verified swap intent from:', intent.user);

    // Encode router call
    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
      args: [message, userSignature, BigInt(permit.deadline), permit.v, permit.r, permit.s]
    });

    // Send via Smart Account (Pimlico bundler + paymaster)
    console.log('Sending via Smart Account...');
    const txHash = await clients.smartAccountClient.sendTransaction({
      to: routerAddress,
      data: callData,
      value: 0n
    });

    console.log('✓ Tx submitted:', txHash);

    const requestId = `hybrid_${Date.now()}`;
    intents.set(requestId, { txHash, status: 'pending', chainId });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: `${chainConfig.explorer}${txHash}`,
      sponsor: 'Pimlico (bundler) + ZeroToll (paymaster coming soon)',
      message: 'Gas sponsored!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health endpoint
app.get('/health', async (req, res) => {
  const chains = Object.keys(chainClients).map(id => ({
    chainId: parseInt(id),
    name: CHAIN_CONFIG[id]?.name,
    smartAccount: chainClients[id]?.smartAccountAddress,
    ourPaymaster: CHAIN_CONFIG[id]?.paymaster || 'NOT SET'
  }));

  res.json({
    status: 'ok',
    mode: 'hybrid (Pimlico bundler + our paymaster)',
    relayerEOA: relayerAccount.address,
    chains
  });
});

// Initialize and start
const PORT = process.env.HYBRID_RELAYER_PORT || 3003;

async function init() {
  console.log('\n' + '='.repeat(60));
  console.log('  ZEROTOLL HYBRID RELAYER');
  console.log('  (Pimlico Bundler + Our Paymaster)');
  console.log('='.repeat(60));
  
  for (const chainId of Object.keys(CHAIN_CONFIG)) {
    try {
      await getChainClients(parseInt(chainId));
    } catch (e) {
      console.error(`Failed to init ${CHAIN_CONFIG[chainId].name}:`, e.message);
    }
  }

  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 Hybrid Relayer running on port ${PORT}`);
    console.log('='.repeat(60) + '\n');
  });
}

init();

export default app;
