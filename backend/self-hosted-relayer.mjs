/**
 * ZeroToll Self-Hosted Relayer - Phase 2
 * 
 * Uses Infinitism bundler + VerifyingPaymaster instead of Pimlico
 * 
 * Architecture:
 *   User signs → Policy Server signs → Infinitism Bundler → VerifyingPaymaster pays gas
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
  toHex,
  concat,
  pad,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters
} from 'viem';
import { privateKeyToAccount, signMessage } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';

// Load both .env and .env.credentials
config({ path: '.env' });
config({ path: '.env.credentials' });

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const POLICY_SIGNER_KEY = process.env.POLICY_SIGNER_PRIVATE_KEY || RELAYER_PRIVATE_KEY;

if (!RELAYER_PRIVATE_KEY) {
  console.error('Missing RELAYER_PRIVATE_KEY');
  process.exit(1);
}

// EntryPoint v0.7 (same on all chains)
const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Multi-chain configuration
const CHAIN_CONFIG = {
  11155111: {
    name: 'sepolia',
    chain: sepolia,
    router: '0x577560699EF88e99f15d04df57c9552056d2a10D',
    paymaster: process.env.SEPOLIA_VERIFYING_PAYMASTER,
    bundlerUrl: process.env.BUNDLER_SEPOLIA_URL || 'http://localhost:3000/rpc',
    rpc: process.env.RPC_SEPOLIA || 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io/tx/'
  },
  80002: {
    name: 'polygon-amoy',
    chain: polygonAmoy,
    router: '0xc75df1943d6EFE04b422b9bB45509782609Fc67a',
    paymaster: process.env.AMOY_VERIFYING_PAYMASTER,
    bundlerUrl: process.env.BUNDLER_AMOY_URL || 'http://localhost:3001/rpc',
    rpc: process.env.RPC_AMOY || 'https://rpc-amoy.polygon.technology',
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
  'function executeSwap((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature) external returns (uint256)',
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]);

// Simple Account Factory ABI
const SIMPLE_ACCOUNT_FACTORY_ABI = parseAbi([
  'function createAccount(address owner, uint256 salt) returns (address)',
  'function getAddress(address owner, uint256 salt) view returns (address)'
]);

// Simple Account ABI
const SIMPLE_ACCOUNT_ABI = parseAbi([
  'function execute(address dest, uint256 value, bytes calldata func) external',
  'function getNonce() view returns (uint256)'
]);

// Accounts
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
const policySignerAccount = privateKeyToAccount(`0x${POLICY_SIGNER_KEY.replace('0x', '')}`);

console.log('Relayer EOA:', relayerAccount.address);
console.log('Policy Signer:', policySignerAccount.address);

// Storage
const intents = new Map();
const chainClients = {};

// Simple Account Factory address (same on all chains for v0.7)
const SIMPLE_ACCOUNT_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';

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

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc)
  });

  // Calculate Smart Account address (deterministic)
  let smartAccountAddress;
  try {
    smartAccountAddress = await publicClient.readContract({
      address: SIMPLE_ACCOUNT_FACTORY,
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'getAddress',
      args: [relayerAccount.address, 0n]
    });
  } catch (e) {
    // Factory might not be deployed, use pre-calculated address
    smartAccountAddress = calculateSmartAccountAddress(relayerAccount.address, 0n);
  }

  chainClients[chainId] = {
    publicClient,
    smartAccountAddress,
    chainConfig
  };

  console.log(`✓ ${chainConfig.name} initialized`);
  console.log(`  Smart Account: ${smartAccountAddress}`);
  console.log(`  Paymaster: ${chainConfig.paymaster || 'NOT SET'}`);
  console.log(`  Bundler: ${chainConfig.bundlerUrl}`);

  return chainClients[chainId];
}

// Calculate Smart Account address (CREATE2)
function calculateSmartAccountAddress(owner, salt) {
  // This is a simplified calculation - actual address depends on factory implementation
  return '0x' + keccak256(
    concat([
      '0xff',
      SIMPLE_ACCOUNT_FACTORY,
      pad(toHex(salt), { size: 32 }),
      keccak256(concat([owner]))
    ])
  ).slice(-40);
}

// Build UserOperation for ERC-4337 v0.7
async function buildUserOperation(chainId, callData) {
  const clients = await getChainClients(chainId);
  const { publicClient, smartAccountAddress, chainConfig } = clients;

  if (!chainConfig.paymaster) {
    throw new Error(`Paymaster not configured for ${chainConfig.name}. Set ${chainConfig.name.toUpperCase().replace('-', '_')}_VERIFYING_PAYMASTER`);
  }

  // Get nonce from EntryPoint
  let nonce = 0n;
  try {
    nonce = await publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: parseAbi(['function getNonce(address sender, uint192 key) view returns (uint256)']),
      functionName: 'getNonce',
      args: [smartAccountAddress, 0n]
    });
  } catch (e) {
    console.log('Could not get nonce, using 0');
  }

  // Encode execute call for Simple Account
  const executeCallData = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_ABI,
    functionName: 'execute',
    args: [chainConfig.router, 0n, callData]
  });

  // Check if account exists
  const code = await publicClient.getCode({ address: smartAccountAddress });
  const accountExists = code && code !== '0x';

  // Init code (only if account doesn't exist)
  let initCode = '0x';
  if (!accountExists) {
    const factoryCallData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'createAccount',
      args: [relayerAccount.address, 0n]
    });
    initCode = concat([SIMPLE_ACCOUNT_FACTORY, factoryCallData]);
  }

  // Get gas prices
  const feeData = await publicClient.estimateFeesPerGas();
  const maxFeePerGas = feeData.maxFeePerGas || 50000000000n;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || 2000000000n;

  // Build UserOp (v0.7 format)
  const userOp = {
    sender: smartAccountAddress,
    nonce: toHex(nonce),
    initCode: initCode,
    callData: executeCallData,
    callGasLimit: toHex(500000n),
    verificationGasLimit: toHex(500000n),
    preVerificationGas: toHex(100000n),
    maxFeePerGas: toHex(maxFeePerGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    paymasterAndData: chainConfig.paymaster, // Will be updated with signature
    signature: '0x' // Will be filled after signing
  };

  return userOp;
}

// Calculate UserOp hash for signing
function getUserOpHash(userOp, chainId) {
  const packed = encodeAbiParameters(
    parseAbiParameters('address, uint256, bytes32, bytes32, uint256, uint256, uint256, uint256, uint256, bytes32'),
    [
      userOp.sender,
      BigInt(userOp.nonce),
      keccak256(userOp.initCode),
      keccak256(userOp.callData),
      BigInt(userOp.callGasLimit),
      BigInt(userOp.verificationGasLimit),
      BigInt(userOp.preVerificationGas),
      BigInt(userOp.maxFeePerGas),
      BigInt(userOp.maxPriorityFeePerGas),
      keccak256(userOp.paymasterAndData)
    ]
  );

  const userOpHash = keccak256(packed);
  
  // Final hash includes entrypoint and chainId
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, uint256'),
      [userOpHash, ENTRYPOINT_V07, BigInt(chainId)]
    )
  );
}

// Sign UserOp with relayer's key (for Smart Account)
async function signUserOp(userOp, chainId) {
  const hash = getUserOpHash(userOp, chainId);
  const signature = await relayerAccount.signMessage({ message: { raw: hash } });
  return signature;
}

// Get paymaster signature from policy server (or sign locally)
async function getPaymasterSignature(userOpHash) {
  // For now, sign locally with policy signer
  // In production, this would call the policy server
  const signature = await policySignerAccount.signMessage({ message: { raw: userOpHash } });
  return signature;
}

// Send UserOp to bundler
async function sendUserOpToBundler(userOp, chainId) {
  const chainConfig = CHAIN_CONFIG[chainId];
  
  const response = await fetch(chainConfig.bundlerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendUserOperation',
      params: [userOp, ENTRYPOINT_V07]
    })
  });

  const result = await response.json();
  
  if (result.error) {
    throw new Error(`Bundler error: ${result.error.message || JSON.stringify(result.error)}`);
  }

  return result.result; // UserOp hash
}

// Wait for UserOp receipt
async function waitForUserOpReceipt(userOpHash, chainId, timeout = 60000) {
  const chainConfig = CHAIN_CONFIG[chainId];
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(chainConfig.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash]
        })
      });

      const result = await response.json();
      if (result.result) {
        return result.result;
      }
    } catch (e) {
      // Continue waiting
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error('Timeout waiting for UserOp receipt');
}

// ============================================
// Swap with ERC-2612 Permit (Self-Hosted)
// ============================================
app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;
    
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported` });
    }

    if (!chainConfig.paymaster) {
      return res.status(500).json({ 
        error: `Paymaster not configured for ${chainConfig.name}`,
        hint: 'Deploy VerifyingPaymaster and set env variable'
      });
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
    const routerCallData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
      args: [message, userSignature, BigInt(permit.deadline), permit.v, permit.r, permit.s]
    });

    // Build UserOp
    console.log('Building UserOp...');
    const userOp = await buildUserOperation(chainId, routerCallData);

    // Calculate UserOp hash
    const userOpHash = getUserOpHash(userOp, chainId);
    console.log('UserOp hash:', userOpHash);

    // Get paymaster signature
    const paymasterSig = await getPaymasterSignature(userOpHash);
    
    // Update paymasterAndData with signature (paymaster address + signature)
    userOp.paymasterAndData = concat([chainConfig.paymaster, paymasterSig]);

    // Sign UserOp with relayer key
    userOp.signature = await signUserOp(userOp, chainId);

    // Send to bundler
    console.log('Sending to bundler...');
    const opHash = await sendUserOpToBundler(userOp, chainId);
    console.log('UserOp submitted:', opHash);

    // Wait for receipt (async, don't block response)
    const requestId = `selfhosted_${Date.now()}`;
    intents.set(requestId, { 
      userOpHash: opHash, 
      status: 'pending', 
      chainId,
      smartAccount: clients.smartAccountAddress
    });

    // Try to get tx hash (non-blocking)
    waitForUserOpReceipt(opHash, chainId, 30000)
      .then(receipt => {
        const data = intents.get(requestId);
        if (data) {
          data.txHash = receipt.receipt?.transactionHash;
          data.status = receipt.success ? 'confirmed' : 'failed';
          intents.set(requestId, data);
        }
      })
      .catch(e => console.log('Receipt fetch failed:', e.message));

    res.json({
      success: true,
      requestId,
      userOpHash: opHash,
      smartAccount: clients.smartAccountAddress,
      explorerUrl: `${chainConfig.explorer}${opHash}`,
      sponsor: 'Self-Hosted Paymaster',
      message: 'Gas sponsored by ZeroToll Paymaster!'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Standard Swap (Self-Hosted)
// ============================================
app.post('/api/intents/swap', async (req, res) => {
  try {
    const { chainId, intent, userSignature } = req.body;
    
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported` });
    }

    if (!chainConfig.paymaster) {
      return res.status(500).json({ 
        error: `Paymaster not configured for ${chainConfig.name}` 
      });
    }

    const clients = await getChainClients(chainId);
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

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const routerCallData = encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: 'executeSwap',
      args: [message, userSignature]
    });

    const userOp = await buildUserOperation(chainId, routerCallData);
    const userOpHash = getUserOpHash(userOp, chainId);
    const paymasterSig = await getPaymasterSignature(userOpHash);
    
    userOp.paymasterAndData = concat([chainConfig.paymaster, paymasterSig]);
    userOp.signature = await signUserOp(userOp, chainId);

    const opHash = await sendUserOpToBundler(userOp, chainId);

    const requestId = `selfhosted_${Date.now()}`;
    intents.set(requestId, { userOpHash: opHash, status: 'pending', chainId });

    res.json({
      success: true,
      requestId,
      userOpHash: opHash,
      explorerUrl: `${chainConfig.explorer}${opHash}`,
      sponsor: 'Self-Hosted Paymaster',
      message: 'Gas sponsored by ZeroToll Paymaster!'
    });

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

  const chainConfig = CHAIN_CONFIG[data.chainId];
  res.json({
    requestId: req.params.id,
    status: data.status,
    userOpHash: data.userOpHash,
    txHash: data.txHash,
    explorerUrl: data.txHash ? `${chainConfig.explorer}${data.txHash}` : null
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
    chainId,
    routerAddress: chainConfig.router,
    smartAccountAddress: clients?.smartAccountAddress || 'not initialized',
    paymasterAddress: chainConfig.paymaster || 'NOT CONFIGURED',
    bundlerUrl: chainConfig.bundlerUrl,
    domain: getDomain(chainConfig.router, chainId),
    types: SWAP_INTENT_TYPES,
    mode: 'self-hosted'
  });
});

app.get('/api/paymaster/balance/:chainId', async (req, res) => {
  try {
    const chainId = parseInt(req.params.chainId);
    const chainConfig = CHAIN_CONFIG[chainId];
    
    if (!chainConfig || !chainConfig.paymaster) {
      return res.status(400).json({ error: 'Paymaster not configured' });
    }

    const clients = await getChainClients(chainId);
    
    // Get deposit from EntryPoint
    const deposit = await clients.publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
      functionName: 'balanceOf',
      args: [chainConfig.paymaster]
    });

    res.json({
      chainId,
      paymaster: chainConfig.paymaster,
      deposit: deposit.toString(),
      depositFormatted: (Number(deposit) / 1e18).toFixed(4),
      symbol: chainId === 80002 ? 'POL' : 'ETH'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', async (req, res) => {
  const chains = await Promise.all(
    Object.keys(CHAIN_CONFIG).map(async (id) => {
      const chainId = parseInt(id);
      const config = CHAIN_CONFIG[chainId];
      const clients = chainClients[chainId];
      
      let bundlerStatus = 'unknown';
      try {
        const response = await fetch(config.bundlerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
        });
        bundlerStatus = response.ok ? 'online' : 'offline';
      } catch (e) {
        bundlerStatus = 'offline';
      }

      return {
        chainId,
        name: config.name,
        smartAccount: clients?.smartAccountAddress,
        paymaster: config.paymaster || 'NOT SET',
        bundler: config.bundlerUrl,
        bundlerStatus
      };
    })
  );

  res.json({
    status: 'ok',
    mode: 'self-hosted',
    relayerEOA: relayerAccount.address,
    policySigner: policySignerAccount.address,
    entryPoint: ENTRYPOINT_V07,
    chains
  });
});

// Initialize and start
const PORT = process.env.SELF_HOSTED_RELAYER_PORT || 3002;

async function init() {
  console.log('\n' + '='.repeat(60));
  console.log('  ZEROTOLL SELF-HOSTED RELAYER - PHASE 2');
  console.log('='.repeat(60));
  
  // Initialize all chains
  for (const chainId of Object.keys(CHAIN_CONFIG)) {
    try {
      await getChainClients(parseInt(chainId));
    } catch (e) {
      console.error(`Failed to init ${CHAIN_CONFIG[chainId].name}:`, e.message);
    }
  }

  app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 Self-Hosted Relayer running on port ${PORT}`);
    console.log(`   Relayer EOA: ${relayerAccount.address}`);
    console.log(`   Policy Signer: ${policySignerAccount.address}`);
    console.log(`   EntryPoint: ${ENTRYPOINT_V07}`);
    console.log('='.repeat(60) + '\n');
  });
}

init();

export default app;
