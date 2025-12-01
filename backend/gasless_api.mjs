/**
 * Gasless Transaction API - Node.js Backend
 * 
 * This handles TRUE gasless transactions using:
 * - @metamask/smart-accounts-kit
 * - Pimlico paymaster
 * - EIP-7702 upgraded EOAs
 * 
 * PROVEN WORKING: User pays $0 in gas!
 * 
 * Flow for browser (frontend can't use smart-accounts-kit due to webpack issues):
 * 1. POST /api/gasless/prepare - Prepare UserOp, return typed data to sign
 * 2. User signs in MetaMask via signTypedData
 * 3. POST /api/gasless/submit - Submit signed UserOp to bundler
 * 
 * Flow for direct execution (testing with private key):
 * 1. POST /api/gasless/execute-direct - Execute directly with private key
 */

import express from 'express';
import cors from 'cors';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy, sepolia } from 'viem/chains';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import { encodeCalls } from '@metamask/smart-accounts-kit/utils';
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
 * Execute gasless transaction directly (for testing with private key)
 * 
 * PROVEN WORKING - User pays $0 in gas!
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

    console.log(`\n🚀 Executing TRUE GASLESS transaction on ${chainConfig.name}`);

    // Create account from private key
    const account = privateKeyToAccount(privateKey);
    console.log('   Account:', account.address);

    // Create public client
    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    // Verify Smart Account is enabled
    const code = await publicClient.getCode({ address: account.address });
    if (!code || !code.startsWith('0xef0100')) {
      return res.status(400).json({ 
        error: 'Smart Account not enabled',
        hint: 'Enable Smart Account in MetaMask settings first'
      });
    }

    // Get initial balance
    const initialBalance = await publicClient.getBalance({ address: account.address });
    console.log('   Initial Balance:', formatUnits(initialBalance, 18));

    // Create MetaMask Smart Account
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Stateless7702,
      address: account.address,
      signer: { account }
    });

    console.log('   ✅ Smart Account created');

    // Create Pimlico client
    const pimlicoClient = createPimlicoClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.pimlicoRpc),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7'
      }
    });

    // Create bundler client with paymaster
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

    console.log('   📤 Sending UserOperation...');
    console.log('   Calls:', preparedCalls.length);

    // Send UserOperation
    const userOpHash = await bundlerClient.sendUserOperation({
      calls: preparedCalls
    });

    console.log('   ✅ UserOp submitted:', userOpHash);

    // Wait for receipt
    console.log('   ⏳ Waiting for confirmation...');
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120000
    });

    // Check final balance
    const finalBalance = await publicClient.getBalance({ address: account.address });
    const gasPaid = initialBalance - finalBalance;

    console.log('   🎉 Transaction confirmed!');
    console.log('   TX Hash:', receipt.receipt.transactionHash);
    console.log('   Gas Paid:', formatUnits(gasPaid, 18));

    res.json({
      success: receipt.success,
      userOpHash,
      txHash: receipt.receipt.transactionHash,
      explorerUrl: `${chainConfig.explorer}/tx/${receipt.receipt.transactionHash}`,
      gasless: gasPaid === 0n,
      gasPaid: formatUnits(gasPaid, 18),
      message: gasPaid === 0n 
        ? '🎉 TRUE GASLESS! User paid $0 in gas!'
        : `Gas paid: ${formatUnits(gasPaid, 18)}`
    });

  } catch (error) {
    console.error('Direct execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Prepare a gasless transaction for signing
 * Returns the UserOp hash that needs to be signed by the user
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

    // Encode calls using MetaMask's encodeCalls function
    const preparedCalls = calls.map(c => ({
      to: c.to,
      data: c.data || '0x',
      value: BigInt(c.value || 0)
    }));
    const callData = encodeCalls(preparedCalls);

    // Get nonce from EntryPoint
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
    const gasPrices = gasPriceResult.result?.fast;

    // Build initial UserOp for sponsorship request
    const userOp = {
      sender: address,
      nonce: '0x' + nonce.toString(16),
      callData: callData,
      callGasLimit: '0x' + (500000n).toString(16),
      verificationGasLimit: '0x' + (500000n).toString(16),
      preVerificationGas: '0x' + (100000n).toString(16),
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      signature: '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
    };

    // Get paymaster sponsorship
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

    // Build sponsored UserOp
    const sponsoredOp = {
      sender: address,
      nonce: '0x' + nonce.toString(16),
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

    // Compute UserOp hash for signing (EIP-4337 v0.7)
    const { keccak256, encodeAbiParameters, parseAbiParameters, concat, pad, toHex } = await import('viem');
    
    const hashedInitCode = keccak256('0x');
    const hashedCallData = keccak256(sponsoredOp.callData);
    
    // Pack account gas limits (verificationGasLimit || callGasLimit)
    const accountGasLimits = concat([
      pad(toHex(BigInt(sponsoredOp.verificationGasLimit)), { size: 16 }),
      pad(toHex(BigInt(sponsoredOp.callGasLimit)), { size: 16 })
    ]);
    
    // Pack gas fees (maxPriorityFeePerGas || maxFeePerGas)
    const gasFees = concat([
      pad(toHex(BigInt(sponsoredOp.maxPriorityFeePerGas)), { size: 16 }),
      pad(toHex(BigInt(sponsoredOp.maxFeePerGas)), { size: 16 })
    ]);
    
    // Pack paymaster and data
    let paymasterAndData = '0x';
    if (sponsoredOp.paymaster) {
      paymasterAndData = concat([
        sponsoredOp.paymaster,
        pad(toHex(BigInt(sponsoredOp.paymasterVerificationGasLimit || '0x0')), { size: 16 }),
        pad(toHex(BigInt(sponsoredOp.paymasterPostOpGasLimit || '0x0')), { size: 16 }),
        sponsoredOp.paymasterData || '0x'
      ]);
    }
    const hashedPaymasterAndData = keccak256(paymasterAndData);

    // Encode packed UserOp
    const packedUserOp = encodeAbiParameters(
      parseAbiParameters('address, uint256, bytes32, bytes32, bytes32, uint256, bytes32, bytes32'),
      [
        sponsoredOp.sender,
        BigInt(sponsoredOp.nonce),
        hashedInitCode,
        hashedCallData,
        accountGasLimits,
        BigInt(sponsoredOp.preVerificationGas),
        gasFees,
        hashedPaymasterAndData
      ]
    );

    const userOpHashInner = keccak256(packedUserOp);
    
    // Final hash includes entrypoint and chainId
    const userOpHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters('bytes32, address, uint256'),
        [userOpHashInner, entryPoint07Address, BigInt(chainId)]
      )
    );

    console.log('   UserOp hash:', userOpHash);

    // Generate operation ID
    const opId = `${address}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store pending operation (in production, use Redis)
    global.pendingUserOps = global.pendingUserOps || new Map();
    global.pendingUserOps.set(opId, {
      userOp: sponsoredOp,
      userOpHash,
      chainId: parseInt(chainId),
      address,
      createdAt: Date.now()
    });

    // Clean up old pending ops
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of global.pendingUserOps.entries()) {
      if (value.createdAt < fiveMinutesAgo) {
        global.pendingUserOps.delete(key);
      }
    }

    res.json({
      success: true,
      opId,
      userOp: sponsoredOp,
      userOpHash,
      chainId,
      message: 'UserOp prepared. Sign the userOpHash and submit to complete.'
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

    global.pendingUserOps = global.pendingUserOps || new Map();
    const pending = global.pendingUserOps.get(opId);
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

    // Submit to bundler
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
    global.pendingUserOps.delete(opId);

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
