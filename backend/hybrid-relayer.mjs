/**
 * ZeroToll Hybrid Gasless Relayer
 * 
 * User signs intent → Relayer pays gas → User pays ZERO
 * Uses EOA for reliability (Pimlico can be added later for cost savings)
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

const ZEROTOLL_ROUTER = '0xd475255Ae38C92404f9740A19F93B8D2526A684b';
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const CHAINS = {
  11155111: {
    chain: sepolia,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    routerAddress: ZEROTOLL_ROUTER
  }
};

// EIP-712 Types
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
  chainId,
  verifyingContract: routerAddress
});

// Router ABI
const ROUTER_ABI = parseAbi([
  'function executeSwap((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature) external returns (uint256)',
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function executeSwapWithPermit2((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes permit2Signature) external returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]);

// Storage & Account
const intents = new Map();
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
console.log('Relayer:', relayerAccount.address);


// ============================================
// Standard Swap (requires prior approval)
// ============================================
app.post('/api/intents/swap', async (req, res) => {
  try {
    const { chainId, intent, userSignature } = req.body;
    const chainConfig = CHAINS[chainId];
    if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

    // Verify signature
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
      address: getAddress(intent.user),
      domain: getDomain(chainId, chainConfig.routerAddress),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Signature verified:', intent.user);

    // Build call data
    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwap',
      args: [message, userSignature]
    });

    // Send transaction (relayer pays gas)
    const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) });
    const walletClient = createWalletClient({ account: relayerAccount, chain: chainConfig.chain, transport: http(chainConfig.rpc) });

    // Check relayer balance
    const balance = await publicClient.getBalance({ address: relayerAccount.address });
    console.log('Relayer balance:', (Number(balance) / 1e18).toFixed(4), 'ETH');
    if (balance < BigInt(1e15)) return res.status(500).json({ error: 'Relayer low on funds' });

    const txHash = await walletClient.sendTransaction({
      to: chainConfig.routerAddress,
      data: callData,
      gas: BigInt(500000)
    });

    console.log('✓ Tx submitted:', txHash);

    const requestId = `swap_${Date.now()}`;
    intents.set(requestId, { chainId, txHash, status: 'pending' });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      message: 'Swap submitted - relayer paid gas for you!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message, details: error.shortMessage });
  }
});

// ============================================
// ERC-2612 Permit Swap (fully gasless for supported tokens like ZTA/ZTB)
// ============================================
app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;
    const chainConfig = CHAINS[chainId];
    if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

    if (!permit || !permit.v || !permit.r || !permit.s) {
      return res.status(400).json({ error: 'Missing permit signature' });
    }

    // Verify swap signature
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
      address: getAddress(intent.user),
      domain: getDomain(chainId, chainConfig.routerAddress),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Signature verified:', intent.user);

    // Build executeSwapWithPermit call
    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
      args: [
        message,
        userSignature,
        BigInt(permit.deadline),
        permit.v,
        permit.r,
        permit.s
      ]
    });

    const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) });
    const walletClient = createWalletClient({ account: relayerAccount, chain: chainConfig.chain, transport: http(chainConfig.rpc) });

    const balance = await publicClient.getBalance({ address: relayerAccount.address });
    console.log('Relayer balance:', (Number(balance) / 1e18).toFixed(4), 'ETH');
    if (balance < BigInt(1e15)) return res.status(500).json({ error: 'Relayer low on funds' });

    const txHash = await walletClient.sendTransaction({
      to: chainConfig.routerAddress,
      data: callData,
      gas: BigInt(500000)
    });

    console.log('✓ Permit swap tx:', txHash);

    const requestId = `permit_${Date.now()}`;
    intents.set(requestId, { chainId, txHash, status: 'pending' });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      message: 'Fully gasless swap submitted via ERC-2612 Permit!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message, details: error.shortMessage });
  }
});

// ============================================
// Permit2 Swap (fully gasless - no prior approval needed)
// ============================================
app.post('/api/intents/swap-with-permit2', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit2Signature, permitSingle } = req.body;
    const chainConfig = CHAINS[chainId];
    if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

    if (!permitSingle || !permit2Signature) {
      return res.status(400).json({ error: 'Missing Permit2 data' });
    }

    // Verify swap signature
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
      address: getAddress(intent.user),
      domain: getDomain(chainId, chainConfig.routerAddress),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Signature verified:', intent.user);

    // Build executeSwapWithPermit2 call
    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit2',
      args: [
        message,
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

    const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) });
    const walletClient = createWalletClient({ account: relayerAccount, chain: chainConfig.chain, transport: http(chainConfig.rpc) });

    const balance = await publicClient.getBalance({ address: relayerAccount.address });
    console.log('Relayer balance:', (Number(balance) / 1e18).toFixed(4), 'ETH');
    if (balance < BigInt(1e15)) return res.status(500).json({ error: 'Relayer low on funds' });

    const txHash = await walletClient.sendTransaction({
      to: chainConfig.routerAddress,
      data: callData,
      gas: BigInt(600000)
    });

    console.log('✓ Permit2 swap tx:', txHash);

    const requestId = `permit2_${Date.now()}`;
    intents.set(requestId, { chainId, txHash, status: 'pending' });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      message: 'Fully gasless swap submitted!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message, details: error.shortMessage });
  }
});


// ============================================
// Status & Config Endpoints
// ============================================
app.get('/api/intents/:id/status', async (req, res) => {
  const data = intents.get(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });

  const chainConfig = CHAINS[data.chainId];
  const publicClient = createPublicClient({ chain: chainConfig.chain, transport: http(chainConfig.rpc) });

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: data.txHash });
    if (receipt) {
      data.status = receipt.status === 'success' ? 'confirmed' : 'failed';
      intents.set(req.params.id, data);
    }
  } catch (e) {}

  res.json({
    requestId: req.params.id,
    status: data.status,
    txHash: data.txHash,
    explorerUrl: `https://sepolia.etherscan.io/tx/${data.txHash}`
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
  const chainId = parseInt(req.params.chainId);
  const chainConfig = CHAINS[chainId];
  if (!chainConfig) return res.status(400).json({ error: 'Unsupported chain' });

  res.json({
    chainId,
    routerAddress: chainConfig.routerAddress,
    permit2Address: PERMIT2_ADDRESS,
    domain: getDomain(chainId, chainConfig.routerAddress),
    types: SWAP_INTENT_TYPES
  });
});

app.get('/health', async (req, res) => {
  const publicClient = createPublicClient({ chain: sepolia, transport: http(CHAINS[11155111].rpc) });
  const balance = await publicClient.getBalance({ address: relayerAccount.address });
  
  res.json({
    status: 'ok',
    relayer: relayerAccount.address,
    balance: `${(Number(balance) / 1e18).toFixed(4)} ETH`,
    router: ZEROTOLL_ROUTER,
    gasModel: 'Relayer pays gas, user pays ZERO'
  });
});

const PORT = process.env.RELAYER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 ZeroToll Hybrid Relayer on port ${PORT}`);
  console.log(`   Router: ${ZEROTOLL_ROUTER}`);
  console.log(`   Relayer: ${relayerAccount.address}`);
  console.log(`   Model: User signs, relayer pays gas\n`);
});

export default app;
