// EIP-7702 Relayer for ZeroToll Gasless Swaps
import { 
  createWalletClient, 
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
  parseUnits,
  formatUnits
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy, sepolia } from 'viem/chains';
import { eip7702Actions } from 'viem/experimental';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

const DELEGATE_ADDRESS = {
  80002: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C', // Amoy - Deployed!
  11155111: '0xcFE005B2E0013e0FF8cB0569d9b103094d423B36' // Sepolia - Deployed!
};

// Multiple RPC endpoints for reliability (fallback if primary fails)
const RPC_URLS = {
  80002: [
    process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy.drpc.org',
    'https://rpc.ankr.com/polygon_amoy'
  ],
  11155111: [
    process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
    'https://rpc.ankr.com/eth_sepolia'
  ]
};

// Get primary RPC URL for a chain
const RPC_URL = {
  80002: RPC_URLS[80002][0],
  11155111: RPC_URLS[11155111][0]
};

// ZeroTollDelegate ABI (minimal)
const DELEGATE_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "name": "user", "type": "address" },
          { "name": "tokenIn", "type": "address" },
          { "name": "tokenOut", "type": "address" },
          { "name": "amountIn", "type": "uint256" },
          { "name": "minAmountOut", "type": "uint256" },
          { "name": "deadline", "type": "uint256" },
          { "name": "nonce", "type": "uint256" },
          { "name": "chainId", "type": "uint256" }
        ],
        "name": "intent",
        "type": "tuple"
      },
      { "name": "intentSignature", "type": "bytes" },
      {
        "components": [
          { "name": "deadline", "type": "uint256" },
          { "name": "v", "type": "uint8" },
          { "name": "r", "type": "bytes32" },
          { "name": "s", "type": "bytes32" }
        ],
        "name": "permit",
        "type": "tuple"
      },
      { "name": "fee", "type": "uint256" }
    ],
    "name": "execute",
    "outputs": [{ "name": "amountOut", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "user", "type": "address" }],
    "name": "getNonce",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
];

/**
 * Create wallet and public clients for a chain
 */
async function createClients(chainId) {
  const chain = chainId === 80002 ? polygonAmoy : sepolia;
  
  // Ensure private key has 0x prefix
  const privateKey = RELAYER_PRIVATE_KEY.startsWith('0x') 
    ? RELAYER_PRIVATE_KEY 
    : `0x${RELAYER_PRIVATE_KEY}`;
  
  const relayerAccount = privateKeyToAccount(privateKey);
  
  // Create wallet client
  // Viem 2.31.4+ natively supports authorizationList in sendTransaction
  // No need to extend with eip7702Actions if it's causing issues
  const walletClient = createWalletClient({
    account: relayerAccount,
    chain,
    transport: http(RPC_URL[chainId])
  });
  
  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL[chainId])
  });
  
  console.log('✅ Wallet client created (native EIP-7702 support in viem 2.31.4+)');
  
  return {
    walletClient,
    publicClient,
    relayerAccount
  };
}

/**
 * Execute gasless swap using EIP-7702
 * 
 * @param {Object} params - Swap parameters
 * @param {number} params.chainId - Chain ID (80002 for Amoy, 11155111 for Sepolia)
 * @param {Object} params.authorization - User's EIP-7702 authorization
 * @param {Object} params.permit - User's ERC-2612 permit signature
 * @param {Object} params.intent - Swap intent
 * @param {string} params.intentSignature - User's signature on intent
 * @param {string} params.fee - Fee amount in token units
 * @returns {Promise<Object>} Transaction result
 */
