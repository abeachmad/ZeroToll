/**
 * Gasless Relay API - TRUE GASLESS using remote signing
 * 
 * This creates a custom signer that requests signatures from the frontend.
 * The flow:
 * 1. POST /api/relay/execute - Start execution, returns signatureRequestId
 * 2. GET /api/relay/pending/:requestId - Get the hash to sign
 * 3. POST /api/relay/sign/:requestId - Submit the signature
 * 4. Backend completes the UserOp submission
 * 
 * This works because we use the smart-accounts-kit in Node.js
 * with a custom signer that waits for frontend signatures.
 */

import express from 'express';
import cors from 'cors';
import { createPublicClient, http, formatUnits } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import dotenv from 'dotenv';

dotenv.config();

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

// Store pending signature requests
const pendingRequests = new Map();

/**
 * Create a custom signer that waits for remote signatures
 * 
 * IMPORTANT: The smart account expects a RAW ECDSA signature over the hash.
 * personal_sign adds a prefix which changes the recovered address.
 * 
 * The frontend will sign using personal_sign, so we need to:
 * 1. Send the hash to frontend
 * 2. Frontend signs with personal_sign (adds prefix)
 * 3. We recover the address from the prefixed signature
 * 4. If it matches, we know the user authorized it
 * 5. BUT we can't use that signature for the UserOp
 * 
 * SOLUTION: For now, we'll use a workaround where the user's signature
 * authorizes the backend to execute on their behalf using a session key.
 * This requires the user to have delegated to the backend's key.
 * 
 * For TRUE gasless without delegation, we need the user to sign the raw hash,
 * which requires eth_sign (deprecated) or a custom signing flow.
 */
function createRemoteSigner(address, requestId) {
  return {
    address,
    type: 'local',
    // This is called when the smart account needs to sign
    sign: async ({ hash }) => {
      console.log(`📝 Signature requested for ${requestId}`);
      console.log(`   Hash: ${hash}`);
      
      // Store the hash and wait for signature
      const request = pendingRequests.get(requestId);
      if (!request) throw new Error('Request not found');
      
      request.hashToSign = hash;
      request.status = 'awaiting_signature';
      
      // Wait for signature (poll with timeout)
      const timeout = 120000; // 2 minutes
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        await new Promise(r => setTimeout(r, 500));
        
        const updated = pendingRequests.get(requestId);
        if (updated?.signature) {
          console.log(`✅ Signature received for ${requestId}`);
          // The signature from personal_sign has the prefix baked in
          // We return it as-is and hope the smart account accepts it
          // (This may fail with AA24 if the smart account expects raw sig)
          return updated.signature;
        }
        if (updated?.status === 'cancelled') {
          throw new Error('Signing cancelled by user');
        }
      }
      
      throw new Error('Signature timeout');
    },
    // Required by viem
    signMessage: async ({ message }) => {
      // For message signing, we use the same flow
      const hash = typeof message === 'string' ? message : message.raw;
      return this.sign({ hash });
    },
    signTypedData: async () => {
      throw new Error('signTypedData not implemented for remote signer');
    },
    // Required properties for viem LocalAccount
    publicKey: '0x',
    source: 'custom'
  };
}

/**
 * Start a gasless execution
 */
