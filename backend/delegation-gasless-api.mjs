/**
 * Delegation-Based Gasless Transaction API
 * 
 * This implements TRUE gasless transactions using the MetaMask Delegation Framework:
 * 
 * Flow:
 * 1. User grants delegation to backend's delegate account
 * 2. Backend redeems delegation on user's behalf with Pimlico paymaster
 * 3. User pays $0 in gas!
 * 
 * Based on:
 * - https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/
 * - https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account
 */

import express from 'express';
import cors from 'cors';
import { createPublicClient, createWalletClient, http, parseUnits, encodeFunctionData, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy, sepolia } from 'viem/chains';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { 
  toMetaMaskSmartAccount, 
  Implementation,
  createDelegation,
  createExecution,
  ExecutionMode
} from '@metamask/smart-accounts-kit';
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts';
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

// Backend's delegate account - this account will execute on behalf of users
const DELEGATE_PRIVATE_KEY = process.env.DELEGATE_PRIVATE_KEY || '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';

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

// Store delegations (in production, use a database)
const delegations = new Map();

/**
 * Get delegate account info
 */
app.get('/api/delegation/delegate-info', async (req, res) => {
  try {
    const delegateAccount = privateKeyToAccount(DELEGATE_PRIVATE_KEY);
    res.json({
      delegateAddress: delegateAccount.address,
      message: 'Grant delegation to this address to enable gasless transactions'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Store a signed delegation from user
 */
app.post('/api/delegation/store', async (req, res) => {
  try {
    const { userAddress, chainId, signedDelegation } = req.body;
    
    if (!userAddress || !chainId || !signedDelegation) {
      return res.status(400).json({ error: 'Missing userAddress, chainId, or signedDelegation' });
    }

    const key = `${userAddress.toLowerCase()}-${chainId}`;
    delegations.set(key, {
      signedDelegation,
      createdAt: Date.now()
    });

    console.log(`✅ Stored delegation for ${userAddress} on chain ${chainId}`);

    res.json({
      success: true,
      message: 'Delegation stored. You can now execute gasless transactions.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute a gasless transaction using delegation
 * 
 * The backend (delegate) executes on behalf of the user using the stored delegation
 * and pays gas via Pimlico paymaster.
 */
app.post('/api/delegation/execute', async (req, res) => {
  try {
    const { userAddress, chainId, calls } = req.body;
    
    if (!userAddress || !chainId || !calls) {
      return res.status(400).json({ error: 'Missing userAddress, chainId, or calls' });
    }

    const chainConfig = CHAINS[parseInt(chainId)];
    if (!chainConfig) {
      return res.status(400).json({ error: 'Unsupported chain' });
    }

    // Get stored delegation
    const key = `${userAddress.toLowerCase()}-${chainId}`;
    const storedDelegation = delegations.get(key);
    
    if (!storedDelegation) {
      return res.status(400).json({ 
        error: 'No delegation found',
        hint: 'User must first grant delegation to the backend delegate account'
      });
    }

    console.log(`\n🚀 Executing gasless TX via delegation for ${userAddress}`);

    // Create delegate account
    const delegateAccount = privateKeyToAccount(DELEGATE_PRIVATE_KEY);
    console.log('   Delegate:', delegateAccount.address);

    // Create public client
    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc)
    });

    // Create delegate smart account
    const delegateSmartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [delegateAccount.address, [], [], []],
      deploySalt: '0x',
      signer: { account: delegateAccount }
    });

    console.log('   Delegate Smart Account:', delegateSmartAccount.address);

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
      account: delegateSmartAccount,
      paymaster: pimlicoClient,
      userOperation: {
        estimateFeesPerGas: async () => {
          const gasPrices = await pimlicoClient.getUserOperationGasPrice();
          return gasPrices.fast;
        }
      }
    });

    // Prepare executions from calls
    const executions = calls.map(c => createExecution({
      target: c.to,
      callData: c.data || '0x',
      value: BigInt(c.value || 0)
    }));

    // Encode redeem delegation calldata
    const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
      delegations: [[storedDelegation.signedDelegation]],
      modes: [ExecutionMode.SingleDefault],
      executions: [executions]
    });

    console.log('   📤 Sending UserOperation via delegation...');

    // Send UserOperation
    const userOpHash = await bundlerClient.sendUserOperation({
      calls: [{
        to: delegateSmartAccount.address,
        data: redeemDelegationCalldata
      }]
    });

    console.log('   ✅ UserOp submitted:', userOpHash);

    // Wait for receipt
    console.log('   ⏳ Waiting for confirmation...');
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120000
    });

    console.log('   🎉 Transaction confirmed!');
    console.log('   TX Hash:', receipt.receipt.transactionHash);

    res.json({
      success: receipt.success,
      userOpHash,
      txHash: receipt.receipt.transactionHash,
      explorerUrl: `${chainConfig.explorer}/tx/${receipt.receipt.transactionHash}`,
      gasless: true,
      message: '🎉 TRUE GASLESS! User paid $0 in gas!'
    });

  } catch (error) {
    console.error('Delegation execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check if user has an active delegation
 */
app.get('/api/delegation/check/:userAddress/:chainId', async (req, res) => {
  try {
    const { userAddress, chainId } = req.params;
    const key = `${userAddress.toLowerCase()}-${chainId}`;
    const storedDelegation = delegations.get(key);

    const delegateAccount = privateKeyToAccount(DELEGATE_PRIVATE_KEY);

    res.json({
      hasDelegation: !!storedDelegation,
      delegateAddress: delegateAccount.address,
      message: storedDelegation 
        ? 'Delegation active - gasless transactions enabled'
        : 'No delegation - user must grant delegation first'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.DELEGATION_API_PORT || 3003;

app.listen(PORT, () => {
  const delegateAccount = privateKeyToAccount(DELEGATE_PRIVATE_KEY);
  console.log(`\n🚀 Delegation Gasless API running on http://localhost:${PORT}`);
  console.log(`   Delegate Address: ${delegateAccount.address}`);
  console.log('   Endpoints:');
  console.log('   - GET  /api/delegation/delegate-info');
  console.log('   - GET  /api/delegation/check/:userAddress/:chainId');
  console.log('   - POST /api/delegation/store');
  console.log('   - POST /api/delegation/execute\n');
});

export default app;
