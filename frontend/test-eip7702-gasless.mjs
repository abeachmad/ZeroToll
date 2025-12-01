/**
 * EIP-7702 Gasless Transaction Test Script
 * 
 * Tests gasless swaps on Amoy using the provided wallet that already has Smart Account enabled.
 * 
 * WALLET: 0x5a87A3c738cf99DB95787D51B627217B6dE12F62
 * This wallet already has EIP-7702 Smart Account enabled (code: 0xef0100...)
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Configuration
const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Contract addresses - Amoy
const AMOY_CONFIG = {
  chainId: 80002,
  rpc: 'https://rpc-amoy.polygon.technology',
  routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
  mockDexAdapter: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1',
  tokens: {
    USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
    LINK: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904'
  },
  pimlicoRpc: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`
};

// ABIs
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }]
  }
];

const ROUTER_HUB_ABI = [
  {
    name: 'executeRoute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        components: [
          { name: 'user', type: 'address' },
          { name: 'tokenIn', type: 'address' },
          { name: 'amtIn', type: 'uint256' },
          { name: 'tokenOut', type: 'address' },
          { name: 'minOut', type: 'uint256' },
          { name: 'dstChainId', type: 'uint64' },
          { name: 'deadline', type: 'uint64' },
          { name: 'feeToken', type: 'address' },
          { name: 'feeMode', type: 'uint8' },
          { name: 'feeCapToken', type: 'uint256' },
          { name: 'routeHint', type: 'bytes' },
          { name: 'nonce', type: 'uint256' }
        ]
      },
      { name: 'adapter', type: 'address' },
      { name: 'routeData', type: 'bytes' }
    ],
    outputs: [{ type: 'uint256' }]
  }
];

const MOCK_DEX_ABI = [
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    outputs: [{ type: 'uint256' }]
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('EIP-7702 Gasless Transaction Test');
  console.log('='.repeat(60));
  
  // Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('\n📍 Wallet Address:', account.address);
  
  // Create clients
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(AMOY_CONFIG.rpc)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(AMOY_CONFIG.rpc)
  });
  
  // Step 1: Check if wallet is already a Smart Account
  console.log('\n📋 Step 1: Checking Smart Account Status...');
  const code = await publicClient.getCode({ address: account.address });
  
  if (code && code.startsWith('0xef0100')) {
    const delegator = '0x' + code.substring(8, 48);
    console.log('✅ Smart Account ENABLED');
    console.log('   Delegator:', delegator);
  } else {
    console.log('❌ Smart Account NOT enabled');
    console.log('   Code:', code || '(empty)');
    console.log('\n⚠️  This wallet needs to be upgraded to Smart Account first!');
    return;
  }
  
  // Step 2: Check balances
  console.log('\n📋 Step 2: Checking Balances...');
  
  const nativeBalance = await publicClient.getBalance({ address: account.address });
  console.log('   POL:', formatUnits(nativeBalance, 18));
  
  for (const [symbol, address] of Object.entries(AMOY_CONFIG.tokens)) {
    try {
      const balance = await publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address]
      });
      const decimals = await publicClient.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals'
      });
      console.log(`   ${symbol}: ${formatUnits(balance, decimals)}`);
    } catch (e) {
      console.log(`   ${symbol}: Error - ${e.message}`);
    }
  }
  
  // Step 3: Check allowance
  console.log('\n📋 Step 3: Checking USDC Allowance to RouterHub...');
  const allowance = await publicClient.readContract({
    address: AMOY_CONFIG.tokens.USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, AMOY_CONFIG.routerHub]
  });
  console.log('   Allowance:', formatUnits(allowance, 6), 'USDC');
  
  // Step 4: Approve if needed
  const swapAmount = parseUnits('0.1', 6); // 0.1 USDC
  
  if (allowance < swapAmount) {
    console.log('\n📋 Step 4: Approving USDC...');
    const approveHash = await walletClient.writeContract({
      address: AMOY_CONFIG.tokens.USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AMOY_CONFIG.routerHub, parseUnits('1000', 6)] // Approve 1000 USDC
    });
    console.log('   Approval TX:', approveHash);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log('   Status:', receipt.status === 'success' ? '✅ Success' : '❌ Failed');
  } else {
    console.log('\n📋 Step 4: Approval already sufficient ✅');
  }
  
  // Step 5: Build and execute swap
  console.log('\n📋 Step 5: Building Swap Transaction...');
  
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const minOut = parseUnits('0.1', 18); // Very low minOut to avoid slippage issues
  
  // Build routeData for MockDEXAdapter
  const routeData = encodeFunctionData({
    abi: MOCK_DEX_ABI,
    functionName: 'swap',
    args: [
      AMOY_CONFIG.tokens.USDC,    // tokenIn
      AMOY_CONFIG.tokens.WMATIC,  // tokenOut
      swapAmount,                  // amountIn
      minOut,                      // minAmountOut
      AMOY_CONFIG.routerHub,       // recipient
      deadline                     // deadline
    ]
  });
  
  // Build intent
  const intent = {
    user: account.address,
    tokenIn: AMOY_CONFIG.tokens.USDC,
    amtIn: swapAmount,
    tokenOut: AMOY_CONFIG.tokens.WMATIC,
    minOut: minOut,
    dstChainId: 80002n,
    deadline: deadline,
    feeToken: AMOY_CONFIG.tokens.USDC,
    feeMode: 1, // TOKEN_INPUT_SOURCE
    feeCapToken: parseUnits('1', 18),
    routeHint: '0x',
    nonce: BigInt(Date.now())
  };
  
  console.log('   Intent:', {
    user: intent.user,
    tokenIn: 'USDC',
    amtIn: formatUnits(intent.amtIn, 6),
    tokenOut: 'WMATIC',
    minOut: formatUnits(intent.minOut, 18)
  });
  
  // Step 6: Execute via RouterHub (regular transaction first to verify it works)
  console.log('\n📋 Step 6: Executing Swap via RouterHub...');
  
  try {
    // First, simulate the call
    console.log('   Simulating...');
    const { request } = await publicClient.simulateContract({
      address: AMOY_CONFIG.routerHub,
      abi: ROUTER_HUB_ABI,
      functionName: 'executeRoute',
      args: [intent, AMOY_CONFIG.mockDexAdapter, routeData],
      account: account.address
    });
    
    console.log('   ✅ Simulation successful!');
    
    // Execute the transaction
    console.log('   Executing...');
    const txHash = await walletClient.writeContract(request);
    console.log('   TX Hash:', txHash);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log('   Status:', receipt.status === 'success' ? '✅ SUCCESS!' : '❌ Failed');
    console.log('   Gas Used:', receipt.gasUsed.toString());
    console.log('   Block:', receipt.blockNumber.toString());
    
    if (receipt.status === 'success') {
      console.log('\n🎉 SWAP SUCCESSFUL!');
      
      // Check new balances
      const newWmaticBalance = await publicClient.readContract({
        address: AMOY_CONFIG.tokens.WMATIC,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address]
      });
      console.log('   New WMATIC Balance:', formatUnits(newWmaticBalance, 18));
    }
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    
    if (error.cause?.data) {
      console.log('   Revert data:', error.cause.data);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
