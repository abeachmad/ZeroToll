/**
 * ZeroToll Pimlico Relayer - permissionless v0.3.x API
 * 
 * Uses the new v0.3.x API structure for Pimlico integration
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
  createWalletClient
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { entryPoint07Address } from 'viem/account-abstraction';
import { warnLegacyService } from '../legacy-service-warning.mjs';

config();
warnLegacyService('backend/legacy/pimlico-v3-relayer.mjs', 'backend/phase2-relayer.mjs');

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

// Multi-chain configuration (ZeroTollRouterV2)
const CHAIN_CONFIG = {
  11155111: {
    name: 'sepolia',
    router: '0x577560699EF88e99f15d04df57c9552056d2a10D', // ZeroTollRouterV2 (decimal fix)
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    pimlicoUrl: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`
  },
  80002: {
    name: 'polygon-amoy',
    router: '0xc75df1943d6EFE04b422b9bB45509782609Fc67a', // ZeroTollRouterV2 (decimal fix)
    rpc: 'https://rpc-amoy.polygon.technology',
    pimlicoUrl: `https://api.pimlico.io/v2/polygon-amoy/rpc?apikey=${PIMLICO_API_KEY}`
  }
};

// Default to Sepolia
const DEFAULT_CHAIN_ID = 11155111;
const ZEROTOLL_ROUTER = CHAIN_CONFIG[DEFAULT_CHAIN_ID].router;
const PIMLICO_URL = CHAIN_CONFIG[DEFAULT_CHAIN_ID].pimlicoUrl;

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


const getDomain = (routerAddress, chainId = 11155111) => ({
  name: 'ZeroTollRouter',
  version: '1',
  chainId: chainId,
  verifyingContract: routerAddress
});

const ROUTER_ABI = parseAbi([
  'function executeSwap((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature) external returns (uint256)',
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function executeSwapWithPermit2((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, (((address token, uint160 amount, uint48 expiration, uint48 nonce) details, address spender, uint256 sigDeadline) permitSingle, bytes signature) permit2Data) external returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]);

const intents = new Map();
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);

console.log('Relayer EOA:', relayerAccount.address);

// Multi-chain clients storage
const chainClients = {};

// Get or create chain-specific clients
async function getChainClients(chainId) {
  if (chainClients[chainId]) {
    return chainClients[chainId];
  }

  const chainConfig = CHAIN_CONFIG[chainId];
  if (!chainConfig) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  console.log(`Initializing clients for ${chainConfig.name}...`);

  // Import chain definition dynamically
  const { sepolia, polygonAmoy } = await import('viem/chains');
  const chain = chainId === 11155111 ? sepolia : polygonAmoy;

  // Create public client for this chain
  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpc)
  });

  // Create EOA wallet client for this chain (for relayer mode)
  const walletClient = createWalletClient({
    account: relayerAccount,
    chain,
    transport: http(chainConfig.rpc)
  });

  // Create Pimlico client for this chain
  const pimlicoClient = createPimlicoClient({
    transport: http(chainConfig.pimlicoUrl),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });

  // Create simple smart account for this chain
  const simpleAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: relayerAccount,
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });

  console.log(`Smart Account for ${chainConfig.name}:`, simpleAccount.address);

  // Create smart account client with Pimlico paymaster
  const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain,
    bundlerTransport: http(chainConfig.pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        return (await pimlicoClient.getUserOperationGasPrice()).fast;
      }
    }
  });

  chainClients[chainId] = {
    publicClient,
    walletClient,  // EOA wallet client for relayer mode
    pimlicoClient,
    smartAccountClient,
    smartAccountAddress: simpleAccount.address
  };

  console.log(`✓ ${chainConfig.name} clients initialized`);
  return chainClients[chainId];
}

// Helper: Send transaction with mode selection
// mode: 'pimlico' (default) = Smart Account + Pimlico paymaster
// mode: 'relayer' = EOA directly (relayer pays gas)
async function sendTransaction(clients, routerAddress, callData, mode = 'pimlico') {
  if (mode === 'relayer') {
    // EOA mode - relayer pays gas directly
    const balance = await clients.publicClient.getBalance({ address: relayerAccount.address });
    if (balance < BigInt(1e15)) {
      throw new Error('Relayer low on funds');
    }
    console.log('📤 Sending via EOA (relayer pays gas)');
    const txHash = await clients.walletClient.sendTransaction({
      to: routerAddress,
      data: callData,
      gas: 500000n
    });
    return { txHash, sponsor: 'Relayer EOA' };
  } else {
    // Pimlico mode - Smart Account + paymaster
    console.log('📤 Sending via Smart Account (Pimlico pays gas)');
    console.log('   Smart Account:', clients.smartAccountAddress);
    console.log('   Router:', routerAddress);
    try {
      const txHash = await clients.smartAccountClient.sendTransaction({
        to: routerAddress,
        data: callData,
        value: 0n
      });
      console.log('✅ UserOp tx hash:', txHash);
      console.log('   Note: "execution reverted" in explorer is normal for ERC-4337 postOp');
      return { txHash, sponsor: 'Pimlico Paymaster' };
    } catch (error) {
      console.error('❌ Smart Account sendTransaction error:', error.message);
      if (error.cause) {
        console.error('   Cause:', error.cause);
      }
      if (error.details) {
        console.error('   Details:', error.details);
      }
      throw error;
    }
  }
}

// Initialize default chain on startup
async function initSmartAccount() {
  try {
    console.log('Initializing Smart Accounts for all chains...');
    
    // Initialize both chains
    await getChainClients(11155111); // Sepolia
    await getChainClients(80002);    // Amoy
    
    console.log('✓ All Smart Account Clients initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Smart Account:', error.message);
    console.error(error.stack);
    return false;
  }
}


// ============================================
// Swap with ERC-2612 Permit (zTokens - fully gasless)
// ============================================
app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;
    
    // Get chain-specific config
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported. Supported: ${Object.keys(CHAIN_CONFIG).join(', ')}` });
    }
    
    if (!permit?.v || !permit?.r || !permit?.s) return res.status(400).json({ error: 'Missing permit' });

    // Get chain-specific Smart Account client
    const clients = await getChainClients(chainId);
    if (!clients?.smartAccountClient) {
      return res.status(500).json({ error: `Smart Account not initialized for chain ${chainId}` });
    }

    const routerAddress = chainConfig.router;
    
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

    console.log('Verifying signature with domain:', getDomain(routerAddress, chainId));
    
    const isValid = await verifyTypedData({
      address: message.user,
      domain: getDomain(routerAddress, chainId),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Verified swap intent from:', intent.user);

    console.log('📝 Permit params received:', {
      deadline: permit.deadline,
      v: permit.v,
      r: permit.r,
      s: permit.s,
      rLength: permit.r?.length,
      sLength: permit.s?.length
    });
    
    // Validate r and s are proper bytes32
    if (permit.r?.length !== 66) {
      console.log('⚠️ WARNING: r is not 66 chars (0x + 64 hex):', permit.r?.length);
    }
    if (permit.s?.length !== 66) {
      console.log('⚠️ WARNING: s is not 66 chars (0x + 64 hex):', permit.s?.length);
    }
    if (!permit.r?.startsWith('0x')) {
      console.log('⚠️ WARNING: r does not start with 0x');
    }
    if (!permit.s?.startsWith('0x')) {
      console.log('⚠️ WARNING: s does not start with 0x');
    }
    console.log('📝 Intent params:', {
      user: intent.user,
      tokenIn: intent.tokenIn,
      amountIn: intent.amountIn,
      nonce: intent.nonce
    });
    
    // Verify permit signature before sending
    const { verifyTypedData: verifyPermit } = await import('viem');
    try {
      const permitDomain = {
        name: 'ZeroToll USDC', // TODO: Get from token
        version: '1',
        chainId: chainId,
        verifyingContract: intent.tokenIn
      };
      const permitTypes = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };
      // Get permit nonce from token
      const permitNonce = await clients.publicClient.readContract({
        address: intent.tokenIn,
        abi: [{ name: 'nonces', type: 'function', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
        functionName: 'nonces',
        args: [intent.user]
      });
      console.log('📝 Token permit nonce:', permitNonce.toString());
      
      const permitMessage = {
        owner: intent.user,
        spender: routerAddress,
        value: BigInt(intent.amountIn),
        nonce: permitNonce,
        deadline: BigInt(permit.deadline)
      };
      console.log('📝 Permit message for verification:', permitMessage);
      
      // Reconstruct signature
      const permitSig = permit.r + permit.s.slice(2) + (permit.v < 27 ? permit.v + 27 : permit.v).toString(16).padStart(2, '0');
      console.log('📝 Reconstructed permit signature:', permitSig);
      
      const isPermitValid = await verifyPermit({
        address: getAddress(intent.user),
        domain: permitDomain,
        types: permitTypes,
        primaryType: 'Permit',
        message: permitMessage,
        signature: permitSig
      });
      console.log('📝 Permit signature valid:', isPermitValid);
    } catch (e) {
      console.log('⚠️ Permit verification failed:', e.message);
    }

    // Log the exact values being encoded
    console.log('📝 Encoding executeSwapWithPermit with:');
    console.log('   permitDeadline:', permit.deadline);
    console.log('   permitV:', permit.v, '(type:', typeof permit.v, ')');
    console.log('   permitR:', permit.r, '(length:', permit.r?.length, ')');
    console.log('   permitS:', permit.s, '(length:', permit.s?.length, ')');
    
    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
      args: [message, userSignature, BigInt(permit.deadline), permit.v, permit.r, permit.s]
    });
    
    // Verify the encoded calldata
    console.log('📝 Encoded callData length:', callData.length);

    // Get mode from request (default: pimlico)
    const mode = req.body.mode || 'pimlico';
    console.log(`Submitting swap on ${chainConfig.name} via ${mode} mode...`);

    try {
      const { txHash, sponsor } = await sendTransaction(clients, routerAddress, callData, mode);

      console.log('✓ Tx submitted:', txHash, '| Sponsor:', sponsor);

      const requestId = `${mode}_${Date.now()}`;
      intents.set(requestId, { txHash, status: 'pending', chainId });

      const explorerUrl = chainId === 80002 
        ? `https://amoy.polygonscan.com/tx/${txHash}`
        : `https://sepolia.etherscan.io/tx/${txHash}`;

      res.json({
        success: true,
        requestId,
        txHash,
        explorerUrl,
        sponsor,
        message: mode === 'relayer' ? 'Gas paid by relayer!' : 'Gas sponsored by Pimlico!'
      });
    } catch (txError) {
      console.error('Transaction failed:', txError.message);
      return res.status(500).json({ 
        error: 'Transaction failed', 
        details: txError.shortMessage || txError.message 
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Swap with Permit2 (gasless for any token after Permit2 approval)
// ============================================
app.post('/api/intents/swap-with-permit2', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit2Signature, permitSingle } = req.body;
    
    // Get chain-specific config
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported. Supported: ${Object.keys(CHAIN_CONFIG).join(', ')}` });
    }
    
    if (!permit2Signature || !permitSingle) return res.status(400).json({ error: 'Missing Permit2 data' });

    // Get chain-specific Smart Account client
    const clients = await getChainClients(chainId);
    if (!clients?.smartAccountClient) {
      return res.status(500).json({ error: `Smart Account not initialized for chain ${chainId}` });
    }

    const routerAddress = chainConfig.router;

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

    console.log('Verifying Permit2 signature with domain:', getDomain(routerAddress, chainId));

    const isValid = await verifyTypedData({
      address: message.user,
      domain: getDomain(routerAddress, chainId),
      types: SWAP_INTENT_TYPES,
      primaryType: 'SwapIntent',
      message,
      signature: userSignature
    });

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Verified swap intent from:', intent.user);

    // Permit2 permitSingle structure
    const permit2Data = {
      details: {
        token: getAddress(permitSingle.details.token),
        amount: BigInt(permitSingle.details.amount),
        expiration: BigInt(permitSingle.details.expiration),
        nonce: BigInt(permitSingle.details.nonce)
      },
      spender: getAddress(permitSingle.spender),
      sigDeadline: BigInt(permitSingle.sigDeadline)
    };

    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit2',
      args: [message, userSignature, permit2Data, permit2Signature]
    });

    // Get mode from request (default: pimlico)
    const mode = req.body.mode || 'pimlico';
    console.log(`Submitting Permit2 swap on ${chainConfig.name} via ${mode} mode...`);

    try {
      const { txHash, sponsor } = await sendTransaction(clients, routerAddress, callData, mode);

      console.log('✓ Permit2 tx submitted:', txHash, '| Sponsor:', sponsor);

      const requestId = `${mode}_permit2_${Date.now()}`;
      intents.set(requestId, { txHash, status: 'pending', chainId });

      const explorerUrl = chainId === 80002 
        ? `https://amoy.polygonscan.com/tx/${txHash}`
        : `https://sepolia.etherscan.io/tx/${txHash}`;

      res.json({
        success: true,
        requestId,
        txHash,
        explorerUrl,
        sponsor,
        message: mode === 'relayer' ? 'Gas paid by relayer (Permit2)!' : 'Gas sponsored by Pimlico (Permit2)!'
      });
    } catch (txError) {
      console.error('Permit2 tx failed:', txError.message);
      return res.status(500).json({ 
        error: 'Transaction failed', 
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
    
    // Get chain-specific config
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported. Supported: ${Object.keys(CHAIN_CONFIG).join(', ')}` });
    }

    // Get chain-specific Smart Account client
    const clients = await getChainClients(chainId);
    if (!clients?.smartAccountClient) {
      return res.status(500).json({ error: `Smart Account not initialized for chain ${chainId}` });
    }

    const routerAddress = chainConfig.router;

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

    if (!isValid) return res.status(400).json({ error: 'Invalid signature' });
    console.log('✓ Verified swap intent from:', intent.user);

    const callData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwap',
      args: [message, userSignature]
    });

    // Get mode from request (default: pimlico)
    const mode = req.body.mode || 'pimlico';
    console.log(`Submitting swap on ${chainConfig.name} via ${mode} mode...`);

    try {
      const { txHash, sponsor } = await sendTransaction(clients, routerAddress, callData, mode);

      console.log('✓ Tx submitted:', txHash, '| Sponsor:', sponsor);

      const requestId = `${mode}_${Date.now()}`;
      intents.set(requestId, { txHash, status: 'pending', chainId });

      const explorerUrl = chainId === 80002 
        ? `https://amoy.polygonscan.com/tx/${txHash}`
        : `https://sepolia.etherscan.io/tx/${txHash}`;

      res.json({
        success: true,
        requestId,
        txHash,
        explorerUrl,
        sponsor,
        message: mode === 'relayer' ? 'Gas paid by relayer!' : 'Gas sponsored by Pimlico!'
      });
    } catch (txError) {
      console.error('Tx failed:', txError.message);
      return res.status(500).json({ 
        error: 'Transaction failed', 
        details: txError.shortMessage || txError.message 
      });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============================================
// Status & Config Endpoints
// ============================================
app.get('/api/intents/:id/status', async (req, res) => {
  const data = intents.get(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found' });

  // Try to get receipt from the appropriate chain
  const chainId = data.chainId || 11155111;
  try {
    const clients = await getChainClients(chainId);
    const receipt = await clients.publicClient.getTransactionReceipt({ hash: data.txHash });
    if (receipt) {
      data.status = receipt.status === 'success' ? 'confirmed' : 'failed';
      intents.set(req.params.id, data);
    }
  } catch (e) {}

  const explorerUrl = data.chainId === 80002
    ? `https://amoy.polygonscan.com/tx/${data.txHash}`
    : `https://sepolia.etherscan.io/tx/${data.txHash}`;

  res.json({
    requestId: req.params.id,
    status: data.status,
    txHash: data.txHash,
    explorerUrl
  });
});

app.get('/api/nonce/:chainId/:address', async (req, res) => {
  try {
    const chainId = parseInt(req.params.chainId);
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported` });
    }
    
    const clients = await getChainClients(chainId);
    const nonce = await clients.publicClient.readContract({
      address: chainConfig.router,
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
  const chainConfig = CHAIN_CONFIG[chainId];
  
  if (!chainConfig) {
    return res.status(400).json({ error: `Chain ${chainId} not supported` });
  }
  
  const clients = chainClients[chainId];
  
  res.json({
    chainId: chainId,
    routerAddress: chainConfig.router,
    smartAccountAddress: clients?.smartAccountAddress || 'not initialized',
    domain: getDomain(chainConfig.router, chainId),
    types: SWAP_INTENT_TYPES,
    paymaster: 'Pimlico Verifying Paymaster'
  });
});

app.get('/health', (req, res) => {
  const chains = Object.keys(chainClients).map(id => ({
    chainId: parseInt(id),
    name: CHAIN_CONFIG[id]?.name,
    smartAccount: chainClients[id]?.smartAccountAddress,
    ready: !!chainClients[id]?.smartAccountClient
  }));

  res.json({
    status: Object.keys(chainClients).length > 0 ? 'ok' : 'initializing',
    relayerEOA: relayerAccount.address,
    chains,
    routers: CHAIN_CONFIG,
    paymaster: 'Pimlico',
    pimlicoConfigured: !!PIMLICO_API_KEY
  });
});

// Initialize and start
const PORT = process.env.RELAYER_PORT || 3001;

initSmartAccount().then((success) => {
  app.listen(PORT, () => {
    console.log(`\n🚀 ZeroToll Pimlico Relayer (v0.3.x) on port ${PORT}`);
    console.log(`   Relayer EOA: ${relayerAccount.address}`);
    console.log(`   Paymaster: Pimlico Verifying Paymaster`);
    console.log(`   Chains:`);
    Object.entries(CHAIN_CONFIG).forEach(([id, config]) => {
      const client = chainClients[id];
      console.log(`     - ${config.name}: ${client?.smartAccountAddress || 'not initialized'}`);
    });
    console.log(`   Status: ${success ? '✓ Ready' : '⚠ Initialization failed'}\n`);
  });
});

export default app;
