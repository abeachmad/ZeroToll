/**
 * ZeroToll Pimlico Relayer - Fixed Version
 * 
 * Uses permissionless v0.2.x API which is stable with Pimlico
 * Pimlico pays gas via Verifying Paymaster
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
  createClient
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
  createSmartAccountClient,
  ENTRYPOINT_ADDRESS_V07
} from 'permissionless';
import { signerToSimpleSmartAccount } from 'permissionless/accounts';
import {
  createPimlicoBundlerClient,
  createPimlicoPaymasterClient
} from 'permissionless/clients/pimlico';

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

if (!PIMLICO_API_KEY) {
  console.error('Missing PIMLICO_API_KEY');
  process.exit(1);
}

const ZEROTOLL_ROUTER = '0xd475255Ae38C92404f9740A19F93B8D2526A684b';
const PIMLICO_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

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
  'function nonces(address user) view returns (uint256)'
]);

const intents = new Map();
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);

console.log('Relayer EOA:', relayerAccount.address);

// Initialize clients
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const bundlerClient = createPimlicoBundlerClient({
  transport: http(PIMLICO_URL),
  entryPoint: ENTRYPOINT_ADDRESS_V07
});

const paymasterClient = createPimlicoPaymasterClient({
  transport: http(PIMLICO_URL),
  entryPoint: ENTRYPOINT_ADDRESS_V07
});

let smartAccountClient = null;
let smartAccountAddress = null;

async function initSmartAccount() {
  try {
    console.log('Initializing Smart Account...');
    
    const simpleAccount = await signerToSimpleSmartAccount(publicClient, {
      signer: relayerAccount,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      factoryAddress: '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985' // Simple Account Factory v0.7
    });

    smartAccountAddress = simpleAccount.address;
    console.log('Smart Account:', smartAccountAddress);

    smartAccountClient = createSmartAccountClient({
      account: simpleAccount,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      chain: sepolia,
      bundlerTransport: http(PIMLICO_URL),
      middleware: {
        gasPrice: async () => {
          return (await bundlerClient.getUserOperationGasPrice()).fast;
        },
        sponsorUserOperation: paymasterClient.sponsorUserOperation
      }
    });

    console.log('✓ Smart Account Client initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Smart Account:', error.message);
    return false;
  }
}


// ============================================
// Swap with ERC-2612 Permit (ZTA/ZTB - fully gasless)
// ============================================
app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;
    if (chainId !== 11155111) return res.status(400).json({ error: 'Only Sepolia supported' });
    if (!permit?.v || !permit?.r || !permit?.s) return res.status(400).json({ error: 'Missing permit' });

    if (!smartAccountClient) {
      return res.status(500).json({ error: 'Smart Account not initialized' });
    }

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

    console.log('Submitting UserOperation via Pimlico...');

    try {
      const txHash = await smartAccountClient.sendTransaction({
        to: ZEROTOLL_ROUTER,
        data: callData,
        value: 0n
      });

      console.log('✓ UserOp submitted, tx:', txHash);

      const requestId = `pimlico_${Date.now()}`;
      intents.set(requestId, { txHash, status: 'pending' });

      res.json({
        success: true,
        requestId,
        txHash,
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
        sponsor: 'Pimlico Paymaster',
        message: 'Gas sponsored by Pimlico!'
      });
    } catch (txError) {
      console.error('UserOp failed:', txError.message);
      return res.status(500).json({ 
        error: 'UserOperation failed', 
        details: txError.shortMessage || txError.message 
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Standard Swap (requires prior approval)
// ============================================
app.post('/api/intents/swap', async (req, res) => {
  try {
    const { chainId, intent, userSignature } = req.body;
    if (chainId !== 11155111) return res.status(400).json({ error: 'Only Sepolia supported' });

    if (!smartAccountClient) {
      return res.status(500).json({ error: 'Smart Account not initialized' });
    }

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

    console.log('Submitting UserOperation via Pimlico...');

    try {
      const txHash = await smartAccountClient.sendTransaction({
        to: ZEROTOLL_ROUTER,
        data: callData,
        value: 0n
      });

      console.log('✓ UserOp submitted, tx:', txHash);

      const requestId = `pimlico_${Date.now()}`;
      intents.set(requestId, { txHash, status: 'pending' });

      res.json({
        success: true,
        requestId,
        txHash,
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
        sponsor: 'Pimlico Paymaster'
      });
    } catch (txError) {
      console.error('UserOp failed:', txError.message);
      return res.status(500).json({ 
        error: 'UserOperation failed', 
        details: txError.shortMessage || txError.message 
      });
    }
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
    smartAccountAddress,
    domain: getDomain(ZEROTOLL_ROUTER),
    types: SWAP_INTENT_TYPES,
    paymaster: 'Pimlico Verifying Paymaster'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: smartAccountClient ? 'ok' : 'initializing',
    relayerEOA: relayerAccount.address,
    smartAccount: smartAccountAddress,
    router: ZEROTOLL_ROUTER,
    paymaster: 'Pimlico',
    pimlicoConfigured: !!PIMLICO_API_KEY
  });
});

// Initialize and start
const PORT = process.env.RELAYER_PORT || 3001;

initSmartAccount().then((success) => {
  app.listen(PORT, () => {
    console.log(`\n🚀 ZeroToll Pimlico Relayer on port ${PORT}`);
    console.log(`   Router: ${ZEROTOLL_ROUTER}`);
    console.log(`   Relayer EOA: ${relayerAccount.address}`);
    console.log(`   Smart Account: ${smartAccountAddress || 'initializing...'}`);
    console.log(`   Paymaster: Pimlico Verifying Paymaster`);
    console.log(`   Status: ${success ? '✓ Ready' : '⚠ Initialization failed'}\n`);
  });
});

export default app;