export async function executeSwap7702(params) {
  const { chainId, authorization, permit, intent, intentSignature, fee } = params;
  
  console.log('\n=== EIP-7702 Gasless Swap ===');
  console.log('Chain ID:', chainId);
  console.log('User:', intent.user);
  console.log('Token In:', intent.tokenIn);
  console.log('Token Out:', intent.tokenOut);
  console.log('Amount In:', formatUnits(BigInt(intent.amountIn), 6));
  console.log('Min Amount Out:', formatUnits(BigInt(intent.minAmountOut), 18));
  console.log('Fee:', formatUnits(BigInt(fee), 6));
  
  // Get delegate address for this chain
  const delegateAddress = DELEGATE_ADDRESS[chainId];
  if (!delegateAddress || delegateAddress === '0x...') {
    throw new Error(`Delegate not deployed on chain ${chainId}`);
  }
  
  // Create clients with EIP-7702 support
  const { walletClient, publicClient, relayerAccount } = await createClients(chainId);
  
  console.log('\nRelayer:', relayerAccount.address);
  console.log('Delegate:', delegateAddress);
  
  // Verify authorization is for correct delegate
  if (authorization.address.toLowerCase() !== delegateAddress.toLowerCase()) {
    throw new Error('Authorization address mismatch');
  }
  
  // Convert authorization to proper format with BigInt
  const authorizationFormatted = {
    chainId: BigInt(authorization.chainId),
    address: authorization.address,
    nonce: BigInt(authorization.nonce),
    yParity: Number(authorization.yParity),
    r: authorization.r,
    s: authorization.s
  };
  
  console.log('\nEIP-7702 Authorization:');
  console.log('  Chain ID:', authorizationFormatted.chainId.toString());
  console.log('  Delegate:', authorizationFormatted.address);
  console.log('  Nonce:', authorizationFormatted.nonce.toString());
  console.log('  yParity:', authorizationFormatted.yParity);
  
  // Encode delegate call
  const callData = encodeFunctionData({
    abi: DELEGATE_ABI,
    functionName: 'execute',
    args: [intent, intentSignature, permit, BigInt(fee)]
  });
  
  console.log('\nBuilding EIP-7702 transaction...');
  console.log('Call data length:', callData.length);
  
  // Estimate gas with extended timeout (5 minutes for slow RPC)
  let gasEstimate;
  try {
    console.log('Estimating gas (timeout: 5 minutes)...');
    gasEstimate = await Promise.race([
      publicClient.estimateGas({
        account: relayerAccount.address,
        to: intent.user,  // Call user's EOA directly via delegation!
        data: callData,
        authorizationList: [authorizationFormatted]
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gas estimation timeout after 5 minutes')), 300000)  // 5 minutes
      )
    ]);
    console.log('Gas estimate:', gasEstimate.toString());
  } catch (error) {
    console.error('Gas estimation failed:', error.message);
    // Use conservative fallback for EIP-7702 transactions
    gasEstimate = 300000n; // Higher than normal due to delegation overhead
    console.log('Using fallback gas estimate:', gasEstimate.toString());
  }
  
  // Build and send EIP-7702 transaction
  console.log('\nSending EIP-7702 transaction...');
  const txHash = await walletClient.sendTransaction({
    to: intent.user,  // Call user's EOA directly via delegation!
    data: callData,
    authorizationList: [authorizationFormatted],  // User's EIP-7702 authorization
    gas: gasEstimate + 50000n, // Add buffer
    maxFeePerGas: parseUnits('50', 9), // 50 gwei
    maxPriorityFeePerGas: parseUnits('2', 9) // 2 gwei tip
  });
  
  console.log('✅ Transaction sent:', txHash);
  
  // Wait for confirmation
  console.log('Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash: txHash,
    confirmations: 1
  });
  
  console.log('✅ Transaction confirmed');
  console.log('Block:', receipt.blockNumber);
  console.log('Gas used:', receipt.gasUsed.toString());
  console.log('Status:', receipt.status === 'success' ? '✅ Success' : '❌ Failed');
  
  // Parse logs to get amountOut
  let amountOut = intent.minAmountOut;
  if (receipt.logs && receipt.logs.length > 0) {
    // Look for SwapExecuted event
    // TODO: Parse actual amountOut from event logs
    console.log('Logs found:', receipt.logs.length);
  }
  
  const explorerUrl = chainId === 80002 
    ? `https://amoy.polygonscan.com/tx/${txHash}`
    : `https://sepolia.etherscan.io/tx/${txHash}`;
  
  return {
    success: receipt.status === 'success',
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    amountOut,
    explorerUrl
  };
}

