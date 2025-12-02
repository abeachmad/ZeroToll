/**
 * Test RouterHub directly with deployer
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
  decodeErrorResult,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';

const CONTRACTS = {
  routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
  mockDexAdapter: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B',
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  weth: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
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
  { name: 'nativeToWrapped', type: 'function', inputs: [{ name: '', type: 'address' }], outputs: [{ type: 'address' }], stateMutability: 'view' },
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

async function main() {
  console.log('🔍 Test RouterHub Directly\n');
  
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
  
  // Check RouterHub config
  console.log('\n📋 RouterHub Configuration:');
  const NATIVE_MARKER = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const wrappedNative = await client.readContract({
    address: CONTRACTS.routerHub,
    abi: ROUTER_HUB_ABI,
    functionName: 'nativeToWrapped',
    args: [NATIVE_MARKER],
  });
  console.log('   Wrapped Native:', wrappedNative);
  
  // Check deployer allowance
  const allowance = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [deployer.address, CONTRACTS.routerHub],
  });
  console.log('   Deployer USDC Allowance:', formatUnits(allowance, 6));
  
  // Approve if needed
  if (allowance < parseUnits('100', 6)) {
    console.log('\n📝 Approving USDC for RouterHub...');
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.routerHub, parseUnits('1000000', 6)],
    });
    
    const approvalTx = await walletClient.sendTransaction({
      to: CONTRACTS.usdc,
      data: approvalData,
    });
    console.log('   Approval TX:', approvalTx);
    await client.waitForTransactionReceipt({ hash: approvalTx });
  }
  
  // Get quote
  const swapAmountIn = parseUnits('0.1', 6);
  const [expectedOut] = await client.readContract({
    address: CONTRACTS.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [CONTRACTS.usdc, CONTRACTS.weth, swapAmountIn],
  });
  console.log('\n📋 Quote for 0.1 USDC -> WETH:');
  console.log('   Expected output:', formatUnits(expectedOut, 18), 'WETH');
  
  const minOut = expectedOut * 90n / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  // Create intent - NOTE: RouterHub sends output to intent.user, not to recipient in routeData
  // So the recipient in routeData should be RouterHub itself!
  const intent = {
    user: deployer.address,
    tokenIn: CONTRACTS.usdc,
    amtIn: swapAmountIn,
    tokenOut: CONTRACTS.weth,
    minOut: minOut,
    dstChainId: 0n,
    deadline: Number(deadline),
    feeToken: CONTRACTS.usdc,
    feeMode: 0, // Try feeMode 0
    feeCapToken: 0n,
    routeHint: '0x',
    nonce: BigInt(Date.now()),
  };
  
  // Create route data - recipient should be RouterHub so it can handle fee deduction
  const routeData = encodeFunctionData({
    abi: DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [
      CONTRACTS.usdc,
      CONTRACTS.weth,
      swapAmountIn,
      minOut,
      CONTRACTS.routerHub, // RouterHub as recipient!
      deadline,
    ],
  });
  
  console.log('\n📝 Testing executeRoute...');
  console.log('   Intent user:', intent.user);
  console.log('   Route recipient: RouterHub');
  
  // Try to execute
  try {
    // First try eth_call to get detailed error
    const result = await client.call({
      to: CONTRACTS.routerHub,
      data: encodeFunctionData({
        abi: ROUTER_HUB_ABI,
        functionName: 'executeRoute',
        args: [intent, CONTRACTS.mockDexAdapter, routeData],
      }),
      account: deployer.address,
    });
    console.log('   ✅ eth_call passed! Result:', result);
    
    // Execute
    const swapData = encodeFunctionData({
      abi: ROUTER_HUB_ABI,
      functionName: 'executeRoute',
      args: [intent, CONTRACTS.mockDexAdapter, routeData],
    });
    
    const swapTx = await walletClient.sendTransaction({
      to: CONTRACTS.routerHub,
      data: swapData,
      gas: 1000000n, // Explicit gas limit
    });
    
    console.log('   Swap TX:', swapTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + swapTx);
    
    const receipt = await client.waitForTransactionReceipt({ hash: swapTx });
    console.log('   ✅ Confirmed! Block:', receipt.blockNumber);
    
    // Check new balance
    const newWeth = await client.readContract({
      address: CONTRACTS.weth,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [deployer.address],
    });
    console.log('\n📊 Deployer WETH Balance:', formatUnits(newWeth, 18));
    console.log('🎉 ROUTERHUB SWAP SUCCESSFUL!');
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    
    // Try to decode error
    if (error.cause?.data) {
      console.error('   Error data:', error.cause.data);
    }
  }
}

main().catch(console.error);
