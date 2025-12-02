/**
 * ZeroToll Intent-Based Gasless Relayer
 * 
 * Uses ZeroTollRouter contract (Solution.md architecture)
 * User signs EIP-712 SwapIntent, relayer submits executeSwap
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  http,
  verifyTypedData,
  encodeFunctionData,
  parseAbi,
  getAddress
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';

config();

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// Configuration
// ============================================

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

if (!RELAYER_PRIVATE_KEY) {
  console.error('Missing RELAYER_PRIVATE_KEY');
  process.exit(1);
}

// NEW ZeroTollRouter contract with Permit support
const ZEROTOLL_ROUTER_SEPOLIA = '0x7065681d02601004e48C6e8Ac1F82B44cc6b36e6';

const CHAINS = {
  11155111: {
    chain: sepolia,
    rpc: process.env.RPC_SEPOLIA || 'https://ethereum-sepolia-rpc.publicnode.com',
    routerAddress: ZEROTOLL_ROUTER_SEPOLIA
  },
  80002: {
    chain: polygonAmoy,
    rpc: process.env.RPC_AMOY || 'https://rpc-amoy.polygon.technology',
    routerAddress: '0x0000000000000000000000000000000000000000' // Deploy later
  }
};

// ============================================
// EIP-712 Types for SwapIntent (matches ZeroTollRouter.sol)
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
  'function nonces(address user) view returns (uint256)'
]);

// ============================================
// Storage & Account
// ============================================

const intents = new Map();
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
console.log('Relayer address:', relayerAccount.address);

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

    if (!intent.user || !intent.tokenIn || !intent.tokenOut) {
      return res.status(400).json({ error: 'Missing required intent fields' });
    }

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

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

    // Check on-chain nonce
    try {
      const onChainNonce = await publicClient.readContract({
        address: chainConfig.routerAddress,
        abi: ROUTER_ABI,
        functionName: 'nonces',
        args: [getAddress(intent.user)]
      });
      
      if (BigInt(intent.nonce) !== onChainNonce) {
        return res.status(400).json({ 
          error: `Nonce mismatch. Expected ${onChainNonce}, got ${intent.nonce}` 
        });
      }
    } catch (e) {
      console.log('Nonce check skipped:', e.message);
    }

    // Build executeSwap call
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

    const walletClient = createWalletClient({
      account: relayerAccount,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    // Check balance
    const balance = await publicClient.getBalance({ address: relayerAccount.address });
    console.log('Relayer balance:', balance.toString(), 'wei');

    if (balance < BigInt(1e15)) {
      return res.status(500).json({ error: 'Relayer has insufficient balance' });
    }

    // Send transaction
    let txHash;
    try {
      txHash = await walletClient.sendTransaction({
        to: chainConfig.routerAddress,
        data: callData,
        gas: BigInt(300000)
      });
      console.log('✓ Transaction submitted:', txHash);
    } catch (txError) {
      console.error('Transaction failed:', txError.message);
      return res.status(500).json({ 
        error: 'Transaction failed', 
        details: txError.shortMessage || txError.message 
      });
    }

    const requestId = `intent_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    intents.set(requestId, { chainId, intent, userSignature, txHash, status: 'pending', createdAt: Date.now() });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: chainId === 11155111 
        ? `https://sepolia.etherscan.io/tx/${txHash}`
        : `https://amoy.polygonscan.com/tx/${txHash}`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Fully Gasless: Swap with Permit (ERC-2612)
// ============================================

app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;

    const chainConfig = CHAINS[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Unsupported chain: ${chainId}` });
    }

    if (!permit || !permit.v || !permit.r || !permit.s) {
      return res.status(400).json({ error: 'Missing permit signature' });
    }

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

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

    // Verify swap intent signature
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

    console.log('✓ Swap signature verified for:', intent.user);

    // Build executeSwapWithPermit call
    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
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
        BigInt(permit.deadline),
        parseInt(permit.v),
        permit.r,
        permit.s
      ]
    });

    const walletClient = createWalletClient({
      account: relayerAccount,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    // Check balance
    const balance = await publicClient.getBalance({ address: relayerAccount.address });
    if (balance < BigInt(1e15)) {
      return res.status(500).json({ error: 'Relayer has insufficient balance' });
    }

    // Send transaction
    let txHash;
    try {
      txHash = await walletClient.sendTransaction({
        to: chainConfig.routerAddress,
        data: callData,
        gas: BigInt(400000) // Higher gas for permit + swap
      });
      console.log('✓ Permit+Swap transaction submitted:', txHash);
    } catch (txError) {
      console.error('Transaction failed:', txError.message);
      return res.status(500).json({ 
        error: 'Transaction failed', 
        details: txError.shortMessage || txError.message 
      });
    }

    const requestId = `permit_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    intents.set(requestId, { chainId, intent, userSignature, permit, txHash, status: 'pending', createdAt: Date.now() });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: chainId === 11155111 
        ? `https://sepolia.etherscan.io/tx/${txHash}`
        : `https://amoy.polygonscan.com/tx/${txHash}`
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/intents/:id/status', async (req, res) => {
  const intentData = intents.get(req.params.id);
  if (!intentData) return res.status(404).json({ error: 'Not found' });

  const chainConfig = CHAINS[intentData.chainId];
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) });

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: intentData.txHash });
    if (receipt) {
      intentData.status = receipt.status === 'success' ? 'confirmed' : 'failed';
      intents.set(req.params.id, intentData);
    }
  } catch (e) {}

  res.json({
    requestId: req.params.id,
    status: intentData.status,
    txHash: intentData.txHash,
    explorerUrl: intentData.chainId === 11155111
      ? `https://sepolia.etherscan.io/tx/${intentData.txHash}`
      : `https://amoy.polygonscan.com/tx/${intentData.txHash}`
  });
});

app.get('/api/nonce/:chainId/:address', async (req, res) => {
  const chainConfig = CHAINS[parseInt(req.params.chainId)];
  if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) });

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

app.get('/api/config/:chainId', (req, res) => {
  const chainConfig = CHAINS[parseInt(req.params.chainId)];
  if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

  res.json(serializeBigInt({
    chainId: parseInt(req.params.chainId),
    routerAddress: chainConfig.routerAddress,
    domain: getDomain(parseInt(req.params.chainId), chainConfig.routerAddress),
    types: SWAP_INTENT_TYPES
  }));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', relayer: relayerAccount.address, supportedChains: Object.keys(CHAINS).map(Number) });
});

const PORT = process.env.RELAYER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 ZeroToll Intent Relayer on port ${PORT}`);
  console.log(`   Router: ${ZEROTOLL_ROUTER_SEPOLIA}`);
  console.log(`   Relayer: ${relayerAccount.address}\n`);
});

export default app;
