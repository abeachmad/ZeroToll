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
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

const DELEGATE_ADDRESS = {
  80002: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C', // Amoy - Deployed!
  11155111: '0xcFE005B2E0013e0FF8cB0569d9b103094d423B36' // Sepolia - Deployed!
};

const RPC_URL = {
  80002: process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
  11155111: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'
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
  const walletClient = createWalletClient({
    account: relayerAccount,
    chain,
    transport: http(RPC_URL[chainId])
  });
  
  // Try to extend with EIP-7702 actions if available
  try {
    const { eip7702Actions } = await import('viem/experimental');
    const extendedClient = walletClient.extend(eip7702Actions());
    console.log('✅ EIP-7702 actions enabled');
    return {
      walletClient: extendedClient,
      publicClient: createPublicClient({
        chain,
        transport: http(RPC_URL[chainId])
      }),
      relayerAccount
    };
  } catch (error) {
    console.warn('⚠️  EIP-7702 not available, using standard client:', error.message);
    // Return standard client without EIP-7702
    return {
      walletClient,
      publicClient: createPublicClient({
        chain,
        transport: http(RPC_URL[chainId])
      }),
      relayerAccount
    };
  }
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
  
  console.log('\n=== EIP-7702 Gasless Swap (MOCK MODE) ===');
  console.log('Chain ID:', chainId);
  console.log('User:', intent.user);
  console.log('Token In:', intent.tokenIn);
  console.log('Token Out:', intent.tokenOut);
  console.log('Amount In:', formatUnits(BigInt(intent.amountIn), 6)); // Assuming 6 decimals
  console.log('Min Amount Out:', formatUnits(BigInt(intent.minAmountOut), 18));
  console.log('Fee:', formatUnits(BigInt(fee), 6));
  
  // NOTE: EIP-7702 is not yet live on testnets
  // This is a MOCK implementation for UI testing only
  
  console.log('\n⚠️  EIP-7702 NOT YET LIVE ON TESTNETS');
  console.log('📝 Generating mock transaction for UI testing...');
  
  // Generate mock transaction hash
  const crypto = await import('crypto');
  const mockTxHash = '0x' + crypto.randomBytes(32).toString('hex');
  
  // Simulate blockchain delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('✅ Mock transaction generated');
  console.log('TX Hash:', mockTxHash);
  
  const explorerUrl = chainId === 80002 
    ? `https://amoy.polygonscan.com/tx/${mockTxHash}`
    : `https://sepolia.etherscan.io/tx/${mockTxHash}`;
  
  return {
    success: true,
    txHash: mockTxHash,
    blockNumber: '12345678',
    gasUsed: '150000',
    amountOut: intent.minAmountOut,
    explorerUrl,
    note: 'MOCK TRANSACTION - EIP-7702 not yet live on testnets',
    warning: 'This is a simulated transaction for UI testing only'
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
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'health') {
    const chainId = parseInt(process.argv[3]) || 80002;
    const status = await healthCheck(chainId);
    console.log(JSON.stringify(status, null, 2));
  } else if (command === 'nonce') {
    const chainId = parseInt(process.argv[3]) || 80002;
    const userAddress = process.argv[4];
    const nonce = await getUserNonce(chainId, userAddress);
    console.log('Nonce:', nonce);
  } else if (command === 'execute') {
    const chainId = parseInt(process.argv[3]) || 80002;
    const swapData = JSON.parse(process.argv[4]);
    
    try {
      const result = await executeSwap7702({
        chainId,
        authorization: swapData.authorization,
        permit: swapData.permit,
        intent: swapData.intent,
        intentSignature: swapData.intentSignature,
        fee: swapData.fee
      });
      
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Execution error:', error.message);
      process.exit(1);
    }
  } else {
    console.log('Usage:');
    console.log('  node eip7702-relayer.mjs health [chainId]');
    console.log('  node eip7702-relayer.mjs nonce [chainId] [userAddress]');
    console.log('  node eip7702-relayer.mjs execute [chainId] [swapDataJSON]');
  }
}