/**
 * Get user's current nonce from delegate contract
 */
export async function getUserNonce(chainId, userAddress) {
  const delegateAddress = DELEGATE_ADDRESS[chainId];
  if (!delegateAddress || delegateAddress === '0x...') {
    throw new Error(`Delegate not deployed on chain ${chainId}`);
  }
  
  const { publicClient } = await createClients(chainId);
  
  const nonce = await publicClient.readContract({
    address: delegateAddress,
    abi: DELEGATE_ABI,
    functionName: 'getNonce',
    args: [userAddress]
  });
  
  return nonce.toString();
}

/**
 * Calculate fee for a swap
 * Fee = 2x gas cost in input token
 */
export async function calculateFee(chainId, tokenIn, amountIn) {
  // Simplified fee calculation
  // In production, use oracle to get token price
  const gasPrice = parseUnits('50', 9); // 50 gwei
  const gasUsed = 150000n; // Estimated gas for 7702 swap
  const gasCost = gasPrice * gasUsed;
  
  // Convert gas cost to token amount (simplified)
  // Assume 1 ETH = $2000, 1 USDC = $1
  // gasCost in ETH, need to convert to token
  const feeInToken = (gasCost * 2n * 2000n) / parseEther('1'); // 2x gas cost
  
  // Cap fee at 1% of amountIn
  const maxFee = BigInt(amountIn) / 100n;
  const fee = feeInToken < maxFee ? feeInToken : maxFee;
  
  return fee.toString();
}

/**
 * Health check
 */
export async function healthCheck(chainId) {
  try {
    const { publicClient, relayerAccount } = await createClients(chainId);
    const balance = await publicClient.getBalance({ address: relayerAccount.address });
    
    return {
      healthy: true,
      chainId,
      relayer: relayerAccount.address,
      balance: formatUnits(balance, 18),
      delegate: DELEGATE_ADDRESS[chainId]
    };
  } catch (error) {
    return {
      healthy: false,
      chainId,
      error: error.message
    };
  }
}

// CLI for testing
// Check if this file is being run directly
const isMainModule = process.argv[1] && (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
);

if (isMainModule) {
  const command = process.argv[2];
  
  if (command === 'health') {
    const chainId = parseInt(process.argv[3]) || 80002;
    healthCheck(chainId).then(status => {
      console.log(JSON.stringify(status, null, 2));
    }).catch(error => {
      console.error('Health check error:', error.message);
      process.exit(1);
    });
  } else if (command === 'nonce') {
    const chainId = parseInt(process.argv[3]) || 80002;
    const userAddress = process.argv[4];
    getUserNonce(chainId, userAddress).then(nonce => {
      console.log('Nonce:', nonce);
    }).catch(error => {
      console.error('Nonce error:', error.message);
      process.exit(1);
    });
  } else if (command === 'execute') {
    const chainId = parseInt(process.argv[3]) || 80002;
    const swapData = JSON.parse(process.argv[4]);
    
    executeSwap7702({
      chainId,
      authorization: swapData.authorization,
      permit: swapData.permit,
      intent: swapData.intent,
      intentSignature: swapData.intentSignature,
      fee: swapData.fee
    }).then(result => {
      console.log(JSON.stringify(result, null, 2));
    }).catch(error => {
      console.error('Execution error:', error.message);
      process.exit(1);
    });
  } else {
    console.log('Usage:');
    console.log('  node eip7702-relayer.mjs health [chainId]');
    console.log('  node eip7702-relayer.mjs nonce [chainId] [userAddress]');
    console.log('  node eip7702-relayer.mjs execute [chainId] [swapDataJSON]');
  }
}
