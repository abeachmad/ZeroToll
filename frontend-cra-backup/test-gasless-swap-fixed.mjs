/**
 * Fixed Gasless Swap Test
 * Key insight: routeData recipient must be RouterHub, not user
 */

import { 
  createPublicClient, 
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia, polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

const SEPOLIA = {
  routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
  mockDexAdapter: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
};

const AMOY = {
  routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881',
  mockDexAdapter: '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1',
  usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
  link: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
};

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
];

const ROUTER_HUB_ABI = [
  {
    name: 'executeRoute',
    type: 'function',
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
          { name: 'nonce', type: 'uint256' },
        ],
      },
      { name: 'adapter', type: 'address' },
      { name: 'routeData', type: 'bytes' },
    ],
    outputs: [{ type: 'uint256' }],
  },
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
];

async function testSepoliaGaslessSwap() {
  console.log('=' .repeat(60));
  console.log('🔄 SEPOLIA GASLESS SWAP TEST');
  console.log('=' .repeat(60));
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const client = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const pimlicoClient = createPimlicoClient({
    chain: sepolia,
    transport: http(`https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`),
  });
  
  const smartAccount = await toSimpleSmartAccount({
    client,
    owner: account,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 Smart Account:', smartAccount.address);
  
  // Check balances
  const usdcBalance = await client.readContract({
    address: SEPOLIA.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('📊 USDC Balance:', formatUnits(usdcBalance, 6));
  
  const wethBefore = await client.readContract({
    address: SEPOLIA.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('📊 WETH Balance:', formatUnits(wethBefore, 18));
  
  if (usdcBalance < parseUnits('0.1', 6)) {
    console.log('⚠️ Insufficient USDC for test');
    return;
  }
  
  // Create smart account client
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: sepolia,
    bundlerTransport: http(`https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });
  
  // Check/set approval
  const allowance = await client.readContract({
    address: SEPOLIA.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [smartAccount.address, SEPOLIA.routerHub],
  });
  
  if (allowance < parseUnits('100', 6)) {
    console.log('\n📝 Approving USDC...');
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [SEPOLIA.routerHub, parseUnits('1000000', 6)],
    });
    
    const approvalTx = await smartAccountClient.sendTransaction({
      to: SEPOLIA.usdc,
      data: approvalData,
      value: 0n,
    });
    console.log('✅ Approval TX:', approvalTx);
    await client.waitForTransactionReceipt({ hash: approvalTx });
  }
  
  // Get quote
  const swapAmountIn = parseUnits('0.1', 6);
  const [expectedOut] = await client.readContract({
    address: SEPOLIA.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [SEPOLIA.usdc, SEPOLIA.weth, swapAmountIn],
  });
  
  console.log('\n📋 Swap: 0.1 USDC -> WETH');
  console.log('   Expected output:', formatUnits(expectedOut, 18), 'WETH');
  
  const minOut = expectedOut * 90n / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  // Create intent
  const intent = {
    user: smartAccount.address,
    tokenIn: SEPOLIA.usdc,
    amtIn: swapAmountIn,
    tokenOut: SEPOLIA.weth,
    minOut: minOut,
    dstChainId: 0n,
    deadline: Number(deadline),
    feeToken: SEPOLIA.usdc,
    feeMode: 0,
    feeCapToken: 0n,
    routeHint: '0x',
    nonce: BigInt(Date.now()),
  };
  
  // IMPORTANT: recipient in routeData must be RouterHub!
  const routeData = encodeFunctionData({
    abi: DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [
      SEPOLIA.usdc,
      SEPOLIA.weth,
      swapAmountIn,
      minOut,
      SEPOLIA.routerHub, // RouterHub as recipient!
      deadline,
    ],
  });
  
  const swapData = encodeFunctionData({
    abi: ROUTER_HUB_ABI,
    functionName: 'executeRoute',
    args: [intent, SEPOLIA.mockDexAdapter, routeData],
  });
  
  console.log('\n🔄 Executing gasless swap...');
  
  try {
    const swapTx = await smartAccountClient.sendTransaction({
      to: SEPOLIA.routerHub,
      data: swapData,
      value: 0n,
    });
    
    console.log('✅ Swap TX:', swapTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + swapTx);
    
    await client.waitForTransactionReceipt({ hash: swapTx });
    
    // Check new balance
    const wethAfter = await client.readContract({
      address: SEPOLIA.weth,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    
    console.log('\n📊 Final WETH Balance:', formatUnits(wethAfter, 18));
    console.log('📊 WETH Received:', formatUnits(wethAfter - wethBefore, 18));
    console.log('\n🎉 SEPOLIA GASLESS SWAP SUCCESSFUL!');
    return true;
    
  } catch (error) {
    console.error('❌ Swap failed:', error.message);
    return false;
  }
}

async function testAmoyGaslessSwap() {
  console.log('\n' + '=' .repeat(60));
  console.log('🔄 AMOY GASLESS SWAP TEST');
  console.log('=' .repeat(60));
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const client = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  const pimlicoClient = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(`https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`),
  });
  
  const smartAccount = await toSimpleSmartAccount({
    client,
    owner: account,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 Smart Account:', smartAccount.address);
  
  // Check balances
  const usdcBalance = await client.readContract({
    address: AMOY.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('📊 USDC Balance:', formatUnits(usdcBalance, 6));
  
  const linkBefore = await client.readContract({
    address: AMOY.link,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('📊 LINK Balance:', formatUnits(linkBefore, 18));
  
  if (usdcBalance < parseUnits('0.1', 6)) {
    console.log('⚠️ Insufficient USDC for test');
    return;
  }
  
  // Create smart account client
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: polygonAmoy,
    bundlerTransport: http(`https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });
  
  // Check/set approval
  const allowance = await client.readContract({
    address: AMOY.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [smartAccount.address, AMOY.routerHub],
  });
  
  if (allowance < parseUnits('100', 6)) {
    console.log('\n📝 Approving USDC...');
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AMOY.routerHub, parseUnits('1000000', 6)],
    });
    
    const approvalTx = await smartAccountClient.sendTransaction({
      to: AMOY.usdc,
      data: approvalData,
      value: 0n,
    });
    console.log('✅ Approval TX:', approvalTx);
    await client.waitForTransactionReceipt({ hash: approvalTx });
  }
  
  // Get quote
  const swapAmountIn = parseUnits('0.1', 6);
  const [expectedOut] = await client.readContract({
    address: AMOY.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [AMOY.usdc, AMOY.link, swapAmountIn],
  });
  
  console.log('\n📋 Swap: 0.1 USDC -> LINK');
  console.log('   Expected output:', formatUnits(expectedOut, 18), 'LINK');
  
  const minOut = expectedOut * 90n / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  // Create intent
  const intent = {
    user: smartAccount.address,
    tokenIn: AMOY.usdc,
    amtIn: swapAmountIn,
    tokenOut: AMOY.link,
    minOut: minOut,
    dstChainId: 0n,
    deadline: Number(deadline),
    feeToken: AMOY.usdc,
    feeMode: 0,
    feeCapToken: 0n,
    routeHint: '0x',
    nonce: BigInt(Date.now()),
  };
  
  // IMPORTANT: recipient in routeData must be RouterHub!
  const routeData = encodeFunctionData({
    abi: DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [
      AMOY.usdc,
      AMOY.link,
      swapAmountIn,
      minOut,
      AMOY.routerHub, // RouterHub as recipient!
      deadline,
    ],
  });
  
  const swapData = encodeFunctionData({
    abi: ROUTER_HUB_ABI,
    functionName: 'executeRoute',
    args: [intent, AMOY.mockDexAdapter, routeData],
  });
  
  console.log('\n🔄 Executing gasless swap...');
  
  try {
    const swapTx = await smartAccountClient.sendTransaction({
      to: AMOY.routerHub,
      data: swapData,
      value: 0n,
    });
    
    console.log('✅ Swap TX:', swapTx);
    console.log('   🔗 https://amoy.polygonscan.com/tx/' + swapTx);
    
    await client.waitForTransactionReceipt({ hash: swapTx });
    
    // Check new balance
    const linkAfter = await client.readContract({
      address: AMOY.link,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    
    console.log('\n📊 Final LINK Balance:', formatUnits(linkAfter, 18));
    console.log('📊 LINK Received:', formatUnits(linkAfter - linkBefore, 18));
    console.log('\n🎉 AMOY GASLESS SWAP SUCCESSFUL!');
    return true;
    
  } catch (error) {
    console.error('❌ Swap failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🌉 GASLESS SWAP TESTS\n');
  
  const sepoliaResult = await testSepoliaGaslessSwap();
  const amoyResult = await testAmoyGaslessSwap();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📋 SUMMARY');
  console.log('=' .repeat(60));
  console.log('Sepolia Gasless Swap:', sepoliaResult ? '✅ SUCCESS' : '❌ FAILED');
  console.log('Amoy Gasless Swap:', amoyResult ? '✅ SUCCESS' : '❌ FAILED');
  
  if (sepoliaResult && amoyResult) {
    console.log('\n🎉 Both chains support gasless swaps!');
    console.log('   Cross-chain would require bridge infrastructure.');
  }
}

main().catch(console.error);
