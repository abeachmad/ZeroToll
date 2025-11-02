import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy, sepolia } from 'viem/chains';
import { config } from 'dotenv';
import express from 'express';

config();

const app = express();
app.use(express.json());

const PRIVATE_KEY = process.env.PRIVATE_KEY_RELAYER;
if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY_RELAYER required');

const account = privateKeyToAccount(PRIVATE_KEY);

const amoyClient = createPublicClient({
  chain: polygonAmoy,
  transport: http(process.env.RPC_AMOY || 'https://rpc-amoy.polygon.technology/')
});

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_SEPOLIA || 'https://rpc.sepolia.org')
});

const amoyWallet = createWalletClient({
  account,
  chain: polygonAmoy,
  transport: http(process.env.RPC_AMOY || 'https://rpc-amoy.polygon.technology/')
});

const sepoliaWallet = createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.RPC_SEPOLIA || 'https://rpc.sepolia.org')
});

// RFQ quote endpoint
app.post('/api/quote', async (req, res) => {
  const { intent } = req.body;
  
  try {
    // Simulate quote calculation
    const gasCostEstimate = parseEther('0.001'); // Mock estimate
    const feeCap = intent.feeCap;
    
    // Check if profitable
    const profitable = BigInt(feeCap) > gasCostEstimate;
    
    if (!profitable) {
      return res.json({ success: false, reason: 'Not profitable' });
    }
    
    res.json({
      success: true,
      relayer: account.address,
      costEstimate: gasCostEstimate.toString(),
      deadline: Date.now() + 60000 // 60s
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit UserOp to bundler
app.post('/api/execute', async (req, res) => {
  const { intentId, userOp } = req.body;
  
  try {
    const bundlerUrl = process.env.BUNDLER_URL_AMOY;
    if (!bundlerUrl) {
      return res.status(400).json({ error: 'Bundler not configured' });
    }
    
    // In production, submit to actual 4337 bundler
    // For MVP, we simulate successful execution
    const txHash = `0x${Math.random().toString(16).slice(2, 66)}`;
    
    res.json({
      success: true,
      intentId,
      txHash,
      status: 'pending'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', relayer: account.address });
});

const PORT = process.env.RELAYER_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Relayer service running on port ${PORT}`);
  console.log(`Relayer address: ${account.address}`);
});
