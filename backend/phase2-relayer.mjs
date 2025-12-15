/**
 * ZeroToll Phase 2 Relayer
 * 
 * Uses Pimlico Bundler + Our VerifyingPaymasterV07
 * 
 * Architecture:
 *   User signs → Policy Server signs → Pimlico Bundler → Our Paymaster pays gas
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
  pad
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';

// Load env
config({ path: '.env' });
config({ path: '.env.credentials' });

const app = express();
app.use(cors());
app.use(express.json());

// Environment
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY;

if (!RELAYER_PRIVATE_KEY || !PIMLICO_API_KEY) {
  console.error('Missing RELAYER_PRIVATE_KEY or PIMLICO_API_KEY');
  process.exit(1);
}

// EntryPoint v0.7
const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const SIMPLE_ACCOUNT_FACTORY = '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985';

// Chain config
const CHAIN_CONFIG = {
  11155111: {
    name: 'sepolia',
    chain: sepolia,
    router: '0x577560699EF88e99f15d04df57c9552056d2a10D',
    paymaster: process.env.SEPOLIA_VERIFYING_PAYMASTER || '0xaf7e002447b790f212ea435f9387509cd1ef0054',
    pimlicoUrl: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`,
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io/tx/'
  },
  80002: {
    name: 'polygon-amoy',
    chain: polygonAmoy,
    router: '0xc75df1943d6EFE04b422b9bB45509782609Fc67a',
    paymaster: process.env.AMOY_VERIFYING_PAYMASTER || '0xaad1211a722ee04b6980724586b6b5b7b0c86fee',
    pimlicoUrl: `https://api.pimlico.io/v2/polygon-amoy/rpc?apikey=${PIMLICO_API_KEY}`,
    rpc: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com/tx/'
  }
};

// ABIs
const ROUTER_ABI = parseAbi([
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function executeSwap((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature) external returns (uint256)',
  'function nonces(address user) view returns (uint256)'
]);

const SIMPLE_ACCOUNT_FACTORY_ABI = parseAbi([
  'function getAddress(address owner, uint256 salt) view returns (address)',
  'function createAccount(address owner, uint256 salt) returns (address)'
]);

const SIMPLE_ACCOUNT_ABI = parseAbi([
  'function execute(address dest, uint256 value, bytes calldata func) external'
]);

const ENTRYPOINT_ABI = parseAbi([
  'function getNonce(address sender, uint192 key) view returns (uint256)',
  'function getUserOpHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
  'function balanceOf(address) view returns (uint256)'
]);

const PAYMASTER_ABI = parseAbi([
  'function getHash((address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)'
]);

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

// Accounts
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);
const policySignerAccount = relayerAccount; // Same key for now

console.log('Relayer EOA:', relayerAccount.address);
console.log('Policy Signer:', policySignerAccount.address);

// Storage
const intents = new Map();
const chainClients = {};

// Python backend URL for history saving
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

// Token address to symbol mapping
const TOKEN_SYMBOLS = {
  // Amoy (80002)
  '0x257fb36cd940d1f6a0a4659e8245d3c3fcecb8bd': 'zUSDC',
  '0xfae5fb760917682d67bc2082667c2c5e55a193f9': 'zETH',
  '0xb0a04ab21faae4a5399938c07eddfA0fb41d2b9d': 'zPOL',
  '0x51f6c79e5ca4acf086d0954afaaf5c72be56cbb1': 'zLINK',
  // Sepolia (11155111)
  '0x5f43d1fc4faad0dfe097fc3bb32d66a9864c730c': 'zUSDC',
  '0x8153fa09be1689d44c343f119c829f6702a8720b': 'zETH',
  '0x63c31c4247f6aa40b676478226d6feb5707649d6': 'zPOL',
  '0x4e2dbcc07d8e5a8c9f420ea60d1e3aec7b64d2c': 'zLINK',
};

// Get token symbol from address
function getTokenSymbol(address) {
  return TOKEN_SYMBOLS[address?.toLowerCase()] || address?.slice(0, 10) + '...';
}

// Save swap history to Python backend's MongoDB
async function saveSwapHistory(data) {
  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}/api/gasless-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (response.ok) {
      console.log('💾 Saved gasless swap to history');
    }
  } catch (e) {
    console.log('⚠️ Could not save to history:', e.message);
  }
}

// Initialize chain clients
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

  // Get Smart Account address
  const smartAccountAddress = await publicClient.readContract({
    address: SIMPLE_ACCOUNT_FACTORY,
    abi: SIMPLE_ACCOUNT_FACTORY_ABI,
    functionName: 'getAddress',
    args: [relayerAccount.address, 0n]
  });

  chainClients[chainId] = {
    publicClient,
    smartAccountAddress,
    chainConfig
  };

  console.log(`✓ ${chainConfig.name} initialized`);
  console.log(`  Smart Account: ${smartAccountAddress}`);
  console.log(`  Paymaster: ${chainConfig.paymaster || 'NOT SET'}`);

  return chainClients[chainId];
}

// Build paymasterAndData
function buildPaymasterAndData(paymaster, verificationGasLimit, postOpGasLimit, signature) {
  const verificationGasBytes = pad(toHex(verificationGasLimit), { size: 16 });
  const postOpGasBytes = pad(toHex(postOpGasLimit), { size: 16 });
  return concat([paymaster, verificationGasBytes, postOpGasBytes, signature]);
}

// Build and send UserOp
async function buildAndSendUserOp(chainId, callData) {
  const clients = await getChainClients(chainId);
  const { publicClient, smartAccountAddress, chainConfig } = clients;

  if (!chainConfig.paymaster) {
    throw new Error(`Paymaster not configured for ${chainConfig.name}`);
  }

  // Check if account exists
  const code = await publicClient.getCode({ address: smartAccountAddress });
  const accountExists = code && code !== '0x';

  // Get nonce
  let nonce = 0n;
  try {
    nonce = await publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: ENTRYPOINT_ABI,
      functionName: 'getNonce',
      args: [smartAccountAddress, 0n]
    });
  } catch (e) {
    console.log('Could not get nonce, using 0');
  }

  // Encode execute call
  const executeCallData = encodeFunctionData({
    abi: SIMPLE_ACCOUNT_ABI,
    functionName: 'execute',
    args: [chainConfig.router, 0n, callData]
  });

  // initCode
  let initCode = '0x';
  if (!accountExists) {
    const factoryData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'createAccount',
      args: [relayerAccount.address, 0n]
    });
    initCode = concat([SIMPLE_ACCOUNT_FACTORY, factoryData]);
  }

  // Get gas prices from Pimlico
  const gasPriceResponse = await fetch(chainConfig.pimlicoUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pimlico_getUserOperationGasPrice',
      params: []
    })
  });
  const gasPriceResult = await gasPriceResponse.json();
  const maxFeePerGas = BigInt(gasPriceResult.result?.fast?.maxFeePerGas || '50000000000');
  const maxPriorityFeePerGas = BigInt(gasPriceResult.result?.fast?.maxPriorityFeePerGas || '2000000000');

  // Pack gas limits
  const verificationGasLimit = 500000n;
  const callGasLimit = 500000n;
  const accountGasLimits = pad(toHex((verificationGasLimit << 128n) | callGasLimit), { size: 32 });
  const gasFees = pad(toHex((maxPriorityFeePerGas << 128n) | maxFeePerGas), { size: 32 });

  // Paymaster gas limits
  const paymasterVerificationGasLimit = 100000n;
  const paymasterPostOpGasLimit = 50000n;

  // Build paymasterAndData with dummy signature for hash calculation
  const paymasterAndDataForHash = buildPaymasterAndData(
    chainConfig.paymaster,
    paymasterVerificationGasLimit,
    paymasterPostOpGasLimit,
    '0x' + '00'.repeat(65)
  );

  // Build packed UserOp for hash
  const packedUserOpForHash = {
    sender: smartAccountAddress,
    nonce: nonce,
    initCode: initCode,
    callData: executeCallData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: 100000n,
    gasFees: gasFees,
    paymasterAndData: paymasterAndDataForHash,
    signature: '0x'
  };

  // Get hash from paymaster
  const hashToSign = await publicClient.readContract({
    address: chainConfig.paymaster,
    abi: PAYMASTER_ABI,
    functionName: 'getHash',
    args: [packedUserOpForHash]
  });

  // Sign with policy signer
  const paymasterSig = await policySignerAccount.signMessage({ message: { raw: hashToSign } });

  // Build final paymasterAndData
  const paymasterAndData = buildPaymasterAndData(
    chainConfig.paymaster,
    paymasterVerificationGasLimit,
    paymasterPostOpGasLimit,
    paymasterSig
  );

  // Get final UserOp hash for account signature
  const packedUserOpFinal = {
    sender: smartAccountAddress,
    nonce: nonce,
    initCode: initCode,
    callData: executeCallData,
    accountGasLimits: accountGasLimits,
    preVerificationGas: 100000n,
    gasFees: gasFees,
    paymasterAndData: paymasterAndData,
    signature: '0x'
  };

  const finalUserOpHash = await publicClient.readContract({
    address: ENTRYPOINT_V07,
    abi: ENTRYPOINT_ABI,
    functionName: 'getUserOpHash',
    args: [packedUserOpFinal]
  });

  // Sign for account
  const accountSig = await relayerAccount.signMessage({ message: { raw: finalUserOpHash } });

  // Build UserOp for Pimlico (unpacked format)
  const userOp = {
    sender: smartAccountAddress,
    nonce: toHex(nonce),
    callData: executeCallData,
    callGasLimit: toHex(callGasLimit),
    verificationGasLimit: toHex(verificationGasLimit),
    preVerificationGas: toHex(100000n),
    maxFeePerGas: toHex(maxFeePerGas),
    maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
    paymaster: chainConfig.paymaster,
    paymasterVerificationGasLimit: toHex(paymasterVerificationGasLimit),
    paymasterPostOpGasLimit: toHex(paymasterPostOpGasLimit),
    paymasterData: paymasterSig,
    signature: accountSig
  };

  // Add factory if needed
  if (!accountExists) {
    userOp.factory = SIMPLE_ACCOUNT_FACTORY;
    userOp.factoryData = encodeFunctionData({
      abi: SIMPLE_ACCOUNT_FACTORY_ABI,
      functionName: 'createAccount',
      args: [relayerAccount.address, 0n]
    });
  }

  // Send to Pimlico
  const response = await fetch(chainConfig.pimlicoUrl, {
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
    throw new Error(`Pimlico error: ${result.error.message}`);
  }

  return {
    userOpHash: result.result,
    smartAccountAddress
  };
}

// Wait for receipt
async function waitForReceipt(userOpHash, chainId, timeout = 60000) {
  const chainConfig = CHAIN_CONFIG[chainId];
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(chainConfig.pimlicoUrl, {
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

  return null;
}

// ============================================
// Swap with Permit Endpoint
// ============================================
app.post('/api/intents/swap-with-permit', async (req, res) => {
  try {
    const { chainId, intent, userSignature, permit } = req.body;
    
    const chainConfig = CHAIN_CONFIG[chainId];
    if (!chainConfig) {
      return res.status(400).json({ error: `Chain ${chainId} not supported` });
    }

    if (!chainConfig.paymaster) {
      return res.status(500).json({ error: `Paymaster not configured for ${chainConfig.name}` });
    }

    if (!permit?.v || !permit?.r || !permit?.s) {
      return res.status(400).json({ error: 'Missing permit' });
    }

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

    // Build and send UserOp
    console.log('Building and sending UserOp...');
    const { userOpHash, smartAccountAddress } = await buildAndSendUserOp(chainId, routerCallData);
    console.log('UserOp submitted:', userOpHash);

    const requestId = `phase2_${Date.now()}`;
    intents.set(requestId, { 
      userOpHash, 
      status: 'pending', 
      chainId,
      smartAccount: smartAccountAddress
    });

    // Wait for receipt (non-blocking) and save history
    waitForReceipt(userOpHash, chainId, 30000)
      .then(receipt => {
        const data = intents.get(requestId);
        if (data && receipt) {
          data.txHash = receipt.receipt?.transactionHash;
          data.status = receipt.success ? 'confirmed' : 'failed';
          intents.set(requestId, data);
          
          // Save to history with token symbols
          const tokenInSymbol = getTokenSymbol(intent.tokenIn);
          const tokenOutSymbol = getTokenSymbol(intent.tokenOut);
          const decimalsIn = tokenInSymbol.includes('USDC') ? 6 : 18;
          const decimalsOut = tokenOutSymbol.includes('USDC') ? 6 : 18;
          const amountInFormatted = (Number(intent.amountIn) / Math.pow(10, decimalsIn)).toFixed(4);
          const amountOutFormatted = (Number(intent.minAmountOut) / Math.pow(10, decimalsOut)).toFixed(4);
          
          saveSwapHistory({
            user: intent.user,
            fromChain: chainConfig.name === 'polygon-amoy' ? 'Polygon Amoy' : 'Sepolia',
            toChain: chainConfig.name === 'polygon-amoy' ? 'Polygon Amoy' : 'Sepolia',
            tokenIn: tokenInSymbol,
            tokenOut: tokenOutSymbol,
            amountIn: amountInFormatted,
            amountOut: amountOutFormatted,
            feeMode: 'GASLESS',
            feePaid: '0',
            feeToken: 'SPONSORED',
            status: receipt.success ? 'success' : 'failed',
            txHash: data.txHash,
            userOpHash: userOpHash,
            explorerUrl: `${chainConfig.explorer}${data.txHash}`,
            sponsor: 'ZeroToll Paymaster'
          });
        }
      })
      .catch(e => console.log('Receipt fetch failed:', e.message));

    res.json({
      success: true,
      requestId,
      userOpHash,
      smartAccount: smartAccountAddress,
      explorerUrl: `${chainConfig.explorer}${userOpHash}`,
      sponsor: 'ZeroToll Paymaster (Phase 2)',
      message: 'Gas sponsored by ZeroToll!'
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
    domain: getDomain(chainConfig.router, chainId),
    types: SWAP_INTENT_TYPES,
    mode: 'phase2-hybrid'
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
    
    const deposit = await clients.publicClient.readContract({
      address: ENTRYPOINT_V07,
      abi: ENTRYPOINT_ABI,
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

      return {
        chainId,
        name: config.name,
        smartAccount: clients?.smartAccountAddress,
        paymaster: config.paymaster || 'NOT SET'
      };
    })
  );

  res.json({
    status: 'ok',
    mode: 'phase2-hybrid (Pimlico bundler + our paymaster)',
    relayerEOA: relayerAccount.address,
    policySigner: policySignerAccount.address,
    entryPoint: ENTRYPOINT_V07,
    chains
  });
});

// Initialize and start
const PORT = process.env.PHASE2_RELAYER_PORT || 3002;

async function init() {
  console.log('\n' + '='.repeat(60));
  console.log('  ZEROTOLL PHASE 2 RELAYER');
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
    console.log(`🚀 Phase 2 Relayer running on port ${PORT}`);
    console.log(`   Relayer EOA: ${relayerAccount.address}`);
    console.log(`   Policy Signer: ${policySignerAccount.address}`);
    console.log(`   EntryPoint: ${ENTRYPOINT_V07}`);
    console.log('='.repeat(60) + '\n');
  });
}

init();

export default app;
