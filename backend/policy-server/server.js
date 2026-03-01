require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting storage (in-memory, replace with Redis for production)
const rateLimitStore = new Map();

// Signer wallet for VerifyingPaymaster
const signer = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY);
console.log('Policy Server Signer:', signer.address);

// Network configurations
const networks = {
  amoy: {
    chainId: 80002,
    rpc: process.env.AMOY_RPC,
    paymaster: process.env.AMOY_PAYMASTER,
    whitelistedTokens: process.env.AMOY_WHITELISTED_TOKENS.split(',').map(addr => addr.toLowerCase())
  },
  sepolia: {
    chainId: 11155111,
    rpc: process.env.SEPOLIA_RPC,
    paymaster: process.env.SEPOLIA_PAYMASTER,
    whitelistedTokens: process.env.SEPOLIA_WHITELISTED_TOKENS.split(',').map(addr => addr.toLowerCase())
  }
};

// EntryPoint ABI (minimal - just what we need)
// Updated for v0.7 format
const ENTRYPOINT_ABI = [
  'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)'
];

// Rate limiting helper
function checkRateLimit(walletAddress) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  
  const key = walletAddress.toLowerCase();
  const record = rateLimitStore.get(key) || { daily: [], hourly: [] };
  
  // Clean old entries
  record.daily = record.daily.filter(ts => now - ts < dayMs);
  record.hourly = record.hourly.filter(ts => now - ts < hourMs);
  
  const maxDaily = parseInt(process.env.MAX_SWAPS_PER_DAY);
  const maxHourly = parseInt(process.env.MAX_SWAPS_PER_HOUR);
  
  if (record.daily.length >= maxDaily) {
    return { allowed: false, reason: `Daily limit exceeded (${maxDaily} swaps/day)` };
  }
  
  if (record.hourly.length >= maxHourly) {
    return { allowed: false, reason: `Hourly limit exceeded (${maxHourly} swaps/hour)` };
  }
  
  // Add timestamp
  record.daily.push(now);
  record.hourly.push(now);
  rateLimitStore.set(key, record);
  
  return { 
    allowed: true, 
    remaining: { 
      daily: maxDaily - record.daily.length, 
      hourly: maxHourly - record.hourly.length 
    } 
  };
}

// Validate UserOperation
function validateUserOp(userOp, network) {
  const errors = [];
  
  // Check required fields
  if (!userOp.sender || !ethers.isAddress(userOp.sender)) {
    errors.push('Invalid sender address');
  }
  
  if (!userOp.callData || userOp.callData === '0x') {
    errors.push('Missing callData');
  }
  
  // Extract paymaster from paymasterAndData
  if (!userOp.paymasterAndData || userOp.paymasterAndData === '0x') {
    errors.push('Missing paymasterAndData');
  } else {
    const paymasterAddress = '0x' + userOp.paymasterAndData.slice(2, 42);
    if (paymasterAddress.toLowerCase() !== network.paymaster.toLowerCase()) {
      errors.push(`Invalid paymaster address. Expected ${network.paymaster}, got ${paymasterAddress}`);
    }
  }
  
  return errors;
}

// Main endpoint: sponsor UserOperation
app.post('/api/paymaster/sponsor', async (req, res) => {
  try {
    const { userOp, chainId } = req.body;
    
    // Validate request
    if (!userOp || !chainId) {
      return res.status(400).json({ error: 'Missing userOp or chainId' });
    }
    
    // Get network config
    const network = Object.values(networks).find(n => n.chainId === chainId);
    if (!network) {
      return res.status(400).json({ error: `Unsupported chain ID: ${chainId}` });
    }
    
    // Validate UserOp structure
    const validationErrors = validateUserOp(userOp, network);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Invalid UserOperation', details: validationErrors });
    }
    
    // Rate limiting check
    const rateCheck = checkRateLimit(userOp.sender);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason });
    }
    
    // TODO: Parse callData to validate swap parameters
    // - Check tokens are whitelisted
    // - Verify swap value meets minimum
    // - Estimate gas costs vs expected fees
    
    // Calculate UserOpHash manually (simpler than calling EntryPoint)
    // UserOpHash = keccak256(abi.encode(userOp, entryPoint, chainId))
    const provider = new ethers.JsonRpcProvider(network.rpc);
    
    // For v0.7, calculate hash directly
    const userOpHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes', 'bytes', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes', 'address', 'uint256'],
      [
        userOp.sender,
        userOp.nonce,
        ethers.keccak256(userOp.initCode || '0x'),
        ethers.keccak256(userOp.callData || '0x'),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        ethers.keccak256(userOp.paymasterAndData || '0x'),
        process.env.ENTRYPOINT_ADDRESS,
        chainId
      ]
    ));
    
    // Sign the hash with policy server's private key
    const signature = await signer.signMessage(ethers.getBytes(userOpHash));
    
    console.log('Sponsored UserOp:', {
      sender: userOp.sender,
      userOpHash,
      chainId,
      remaining: rateCheck.remaining
    });
    
    res.json({
      success: true,
      paymasterSignature: signature,
      userOpHash,
      remaining: rateCheck.remaining,
      message: 'UserOperation sponsored successfully'
    });
    
  } catch (error) {
    console.error('Error sponsoring UserOp:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    signer: signer.address,
    networks: Object.keys(networks),
    timestamp: new Date().toISOString()
  });
});

// Rate limit status endpoint
app.get('/api/paymaster/rate-limit/:address', (req, res) => {
  const address = req.params.address.toLowerCase();
  const record = rateLimitStore.get(address) || { daily: [], hourly: [] };
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  
  const dailyCount = record.daily.filter(ts => now - ts < dayMs).length;
  const hourlyCount = record.hourly.filter(ts => now - ts < hourMs).length;
  
  res.json({
    address,
    used: {
      daily: dailyCount,
      hourly: hourlyCount
    },
    remaining: {
      daily: parseInt(process.env.MAX_SWAPS_PER_DAY) - dailyCount,
      hourly: parseInt(process.env.MAX_SWAPS_PER_HOUR) - hourlyCount
    }
  });
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         ZeroToll Policy Server - RUNNING                   ║
╚════════════════════════════════════════════════════════════╝

📡 Server: http://localhost:${PORT}
🔑 Signer: ${signer.address}
🌐 Networks: ${Object.keys(networks).join(', ')}

Endpoints:
  POST /api/paymaster/sponsor - Sponsor UserOperations
  GET  /health - Health check
  GET  /api/paymaster/rate-limit/:address - Check rate limits

Ready to sponsor gasless swaps! 🚀
  `);
});
