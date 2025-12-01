/**
 * Test MockDexAdapter directly (bypassing RouterHub)
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';

const CONTRACTS = {
  mockDexAdapter: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
};

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

const DEX_ADAPTER_ABI = [
  {
    name: 'swap',
    type: 'function',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getQuote',
    type: 'function',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    stateMutability: 'view',
  },
  { name: 'supportedTokens', type: 'function', inputs: [{ name: 'token', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { name: 'priceOracle', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
];

async function main() {
  console.log('🔍 Test MockDexAdapter Directly\n');
  
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  console.log('📍 Deployer:', deployer.address);
  
  const client = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const walletClient = createWalletClient({
    account: deployer,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check adapter config
  console.log('\n📋 Adapter Configuration:');
  const priceOracle = await client.readContract({
    address: CONTRACTS.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'priceOracle',
  });
  console.log('   Price Oracle:', priceOracle);
  
  const usdcSupported = await client.readContract({
    address: CONTRACTS.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'supportedTokens',
    args: [CONTRACTS.usdc],
  });
  console.log('   USDC supported:', usdcSupported);
  
  const wethSupported = await client.readContract({
    address: CONTRACTS.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'supportedTokens',
    args: [CONTRACTS.weth],
  });
  console.log('   WETH supported:', wethSupported);
  
  // Check adapter liquidity
  console.log('\n📋 Adapter Liquidity:');
  const adapterUsdc = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [CONTRACTS.mockDexAdapter],
  });
  console.log('   USDC:', formatUnits(adapterUsdc, 6));
  
  const adapterWeth = await client.readContract({
    address: CONTRACTS.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [CONTRACTS.mockDexAdapter],
  });
  console.log('   WETH:', formatUnits(adapterWeth, 18));
  
  // Get quote
  const swapAmountIn = parseUnits('0.1', 6);
  console.log('\n📋 Quote for 0.1 USDC -> WETH:');
  const [expectedOut] = await client.readContract({
    address: CONTRACTS.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [CONTRACTS.usdc, CONTRACTS.weth, swapAmountIn],
  });
  console.log('   Expected output:', formatUnits(expectedOut, 18), 'WETH');
  
  // The MockDexAdapter uses PUSH pattern - tokens must be transferred to it first
  // Then it swaps from its own balance
  console.log('\n📝 Testing direct swap (PUSH pattern)...');
  console.log('   Step 1: Transfer USDC to adapter');
  
  // Transfer USDC to adapter
  const transferData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [CONTRACTS.mockDexAdapter, swapAmountIn],
  });
  
  const transferTx = await walletClient.sendTransaction({
    to: CONTRACTS.usdc,
    data: transferData,
  });
  console.log('   Transfer TX:', transferTx);
  await client.waitForTransactionReceipt({ hash: transferTx });
  
  // Now call swap
  console.log('   Step 2: Call swap on adapter');
  
  const minOut = expectedOut * 90n / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  // Simulate swap
  try {
    await client.simulateContract({
      address: CONTRACTS.mockDexAdapter,
      abi: DEX_ADAPTER_ABI,
      functionName: 'swap',
      args: [
        CONTRACTS.usdc,
        CONTRACTS.weth,
        swapAmountIn,
        minOut,
        deployer.address,
        deadline,
      ],
      account: deployer.address,
    });
    console.log('   ✅ Simulation passed!');
    
    // Execute swap
    const swapData = encodeFunctionData({
      abi: DEX_ADAPTER_ABI,
      functionName: 'swap',
      args: [
        CONTRACTS.usdc,
        CONTRACTS.weth,
        swapAmountIn,
        minOut,
        deployer.address,
        deadline,
      ],
    });
    
    const swapTx = await walletClient.sendTransaction({
      to: CONTRACTS.mockDexAdapter,
      data: swapData,
    });
    
    console.log('   Swap TX:', swapTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + swapTx);
    
    await client.waitForTransactionReceipt({ hash: swapTx });
    
    // Check new balance
    const newWeth = await client.readContract({
      address: CONTRACTS.weth,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [deployer.address],
    });
    console.log('\n📊 Deployer WETH Balance:', formatUnits(newWeth, 18));
    console.log('🎉 DIRECT ADAPTER SWAP SUCCESSFUL!');
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    if (error.cause?.reason) {
      console.error('   Reason:', error.cause.reason);
    }
  }
}

main().catch(console.error);
