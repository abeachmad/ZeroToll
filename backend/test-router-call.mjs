/**
 * Test the router's executeSwapWithPermit function directly
 * This simulates what the Smart Account would do
 */

import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;
const relayerAccount = privateKeyToAccount(`0x${RELAYER_PRIVATE_KEY.replace('0x', '')}`);

// Contract addresses
const ZTA_TOKEN = '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C';
const ZTB_TOKEN = '0x8fb844251af76AF090B005643D966FC52852100a'; // Output token
const ROUTER = '0x577560699EF88e99f15d04df57c9552056d2a10D';

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const walletClient = createWalletClient({
  account: relayerAccount,
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const TOKEN_ABI = parseAbi([
  'function name() view returns (string)',
  'function nonces(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function faucet()'
]);

const ROUTER_ABI = parseAbi([
  'function executeSwapWithPermit((address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 deadline, uint256 nonce, uint256 chainId) intent, bytes userSignature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS) external returns (uint256)',
  'function nonces(address user) view returns (uint256)',
  'function testMode() view returns (bool)'
]);

async function main() {
  console.log('Testing router executeSwapWithPermit directly...\n');
  console.log('Relayer address:', relayerAccount.address);
  
  // Check router state
  const testMode = await publicClient.readContract({
    address: ROUTER,
    abi: ROUTER_ABI,
    functionName: 'testMode'
  });
  console.log('Router test mode:', testMode);
  
  // Get token info
  const tokenName = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'name'
  });
  console.log('Token name:', tokenName);
  
  // Check relayer's token balance
  let balance = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: [relayerAccount.address]
  });
  console.log('Relayer ZTA balance:', balance.toString());
  
  // If no balance, get some from faucet
  if (balance === 0n) {
    console.log('\nGetting tokens from faucet...');
    const faucetHash = await walletClient.writeContract({
      address: ZTA_TOKEN,
      abi: TOKEN_ABI,
      functionName: 'faucet'
    });
    await publicClient.waitForTransactionReceipt({ hash: faucetHash });
    
    balance = await publicClient.readContract({
      address: ZTA_TOKEN,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [relayerAccount.address]
    });
    console.log('New balance:', balance.toString());
  }
  
  // Get permit nonce
  const permitNonce = await publicClient.readContract({
    address: ZTA_TOKEN,
    abi: TOKEN_ABI,
    functionName: 'nonces',
    args: [relayerAccount.address]
  });
  console.log('Permit nonce:', permitNonce.toString());
  
  // Get router swap nonce
  const swapNonce = await publicClient.readContract({
    address: ROUTER,
    abi: ROUTER_ABI,
    functionName: 'nonces',
    args: [relayerAccount.address]
  });
  console.log('Swap nonce:', swapNonce.toString());
  
  // Prepare swap parameters
  const amountIn = 1000000n; // 1 token (6 decimals)
  const minAmountOut = 900000n; // 0.9 token (allowing for fees)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  // Sign permit
  console.log('\n--- Signing Permit ---');
  const permitDomain = {
    name: tokenName,
    version: '1',
    chainId: 11155111,
    verifyingContract: ZTA_TOKEN
  };
  
  const permitTypes = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  };
  
  const permitMessage = {
    owner: relayerAccount.address,
    spender: ROUTER,
    value: amountIn,
    nonce: permitNonce,
    deadline: deadline
  };
  
  const permitSig = await walletClient.signTypedData({
    domain: permitDomain,
    types: permitTypes,
    primaryType: 'Permit',
    message: permitMessage
  });
  
  const permitR = permitSig.slice(0, 66);
  const permitS = '0x' + permitSig.slice(66, 130);
  let permitV = parseInt(permitSig.slice(130, 132), 16);
  if (permitV < 27) permitV += 27;
  
  console.log('Permit signature:');
  console.log('  v:', permitV);
  console.log('  r:', permitR);
  console.log('  s:', permitS);
  
  // Sign swap intent
  console.log('\n--- Signing Swap Intent ---');
  const swapDomain = {
    name: 'ZeroTollRouter',
    version: '1',
    chainId: 11155111,
    verifyingContract: ROUTER
  };
  
  const swapTypes = {
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
  
  const intent = {
    user: relayerAccount.address,
    tokenIn: ZTA_TOKEN,
    tokenOut: ZTB_TOKEN,
    amountIn: amountIn,
    minAmountOut: minAmountOut,
    deadline: deadline,
    nonce: swapNonce,
    chainId: 11155111n
  };
  
  const swapSig = await walletClient.signTypedData({
    domain: swapDomain,
    types: swapTypes,
    primaryType: 'SwapIntent',
    message: intent
  });
  
  console.log('Swap intent signature:', swapSig.slice(0, 20) + '...');
  
  // First, simulate the call
  console.log('\n--- Simulating Call ---');
  try {
    const result = await publicClient.simulateContract({
      address: ROUTER,
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
      args: [
        intent,
        swapSig,
        deadline,
        permitV,
        permitR,
        permitS
      ],
      account: relayerAccount.address
    });
    console.log('✅ Simulation succeeded! Result:', result.result.toString());
  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    if (error.cause?.data) {
      console.error('Error data:', error.cause.data);
    }
  }
  
  // Now try the actual call
  console.log('\n--- Executing Call ---');
  try {
    const hash = await walletClient.writeContract({
      address: ROUTER,
      abi: ROUTER_ABI,
      functionName: 'executeSwapWithPermit',
      args: [
        intent,
        swapSig,
        deadline,
        permitV,
        permitR,
        permitS
      ]
    });
    
    console.log('✅ Transaction sent:', hash);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);
    console.log('Status:', receipt.status);
    
  } catch (error) {
    console.error('❌ Transaction failed:', error.message);
    if (error.cause?.data) {
      console.error('Error data:', error.cause.data);
    }
  }
}

main().catch(console.error);