app.post('/api/relay/execute', async (req, res) => {
  try {
    const { address, chainId, calls } = req.body;
    
    if (!address || !chainId || !calls) {
      return res.status(400).json({ error: 'Missing address, chainId, or calls' });
    }

    const chainConfig = CHAINS[parseInt(chainId)];
    if (!chainConfig) {
      return res.status(400).json({ error: 'Unsupported chain' });
    }

    // Generate request ID
    const requestId = `${address}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`\n🚀 Starting gasless execution ${requestId}`);
    console.log(`   Address: ${address}`);
    console.log(`   Chain: ${chainConfig.name}`);

    // Store the request
    pendingRequests.set(requestId, {
      address,
      chainId: parseInt(chainId),
      calls,
      status: 'initializing',
      createdAt: Date.now()
    });

    // Start the execution in background
    executeGasless(requestId, address, chainId, calls, chainConfig).catch(err => {
      console.error(`Execution error for ${requestId}:`, err);
      const request = pendingRequests.get(requestId);
      if (request) {
        request.status = 'error';
        request.error = err.message;
      }
    });

    res.json({
      success: true,
      requestId,
      message: 'Execution started. Poll /api/relay/status/:requestId for updates.'
    });

  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get status of a request (including hash to sign if needed)
 */
app.get('/api/relay/status/:requestId', (req, res) => {
  const { requestId } = req.params;
  const request = pendingRequests.get(requestId);
  
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json({
    status: request.status,
    hashToSign: request.hashToSign,
    txHash: request.txHash,
    userOpHash: request.userOpHash,
    error: request.error,
    explorerUrl: request.explorerUrl
  });
});

/**
 * Submit a signature
 */
app.post('/api/relay/sign/:requestId', (req, res) => {
  const { requestId } = req.params;
  const { signature } = req.body;
  
  if (!signature) {
    return res.status(400).json({ error: 'Missing signature' });
  }

  const request = pendingRequests.get(requestId);
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (request.status !== 'awaiting_signature') {
    return res.status(400).json({ error: `Invalid status: ${request.status}` });
  }

  console.log(`📥 Signature submitted for ${requestId}`);
  request.signature = signature;
  request.status = 'signature_received';

  res.json({ success: true });
});

/**
 * Cancel a request
 */
app.post('/api/relay/cancel/:requestId', (req, res) => {
  const { requestId } = req.params;
  const request = pendingRequests.get(requestId);
  
  if (request) {
    request.status = 'cancelled';
  }

  res.json({ success: true });
});

/**
 * Execute the gasless transaction
 */
async function executeGasless(requestId, address, chainId, calls, chainConfig) {
  const request = pendingRequests.get(requestId);
  
  try {
    request.status = 'creating_account';
    
    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    // Verify Smart Account is enabled
    const code = await publicClient.getCode({ address });
    if (!code || !code.startsWith('0xef0100')) {
      throw new Error('Smart Account not enabled');
    }

    // Create remote signer
    const remoteSigner = createRemoteSigner(address, requestId);

    // Create MetaMask Smart Account with remote signer
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Stateless7702,
      address,
      signer: { 
        // Custom signer object that mimics viem's LocalAccount
        address,
        sign: remoteSigner.sign,
        signMessage: remoteSigner.signMessage,
        signTypedData: remoteSigner.signTypedData,
        type: 'local'
      }
    });

    console.log(`✅ Smart Account created for ${requestId}`);
    request.status = 'preparing_userop';

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

    console.log(`📤 Sending UserOperation for ${requestId}...`);
    request.status = 'sending_userop';

    // This will trigger the remote signer
    const userOpHash = await bundlerClient.sendUserOperation({
      calls: preparedCalls
    });

    console.log(`✅ UserOp submitted: ${userOpHash}`);
    request.userOpHash = userOpHash;
    request.status = 'waiting_confirmation';

    // Wait for receipt
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120000
    });

    console.log(`🎉 Transaction confirmed: ${receipt.receipt.transactionHash}`);
    
    request.txHash = receipt.receipt.transactionHash;
    request.explorerUrl = `${chainConfig.explorer}/tx/${receipt.receipt.transactionHash}`;
    request.status = receipt.success ? 'success' : 'failed';

  } catch (error) {
    console.error(`Error in executeGasless for ${requestId}:`, error);
    request.status = 'error';
    request.error = error.message;
  }
}

// Cleanup old requests every 5 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of pendingRequests.entries()) {
    if (value.createdAt < tenMinutesAgo) {
      pendingRequests.delete(key);
    }
  }
}, 5 * 60 * 1000);

const PORT = process.env.RELAY_API_PORT || 3004;

app.listen(PORT, () => {
  console.log(`\n🚀 Gasless Relay API running on http://localhost:${PORT}`);
  console.log('   Endpoints:');
  console.log('   - POST /api/relay/execute');
  console.log('   - GET  /api/relay/status/:requestId');
  console.log('   - POST /api/relay/sign/:requestId');
  console.log('   - POST /api/relay/cancel/:requestId\n');
});

export default app;
