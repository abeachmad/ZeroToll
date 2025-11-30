/**
 * Gasless Transaction API - Node.js Backend
 * 
 * This handles EIP-7702 gasless transactions using direct Pimlico API calls.
 * 
 * The key insight: We can't use toMetaMaskSmartAccount without a real private key,
 * but we CAN manually construct UserOperations and use Pimlico's API directly.
 * 
 * Flow:
 * 1. POST /api/gasless/prepare - Prepare UserOp, return hash to sign
 * 2. POST /api/gasless/submit - Submit signed UserOp to bundler
 */

import express from 'express';
import cors from 'cors';
import { createPublicClient, http, keccak256, encodeAbiParameters, concat, toHex, pad, encodeFunctionData, formatUnits } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { entryPoint07Address } from 'viem/account-abstraction';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

const CHAINS = {
  80002: {
    chain: polygonAmoy,
    name: 'Polygon Amoy',
    rpc: 'https://rpc-amoy.polygon.technology',
    pimlicoRpc: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    explorer: 'https://amoy.polygonscan.com'
  },
  11155111: {
    chain: sepolia,
    name: 'Ethereum Sepolia', 
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    pimlicoRpc: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    explorer: 'https://sepolia.etherscan.io'
  }
};

// Store pending UserOps (in production, use Redis)
const pendingUserOps = new Map();

// Import encodeCalls from smart-accounts-kit - this is the key!
import { encodeCalls } from '@metamask/smart-accounts-kit/utils';

/**
 * Get nonce from EntryPoint
 */
async function getAccountNonce(publicClient, address) {
  try {
    const nonce = await publicClient.readContract({
      address: entryPoint07Address,
      abi: [{
        name: 'getNonce',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'sender', type: 'address' },
          { name: 'key', type: 'uint192' }
        ],
        outputs: [{ type: 'uint256' }]
      }],
      functionName: 'getNonce',
      args: [address, 0n]
    });
    return nonce;
  } catch (e) {
    console.log('Nonce fetch error, using 0:', e.message);
    return 0n;
  }
}

/**
 * Compute UserOperation hash for signing (EIP-4337 v0.7)
 */
function computeUserOpHash(userOp, chainId) {
  const packedUserOp = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' },
    ],
    [
      userOp.sender,
      BigInt(userOp.nonce),
      keccak256('0x'),
      keccak256(userOp.callData),
      packAccountGasLimits(BigInt(userOp.verificationGasLimit), BigInt(userOp.callGasLimit)),
      BigInt(userOp.preVerificationGas),
      packGasFees(BigInt(userOp.maxPriorityFeePerGas), BigInt(userOp.maxFeePerGas)),
      keccak256(packPaymasterAndData(userOp)),
    ]
  );

  const userOpHashInner = keccak256(packedUserOp);
  
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [userOpHashInner, entryPoint07Address, BigInt(chainId)]
    )
  );
}

function packAccountGasLimits(verificationGasLimit, callGasLimit) {
  const vgl = pad(toHex(verificationGasLimit), { size: 16 });
  const cgl = pad(toHex(callGasLimit), { size: 16 });
  return concat([vgl, cgl]);
}

function packGasFees(maxPriorityFeePerGas, maxFeePerGas) {
  const mpfpg = pad(toHex(maxPriorityFeePerGas), { size: 16 });
  const mfpg = pad(toHex(maxFeePerGas), { size: 16 });
  return concat([mpfpg, mfpg]);
}

function packPaymasterAndData(userOp) {
  if (!userOp.paymaster) return '0x';
  
  const paymaster = userOp.paymaster;
  const pvgl = pad(toHex(BigInt(userOp.paymasterVerificationGasLimit || 0)), { size: 16 });
  const ppogl = pad(toHex(BigInt(userOp.paymasterPostOpGasLimit || 0)), { size: 16 });
  const paymasterData = userOp.paymasterData || '0x';
  
  return concat([paymaster, pvgl, ppogl, paymasterData]);
}

/**
 * Check if address has Smart Account enabled
 */
