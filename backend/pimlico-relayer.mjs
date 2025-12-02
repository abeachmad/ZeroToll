/**
 * ZeroToll Pimlico-Based Gasless Relayer
 * 
 * Uses ERC-4337 Smart Account + Pimlico Paymaster
 * Relayer doesn't pay gas - Pimlico sponsors everything!
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
  getAddress,
  concat,
  pad,
  toHex
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// Configuration
// ============================================

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;

if (!RELAYER_PRIVATE_KEY) {
  console.error('Missing RELAYER_PRIVATE_KEY');
  process.exit(1);
}

if (!PIMLICO_API_KEY) {
  console.error('Missing PIMLICO_API_KEY - get one at https://dashboard.pimlico.io');
  process.exit(1);
}

// V2 Router with Permit2 support
const ZEROTOLL_ROUTER_SEPOLIA = '0xd475255Ae38C92404f9740A19F93B8D2526A684b';

// Permit2 address (same on all chains)
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const CHAINS = {
  11155111: {
    chain: sepolia,
    rpc: process.env.RPC_SEPOLIA || 'https://ethereum-sepolia-rpc.publicnode.com',
    routerAddress: ZEROTOLL_ROUTER_SEPOLIA,
    pimlicoUrl: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`
  },
  80002: {
    chain: polygonAmoy,
    rpc: process.env.RPC_AMOY || 'https://rpc-amoy.polygon.technology',
    routerAddress: '0x0000000000000000000000000000000000000000',
    pimlicoUrl: `https://api.pimlico.io/v2/polygon-amoy/rpc?apikey=${PIMLICO_API_KEY}`
  }
};

// ============================================
// EIP-712 Types
// ============================================

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

const getDomain = (chainId, routerAddress) => ({
  name: 'ZeroTollRouter',
  version: '1',
  chainId: chainId,
  verifyingContract: routerAddress
});

// ============================================
// Router ABI
// ============================================

const ROUTER_ABI = parseAbi([
  'function executeSwap((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature) external returns (uint256)',
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function executeSwapWithPermit2((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes permit2Signature) external returns (uint256)',
  'function nonces(address user) view returns (uint256)',
  'function getPermit2Allowance(address user, address token) view returns (uint160 amount, uint48 expiration, uint48 nonce)'
]);


// ============================================
// Storage & Account Setup
// ============================================

const intents = new Map();
const relayerEOA = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
console.log('Relayer EOA:', relayerEOA.address);

// Smart account clients cache
const smartAccountClients = new Map();

async function getSmartAccountClient(chainId) {
  if (smartAccountClients.has(chainId)) {
    return smartAccountClients.get(chainId);
  }

  const chainConfig = CHAINS[chainId];
  if (!chainConfig) throw new Error(`Unsupported chain: ${chainId}`);

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc)
  });

  // Create Pimlico client for bundler + paymaster
  const pimlicoClient = createPimlicoClient({
    transport: http(chainConfig.pimlicoUrl),
    entryPoint: {
      address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EntryPoint v0.7
      version: '0.7'
    }
  });

  // Create Simple Smart Account for relayer
  const simpleAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: relayerEOA,
    entryPoint: {
      address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      version: '0.7'
    }
  });

  console.log(`Smart Account for chain ${chainId}:`, simpleAccount.address);

  // Create smart account client with Pimlico paymaster
  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: chainConfig.chain,
    bundlerTransport: http(chainConfig.pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      }
    }
  });

  smartAccountClients.set(chainId, { smartAccountClient, publicClient, pimlicoClient, simpleAccount });
  return smartAccountClients.get(chainId);
}

const serializeBigInt = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => typeof v === 'bigint' ? v.toString() : v));

// ============================================
// API Endpoints
// ============================================

app.post('/api/intents/swap', async (req, res) => {
  try {
    const { chainId, intent, userSignature } = req.body;

    const chainConfig = CHAINS[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Unsupported chain: ${chainId}` });
    }

    // Get smart account client
    const { smartAccountClient, publicClient, simpleAccount } = await getSmartAccountClient(chainId);

    // Build message for verification
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

    // Verify signature
    const domain = getDomain(chainId, chainConfig.routerAddress);
    
    const isValid = await verifyTypedData({
      address: getAddress(intent.user),
      domain,
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid user signature' });
    }

    console.log('✓ Signature verified for:', intent.user);

    // Build executeSwap call data
    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwap',
      args: [
        {
          user: getAddress(intent.user),
          tokenIn: getAddress(intent.tokenIn),
          tokenOut: getAddress(intent.tokenOut),
          amountIn: BigInt(intent.amountIn),
          minAmountOut: BigInt(intent.minAmountOut),
          deadline: BigInt(intent.deadline),
          nonce: BigInt(intent.nonce),
          chainId: BigInt(chainId)
        },
        userSignature
      ]
    });

    console.log('Submitting UserOperation via Pimlico...');
    console.log('Smart Account:', simpleAccount.address);

    // Send UserOperation - Pimlico pays gas!
    let userOpHash;
    try {
      userOpHash = await smartAccountClient.sendUserOperation({
        calls: [{
          to: chainConfig.routerAddress,
          data: callData,
          value: BigInt(0)
        }]
      });
      console.log('✓ UserOperation submitted:', userOpHash);
    } catch (txError) {
      console.error('UserOperation failed:', txError);
      return res.status(500).json({ 
        error: 'UserOperation failed', 
        details: txError.shortMessage || txError.message 
      });
    }

    const requestId = `intent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    intents.set(requestId, { 
      chainId, intent, userSignature, userOpHash, 
      status: 'pending', createdAt: Date.now() 
    });

    res.json({
      success: true,
      requestId,
      userOpHash,
      smartAccount: simpleAccount.address,
      message: 'UserOperation submitted - gas sponsored by Pimlico!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Swap with Permit2 - fully gasless including approval (works with ANY ERC-20)
app.post('/api/intents/swap-with-permit2', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit2Signature, permitSingle } = req.body;

    const chainConfig = CHAINS[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Unsupported chain: ${chainId}` });
    }

    const { smartAccountClient, simpleAccount } = await getSmartAccountClient(chainId);

    // Verify swap intent signature
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

    const domain = getDomain(chainId, chainConfig.routerAddress);
    
    const isValid = await verifyTypedData({
      address: getAddress(intent.user),
      domain,
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid user signature' });
    }

    console.log('✓ Swap signature verified');

    // Build batch of calls:
    // 1. Permit2.permit (if provided) - gasless approval
    // 2. executeSwap
    const calls = [];

    if (!permitSingle || !permit2Signature) {
      return res.status(400).json({ error: 'Missing Permit2 data' });
    }

    // Build executeSwapWithPermit2 call (single call that does permit + swap)
    const swapCallData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit2',
      args: [
        {
          user: getAddress(intent.user),
          tokenIn: getAddress(intent.tokenIn),
          tokenOut: getAddress(intent.tokenOut),
          amountIn: BigInt(intent.amountIn),
          minAmountOut: BigInt(intent.minAmountOut),
          deadline: BigInt(intent.deadline),
          nonce: BigInt(intent.nonce),
          chainId: BigInt(chainId)
        },
        userSignature,
        {
          details: {
            token: getAddress(permitSingle.details.token),
            amount: BigInt(permitSingle.details.amount),
            expiration: BigInt(permitSingle.details.expiration),
            nonce: BigInt(permitSingle.details.nonce)
          },
          spender: getAddress(permitSingle.spender),
          sigDeadline: BigInt(permitSingle.sigDeadline)
        },
        permit2Signature
      ]
    });

    calls.push({
      to: chainConfig.routerAddress,
      data: swapCallData,
      value: BigInt(0)
    });

    console.log(`Submitting ${calls.length} calls via Pimlico...`);

    let userOpHash;
    try {
      userOpHash = await smartAccountClient.sendUserOperation({ calls });
      console.log('✓ UserOperation submitted:', userOpHash);
    } catch (txError) {
      console.error('UserOperation failed:', txError);
      return res.status(500).json({ 
        error: 'UserOperation failed', 
        details: txError.shortMessage || txError.message 
      });
    }

    const requestId = `permit2_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    intents.set(requestId, { 
      chainId, intent, userOpHash, 
      status: 'pending', createdAt: Date.now() 
    });

    res.json({
      success: true,
      requestId,
      userOpHash,
      smartAccount: simpleAccount.address,
      message: 'Fully gasless swap submitted via Permit2!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/intents/:id/status', async (req, res) => {
  const intentData = intents.get(req.params.id);
  if (!intentData) return res.status(404).json({ error: 'Not found' });

  try {
    const { pimlicoClient } = await getSmartAccountClient(intentData.chainId);
    
    const receipt = await pimlicoClient.getUserOperationReceipt({
      hash: intentData.userOpHash
    });

    if (receipt) {
      intentData.status = receipt.success ? 'confirmed' : 'failed';
      intentData.txHash = receipt.receipt?.transactionHash;
      intents.set(req.params.id, intentData);
    }
  } catch (e) {
    // Still pending
  }

  const chainConfig = CHAINS[intentData.chainId];
  res.json({
    requestId: req.params.id,
    status: intentData.status,
    userOpHash: intentData.userOpHash,
    txHash: intentData.txHash,
    explorerUrl: intentData.txHash 
      ? (intentData.chainId === 11155111
          ? `https://sepolia.etherscan.io/tx/${intentData.txHash}`
          : `https://amoy.polygonscan.com/tx/${intentData.txHash}`)
      : null
  });
});

app.get('/api/nonce/:chainId/:address', async (req, res) => {
  const chainConfig = CHAINS[parseInt(req.params.chainId)];
  if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

  const publicClient = createPublicClient({ 
    chain: chainConfig.chain, 
    transport: http(chainConfig.rpc) 
  });

  try {
    const nonce = await publicClient.readContract({
      address: chainConfig.routerAddress,
      abi: ROUTER_ABI,
      functionName: 'nonces',
      args: [getAddress(req.params.address)]
    });
    res.json({ nonce: nonce.toString() });
  } catch (e) {
    res.json({ nonce: '0' });
  }
});

app.get('/api/config/:chainId', async (req, res) => {
  const chainId = parseInt(req.params.chainId);
  const chainConfig = CHAINS[chainId];
  if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

  let smartAccountAddress = null;
  try {
    const { simpleAccount } = await getSmartAccountClient(chainId);
    smartAccountAddress = simpleAccount.address;
  } catch (e) {}

  res.json(serializeBigInt({
    chainId,
    routerAddress: chainConfig.routerAddress,
    smartAccountAddress,
    permit2Address: PERMIT2_ADDRESS,
    domain: getDomain(chainId, chainConfig.routerAddress),
    types: SWAP_INTENT_TYPES
  }));
});

app.get('/health', async (req, res) => {
  let smartAccounts = {};
  for (const chainId of Object.keys(CHAINS)) {
    try {
      const { simpleAccount } = await getSmartAccountClient(parseInt(chainId));
      smartAccounts[chainId] = simpleAccount.address;
    } catch (e) {
      smartAccounts[chainId] = 'not initialized';
    }
  }

  res.json({ 
    status: 'ok', 
    relayerEOA: relayerEOA.address,
    smartAccounts,
    supportedChains: Object.keys(CHAINS).map(Number),
    gasSponsorship: 'Pimlico Paymaster'
  });
});

const PORT = process.env.RELAYER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 ZeroToll Pimlico Relayer on port ${PORT}`);
  console.log(`   Router: ${ZEROTOLL_ROUTER_SEPOLIA}`);
  console.log(`   Relayer EOA: ${relayerEOA.address}`);
  console.log(`   Gas Sponsor: Pimlico Paymaster\n`);
});

export default app;
