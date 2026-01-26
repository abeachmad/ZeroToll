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
import { 
  eip7702Actions,
  signAuthorization 
} from 'viem/experimental';
import { polygonAmoy, sepolia } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

const DELEGATE_ADDRESS = {
  80002: '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C', // Amoy - Deployed!
  11155111: '0x...' // Sepolia - Pending (need testnet ETH)
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
function createClients(chainId) {
  const chain = chainId === 80002 ? polygonAmoy : sepolia;
  const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  
  const walletClient = createWalletClient({
    account: relayerAccount,
    chain,
    transport: http(RPC_URL[chainId])
  }).extend(eip7702Actions());
  
  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL[chainId])
  });
  
  return { walletClient, publicClient, relayerAccount };
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
  console.log('Amount In:', formatUnits(BigInt(intent.amountIn), 6)); // Assuming 6 decimals
  console.log('Min Amount Out:', formatUnits(BigInt(intent.minAmountOut), 18));
  console.log('Fee:', formatUnits(BigInt(fee), 6));
  
  // Get delegate address for this chain
  const delegateAddress = DELEGATE_ADDRESS[chainId];
  if (!delegateAddress || delegateAddress === '0x...') {
    throw new Error(`Delegate not deployed on chain ${chainId}`);
  }
  
  // Create clients
  const { walletClient, publicClient, relayerAccount } = createClients(chainId);
  
  console.log('\nRelayer:', relayerAccount.address);
  console.log('Delegate:', delegateAddress);
  
  // Verify authorization is for correct delegate
  if (authorization.address.toLowerCase() !== delegateAddress.toLowerCase()) {
    throw new Error('Authorization address mismatch');
  }
  
  // Encode delegate call
  const callData = encodeFunctionData({
    abi: DELEGATE_ABI,
    functionName: 'execute',
    args: [intent, intentSignature, permit, BigInt(fee)]
  });
  
  console.log('\nBuilding EIP-7702 transaction...');
  console.log('Call data length:', callData.length);
  
  // Estimate gas
  let gasEstimate;
  try {
    gasEstimate = await publicClient.estimateGas({
      account: relayerAccount.address,
      to: intent.user,  // Call user's EOA directly!
      data: callData,
      authorizationList: [authorization]
    });
    console.log('Gas estimate:', gasEstimate.toString());
  } catch (error) {
    console.error('Gas estimation failed:', error.message);
    gasEstimate = 300000n; // Fallback
  }
  
  // Build and send 7702 transaction
  console.log('\nSending transaction...');
  const txHash = await walletClient.sendTransaction({
    to: intent.user,  // Call user's EOA directly via delegation!
    data: callData,
    authorizationList: [authorization],  // User's 7702 authorization
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
  let amountOut = '0';
  if (receipt.logs && receipt.logs.length > 0) {
    // Look for SwapExecuted event
    const swapEvent = receipt.logs.find(log => 
      log.topics[0] === '0x...' // SwapExecuted event signature
    );
    if (swapEvent) {
      // Parse amountOut from event data
      console.log('Swap event found');
    }
  }
  
  return {
    success: receipt.status === 'success',
    txHash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    amountOut,
    explorerUrl: chainId === 80002 
      ? `https://amoy.polygonscan.com/tx/${txHash}`
      : `https://sepolia.etherscan.io/tx/${txHash}`
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
  
  const { publicClient } = createClients(chainId);
  
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
    const { publicClient, relayerAccount } = createClients(chainId);
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
  } else {
    console.log('Usage:');
    console.log('  node eip7702-relayer.mjs health [chainId]');
    console.log('  node eip7702-relayer.mjs nonce [chainId] [userAddress]');
  }
}