app.get('/api/gasless/check/:address/:chainId', async (req, res) => {
  try {
    const { address, chainId } = req.params;
    const chainConfig = CHAINS[parseInt(chainId)];
    
    if (!chainConfig) {
      return res.json({ enabled: false, error: 'Unsupported chain' });
    }

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    const code = await publicClient.getCode({ address });
    const isSmartAccount = code && code.startsWith('0xef0100');
    const delegator = isSmartAccount ? '0x' + code.substring(8, 48) : null;

    res.json({
      enabled: isSmartAccount,
      delegator,
      chain: chainConfig.name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Prepare a gasless transaction - returns UserOp and hash for user to sign
 */
app.post('/api/gasless/prepare', async (req, res) => {
  try {
    const { address, chainId, calls } = req.body;
    
    if (!address || !chainId || !calls) {
      return res.status(400).json({ error: 'Missing address, chainId, or calls' });
    }

    const chainConfig = CHAINS[parseInt(chainId)];
    if (!chainConfig) {
      return res.status(400).json({ error: 'Unsupported chain' });
    }

    console.log(`\n🔧 Preparing gasless TX for ${address} on ${chainConfig.name}`);
    console.log(`   Calls: ${calls.length}`);

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    // Verify Smart Account is enabled
    const code = await publicClient.getCode({ address });
    if (!code || !code.startsWith('0xef0100')) {
      return res.status(400).json({ 
        error: 'Smart Account not enabled',
        hint: 'Enable Smart Account in MetaMask settings first'
      });
    }

    // Get nonce from EntryPoint
    const nonce = await getAccountNonce(publicClient, address);
    console.log('   Nonce:', nonce.toString());

    // Encode calls using MetaMask's encodeCalls function
    const preparedCalls = calls.map(c => ({
      to: c.to,
      data: c.data || '0x',
      value: BigInt(c.value || 0)
    }));
    const callData = encodeCalls(preparedCalls);
    console.log('   CallData encoded using smart-accounts-kit');

    // Get gas prices from Pimlico
    const gasPriceResponse = await fetch(chainConfig.pimlicoRpc, {
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
    const gasPrices = gasPriceResult.result?.fast || gasPriceResult.result?.standard;
    console.log('   Gas prices fetched');

    // Build initial UserOp
    const userOp = {
      sender: address,
      nonce: toHex(nonce),
      callData: callData,
      callGasLimit: toHex(500000n),
      verificationGasLimit: toHex(500000n),
      preVerificationGas: toHex(100000n),
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      signature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
    };

    // Get paymaster sponsorship from Pimlico
    console.log('   Requesting paymaster sponsorship...');
    const paymasterResponse = await fetch(chainConfig.pimlicoRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'pm_sponsorUserOperation',
        params: [userOp, entryPoint07Address]
      })
    });

    const paymasterResult = await paymasterResponse.json();
    
    if (paymasterResult.error) {
      console.error('   Paymaster error:', paymasterResult.error);
      return res.status(400).json({ 
        error: `Paymaster error: ${paymasterResult.error.message || JSON.stringify(paymasterResult.error)}` 
      });
    }

    console.log('   ✅ Paymaster sponsorship received');

    // Update UserOp with paymaster data
    const sponsoredOp = {
      sender: address,
      nonce: toHex(nonce),
      callData: callData,
      callGasLimit: paymasterResult.result.callGasLimit,
      verificationGasLimit: paymasterResult.result.verificationGasLimit,
      preVerificationGas: paymasterResult.result.preVerificationGas,
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      paymaster: paymasterResult.result.paymaster,
      paymasterData: paymasterResult.result.paymasterData,
      paymasterVerificationGasLimit: paymasterResult.result.paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: paymasterResult.result.paymasterPostOpGasLimit
    };

    // Import the typed data format from smart-accounts-kit
    const { toPackedUserOperation } = await import('viem/account-abstraction');
    
    // Create packed UserOp for signing
    const packedUserOp = toPackedUserOperation({
      sender: address,
      nonce: nonce,
      callData: callData,
      callGasLimit: BigInt(paymasterResult.result.callGasLimit),
      verificationGasLimit: BigInt(paymasterResult.result.verificationGasLimit),
      preVerificationGas: BigInt(paymasterResult.result.preVerificationGas),
      maxFeePerGas: BigInt(gasPrices.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(gasPrices.maxPriorityFeePerGas),
      paymaster: paymasterResult.result.paymaster,
      paymasterData: paymasterResult.result.paymasterData,
      paymasterVerificationGasLimit: BigInt(paymasterResult.result.paymasterVerificationGasLimit),
      paymasterPostOpGasLimit: BigInt(paymasterResult.result.paymasterPostOpGasLimit),
      signature: '0x'
    });

    // Convert BigInts to strings for JSON serialization
    const serializablePackedUserOp = {
      sender: packedUserOp.sender,
      nonce: packedUserOp.nonce.toString(),
      initCode: packedUserOp.initCode,
      callData: packedUserOp.callData,
      accountGasLimits: packedUserOp.accountGasLimits,
      preVerificationGas: packedUserOp.preVerificationGas.toString(),
      gasFees: packedUserOp.gasFees,
      paymasterAndData: packedUserOp.paymasterAndData
    };

    // Build the EIP-712 typed data for signing
    const typedData = {
      domain: {
        chainId: parseInt(chainId),
        name: 'EIP7702StatelessDeleGator',
        version: '1',
        verifyingContract: address
      },
      types: {
        PackedUserOperation: [
          { name: 'sender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'initCode', type: 'bytes' },
          { name: 'callData', type: 'bytes' },
          { name: 'accountGasLimits', type: 'bytes32' },
          { name: 'preVerificationGas', type: 'uint256' },
          { name: 'gasFees', type: 'bytes32' },
          { name: 'paymasterAndData', type: 'bytes' },
          { name: 'entryPoint', type: 'address' }
        ]
      },
      primaryType: 'PackedUserOperation',
      message: {
        ...serializablePackedUserOp,
        entryPoint: entryPoint07Address
      }
    };

    console.log('   Typed data prepared for signing');

    // Compute the UserOp hash for fallback signing (personal_sign)
    const userOpHash = computeUserOpHash(sponsoredOp, chainId);
    console.log('   UserOp hash computed:', userOpHash);

    // Generate a unique ID for this pending operation
    const opId = `${address}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the prepared UserOp
    pendingUserOps.set(opId, {
      userOp: sponsoredOp,
      chainId: parseInt(chainId),
      address,
      userOpHash,
      createdAt: Date.now()
    });

    // Clean up old pending ops (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of pendingUserOps.entries()) {
      if (value.createdAt < fiveMinutesAgo) {
        pendingUserOps.delete(key);
      }
    }

    res.json({
      success: true,
      opId,
      userOp: sponsoredOp,
      typedData,
      userOpHash, // Include hash for fallback signing
      chainId,
      message: 'Sign this typed data in MetaMask'
    });

  } catch (error) {
    console.error('Prepare error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Submit a signed gasless transaction
 */
app.post('/api/gasless/submit', async (req, res) => {
  try {
    const { opId, signature } = req.body;
    
    if (!opId || !signature) {
      return res.status(400).json({ error: 'Missing opId or signature' });
    }

    const pending = pendingUserOps.get(opId);
    if (!pending) {
      return res.status(400).json({ error: 'Operation not found or expired' });
    }

    const { userOp, chainId, address } = pending;
    const chainConfig = CHAINS[chainId];

    console.log(`\n🚀 Submitting gasless TX for ${address}`);

    // Add signature to UserOp
    const signedUserOp = {
      ...userOp,
      signature
    };

    // Submit to bundler via JSON-RPC
    console.log('   Sending to bundler...');
    const submitResponse = await fetch(chainConfig.pimlicoRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [signedUserOp, entryPoint07Address]
      })
    });

    const submitResult = await submitResponse.json();
    
    if (submitResult.error) {
      console.error('   Bundler error:', submitResult.error);
      return res.status(400).json({ 
        error: `Bundler error: ${submitResult.error.message || JSON.stringify(submitResult.error)}` 
      });
    }

    const userOpHash = submitResult.result;
    console.log('   UserOp Hash:', userOpHash);

    // Poll for receipt
    console.log('   Waiting for confirmation...');
    let receipt = null;
    const startTime = Date.now();
    const timeout = 120000;

    while (!receipt && Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, 2000));
      
      const receiptResponse = await fetch(chainConfig.pimlicoRpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash]
        })
      });

      const receiptResult = await receiptResponse.json();
      if (receiptResult.result) {
        receipt = receiptResult.result;
      }
    }

    if (!receipt) {
      return res.status(408).json({ error: 'Transaction confirmation timeout' });
    }

    console.log('   TX Hash:', receipt.receipt.transactionHash);
    console.log('   Success:', receipt.success);

    // Clean up
    pendingUserOps.delete(opId);

    res.json({
      success: receipt.success,
      userOpHash,
      txHash: receipt.receipt.transactionHash,
      explorerUrl: `${chainConfig.explorer}/tx/${receipt.receipt.transactionHash}`,
      gasless: true,
      message: receipt.success 
        ? '🎉 GASLESS transaction successful! You paid $0 in gas!'
        : 'Transaction failed on-chain'
    });

  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Direct gasless execution (for testing with private key)
 * Uses @metamask/smart-accounts-kit which works in Node.js
 * WARNING: Only use for testing! Never expose private keys in production.
 */
app.post('/api/gasless/execute-direct', async (req, res) => {
  try {
    const { chainId, calls, privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({ error: 'Private key required for direct execution' });
    }

    const chainConfig = CHAINS[parseInt(chainId)];
    if (!chainConfig) {
      return res.status(400).json({ error: 'Unsupported chain' });
    }

    // Dynamic imports for the direct execution path
    const { privateKeyToAccount } = await import('viem/accounts');
    const { createWalletClient } = await import('viem');
    const { createBundlerClient } = await import('viem/account-abstraction');
    const { createPimlicoClient } = await import('permissionless/clients/pimlico');
    const { toMetaMaskSmartAccount } = await import('@metamask/smart-accounts-kit');

    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    // Verify Smart Account
    const code = await publicClient.getCode({ address: account.address });
    if (!code || !code.startsWith('0xef0100')) {
      return res.status(400).json({ error: 'Smart Account not enabled' });
    }

    // Get initial balance
    const initialBalance = await publicClient.getBalance({ address: account.address });

    // Create Smart Account
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: 'Stateless7702',
      address: account.address,
      signer: { walletClient }
    });

    // Create Pimlico client
    const pimlicoClient = createPimlicoClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.pimlicoRpc),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7'
      }
    });

    // Create bundler client
    const bundlerClient = createBundlerClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.pimlicoRpc),
      account: smartAccount,
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrices = await pimlicoClient.getUserOperationGasPrice();
          return gasPrices.fast;
        }
      }
    });

    // Prepare calls
    const preparedCalls = calls.map(c => ({
      to: c.to,
      data: c.data || '0x',
      value: BigInt(c.value || 0)
    }));

    // Send UserOperation
    const userOpHash = await bundlerClient.sendUserOperation({ calls: preparedCalls });
    console.log('UserOp Hash:', userOpHash);

    // Wait for receipt
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120000
    });

    // Check final balance
    const finalBalance = await publicClient.getBalance({ address: account.address });
    const gasPaid = initialBalance - finalBalance;

    res.json({
      success: receipt.success,
      userOpHash,
      txHash: receipt.receipt.transactionHash,
      explorerUrl: `${chainConfig.explorer}/tx/${receipt.receipt.transactionHash}`,
      gasless: gasPaid === 0n,
      gasPaid: formatUnits(gasPaid, 18),
      message: gasPaid === 0n 
        ? '🎉 TRUE GASLESS! You paid $0 in gas!'
        : `Gas paid: ${formatUnits(gasPaid, 18)}`
    });

  } catch (error) {
    console.error('Direct execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.GASLESS_API_PORT || 3002;

app.listen(PORT, () => {
  console.log(`\n🚀 Gasless API running on http://localhost:${PORT}`);
  console.log('   Endpoints:');
  console.log('   - GET  /api/gasless/check/:address/:chainId');
  console.log('   - POST /api/gasless/prepare');
  console.log('   - POST /api/gasless/submit');
  console.log('   - POST /api/gasless/execute-direct (testing only)\n');
});

export default app;
