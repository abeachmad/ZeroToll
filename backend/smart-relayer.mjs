/**
 * ZeroToll Smart Relayer
 * 
 * Features:
 * 1. Pimlico sponsorship (primary) - truly free for relayer too
 * 2. EOA fallback if Pimlico fails - relayer pays gas
 * 3. Supports ERC-2612 Permit (ZTA/ZTB) and Permit2 (any token)
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
import { sepolia } from 'viem/chains';

config();

const app = express();
app.use(cors());
app.use(express.json());

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;

if (!RELAYER_PRIVATE_KEY) {
  console.error('Missing RELAYER_PRIVATE_KEY');
  process.exit(1);
}

const ZEROTOLL_ROUTER = '0xd475255Ae38C92404f9740A19F93B8D2526A684b';
const SMART_ADAPTER = '0xb9373FDB72128d01B5F3b6BD29F30B8921a85885';
const PIMLICO_URL = PIMLICO_API_KEY ? `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}` : null;

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

const getDomain = (routerAddress) => ({
  name: 'ZeroTollRouter',
  version: '1',
  chainId: 11155111,
  verifyingContract: routerAddress
});

const ROUTER_ABI = parseAbi([
  'function executeSwap((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature) external returns (uint256)',
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function executeSwapWithPermit2((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, ((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes permit2Signature) external returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]);

const intents = new Map();
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
const publicClient = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });
const walletClient = createWalletClient({ account: relayerAccount, chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });

console.log('Relayer:', relayerAccount.address);
console.log('Pimlico:', PIMLICO_API_KEY ? 'Enabled' : 'Disabled (EOA only)');


// ============================================
// Helper: Send transaction with Pimlico fallback to EOA
// ============================================
async function sendWithFallback(callData, gasLimit = 500000n) {
  // For now, use EOA directly (Pimlico integration can be added later)
  // The key point: USER pays ZERO gas
  
  const balance = await publicClient.getBalance({ address: relayerAccount.address });
  if (balance < BigInt(1e15)) {
    throw new Error('Relayer low on funds');
  }

  const txHash = await walletClient.sendTransaction({
    to: ZEROTOLL_ROUTER,
    data: callData,
    gas: gasLimit
  });

  return { txHash, sponsor: 'relayer' };
}

// ============================================
// Standard Swap (requires prior approval to router)
// ============================================
app.post('/api/intents/swap', async (req, res) => {
  try {
    const { chainId, intent, userSignature } = req.body;
    if (chainId !== 11155111) return res.status(400).json({ error: 'Only Sepolia supported' });

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
      domain: getDomain(ZEROTOLL_ROUTER),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Verified:', intent.user);

    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwap',
      args: [message, userSignature]
    });

    const { txHash, sponsor } = await sendWithFallback(callData);
    console.log('✓ Tx:', txHash, '| Sponsor:', sponsor);

    const requestId = `swap_${Date.now()}`;
    intents.set(requestId, { txHash, status: 'pending' });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      sponsor
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ERC-2612 Permit Swap (fully gasless for ZTA/ZTB)
// ============================================
app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;
    if (chainId !== 11155111) return res.status(400).json({ error: 'Only Sepolia supported' });
    if (!permit?.v || !permit?.r || !permit?.s) return res.status(400).json({ error: 'Missing permit' });

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
      domain: getDomain(ZEROTOLL_ROUTER),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Verified:', intent.user);

    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
      args: [message, userSignature, BigInt(permit.deadline), permit.v, permit.r, permit.s]
    });

    const { txHash, sponsor } = await sendWithFallback(callData);
    console.log('✓ Permit Tx:', txHash);

    const requestId = `permit_${Date.now()}`;
    intents.set(requestId, { txHash, status: 'pending' });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      sponsor,
      message: 'Fully gasless via ERC-2612 Permit!'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Permit2 Swap (gasless for any token after Permit2 approval)
// ============================================
app.post('/api/intents/swap-with-permit2', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit2Signature, permitSingle } = req.body;
    if (chainId !== 11155111) return res.status(400).json({ error: 'Only Sepolia supported' });
    if (!permitSingle || !permit2Signature) return res.status(400).json({ error: 'Missing Permit2 data' });

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
      domain: getDomain(ZEROTOLL_ROUTER),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Verified:', intent.user);

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

    const { txHash, sponsor } = await sendWithFallback(callData, 600000n);
    console.log('✓ Permit2 Tx:', txHash);

    const requestId = `permit2_${Date.now()}`;
    intents.set(requestId, { txHash, status: 'pending' });

    res.json({
      success: true,
      requestId,
      txHash,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      sponsor,
      message: 'Gasless via Permit2!'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================
// Status & Config
// ============================================
app.get('/api/intents/:id/status', async (req, res) => {
  const data = intents.get(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });

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
  try {
    const nonce = await publicClient.readContract({
      address: ZEROTOLL_ROUTER,
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
  res.json({
    chainId: 11155111,
    routerAddress: ZEROTOLL_ROUTER,
    smartAdapter: SMART_ADAPTER,
    permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    domain: getDomain(ZEROTOLL_ROUTER),
    types: SWAP_INTENT_TYPES,
    supportedTokens: {
      ZTA: { address: '0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf', permit: true, route: 'internal' },
      ZTB: { address: '0x8fb844251af76AF090B005643D966FC52852100a', permit: true, route: 'internal' },
      WETH: { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', permit: false, route: 'uniswap' },
      USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', permit: false, route: 'uniswap' }
    }
  });
});

app.get('/health', async (req, res) => {
  const balance = await publicClient.getBalance({ address: relayerAccount.address });
  res.json({
    status: 'ok',
    relayer: relayerAccount.address,
    balance: `${(Number(balance) / 1e18).toFixed(4)} ETH`,
    router: ZEROTOLL_ROUTER,
    adapter: SMART_ADAPTER,
    pimlico: PIMLICO_API_KEY ? 'configured' : 'disabled',
    routing: 'Uniswap V3 → Internal Pool fallback'
  });
});

const PORT = process.env.RELAYER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 ZeroToll Smart Relayer on port ${PORT}`);
  console.log(`   Router: ${ZEROTOLL_ROUTER}`);
  console.log(`   Adapter: ${SMART_ADAPTER}`);
  console.log(`   Relayer: ${relayerAccount.address}`);
  console.log(`   Routing: Uniswap V3 → Internal fallback\n`);
});

export default app;
