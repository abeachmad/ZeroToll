/**
 * Debug Sepolia Swap - Check each step
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

// Use deployer key for direct testing
const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';
const SMART_ACCOUNT = '0xEef74EB6f5eA5f869115846E9771A8551f9e4323';

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
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
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
  { name: 'whitelistedAdapter', type: 'function', inputs: [{ name: 'adapter', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { name: 'gaslessFeeRecipient', type: 'function', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { name: 'gaslessFeeBps', type: 'function', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
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
  console.log('🔍 Debug Sepolia Swap\n');
  
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  console.log('📍 Deployer:', deployer.address);
  console.log('📍 Smart Account:', SMART_ACCOUNT);
  
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
  const isWhitelisted = await client.readContract({
    address: CONTRACTS.routerHub,
    abi: ROUTER_HUB_ABI,
    functionName: 'whitelistedAdapter',
    args: [CONTRACTS.mockDexAdapter],
  });
  console.log('   Adapter whitelisted:', isWhitelisted);
  
  const feeRecipient = await client.readContract({
    address: CONTRACTS.routerHub,
    abi: ROUTER_HUB_ABI,
    functionName: 'gaslessFeeRecipient',
  });
  console.log('   Fee recipient:', feeRecipient);
  
  const feeBps = await client.readContract({
    address: CONTRACTS.routerHub,
    abi: ROUTER_HUB_ABI,
    functionName: 'gaslessFeeBps',
  });
  console.log('   Fee bps:', feeBps);
  
  // Check balances
  console.log('\n📋 Balances:');
  const saUsdc = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ACCOUNT],
  });
  console.log('   Smart Account USDC:', formatUnits(saUsdc, 6));
  
  const saAllowance = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [SMART_ACCOUNT, CONTRACTS.routerHub],
  });
  console.log('   Smart Account USDC Allowance:', formatUnits(saAllowance, 6));
  
  // Check deployer balances
  const deployerUsdc = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [deployer.address],
  });
  console.log('   Deployer USDC:', formatUnits(deployerUsdc, 6));
  
  // Test with deployer directly (not smart account)
  console.log('\n📝 Testing swap with deployer account directly...');
  
  const swapAmountIn = parseUnits('0.1', 6);
  
  // Get quote
  const [expectedOut] = await client.readContract({
    address: CONTRACTS.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [CONTRACTS.usdc, CONTRACTS.weth, swapAmountIn],
  });
  console.log('   Expected output:', formatUnits(expectedOut, 18), 'WETH');
  
  const minOut = expectedOut * 90n / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  
  // Check deployer allowance
  const deployerAllowance = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [deployer.address, CONTRACTS.routerHub],
  });
  console.log('   Deployer USDC Allowance:', formatUnits(deployerAllowance, 6));
  
  if (deployerAllowance < swapAmountIn) {
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
  
  // Create intent with deployer as user
  const intent = {
    user: deployer.address, // Use deployer, not smart account
    tokenIn: CONTRACTS.usdc,
    amtIn: swapAmountIn,
    tokenOut: CONTRACTS.weth,
    minOut: minOut,
    dstChainId: 0n,
    deadline: Number(deadline),
    feeToken: CONTRACTS.usdc,
    feeMode: 1,
    feeCapToken: 0n,
    routeHint: '0x',
    nonce: BigInt(Date.now()),
  };
  
  // Create route data
  const routeData = encodeFunctionData({
    abi: DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [
      CONTRACTS.usdc,
      CONTRACTS.weth,
      swapAmountIn,
      minOut,
      deployer.address, // Recipient is deployer
      deadline,
    ],
  });
  
  // Simulate first
  console.log('\n🔍 Simulating executeRoute...');
  try {
    await client.simulateContract({
      address: CONTRACTS.routerHub,
      abi: ROUTER_HUB_ABI,
      functionName: 'executeRoute',
      args: [intent, CONTRACTS.mockDexAdapter, routeData],
      account: deployer.address,
    });
    console.log('✅ Simulation passed!');
    
    // Execute
    console.log('\n🔄 Executing swap...');
    const swapData = encodeFunctionData({
      abi: ROUTER_HUB_ABI,
      functionName: 'executeRoute',
      args: [intent, CONTRACTS.mockDexAdapter, routeData],
    });
    
    const swapTx = await walletClient.sendTransaction({
      to: CONTRACTS.routerHub,
      data: swapData,
    });
    
    console.log('✅ Swap TX:', swapTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + swapTx);
    
    const receipt = await client.waitForTransactionReceipt({ hash: swapTx });
    console.log('✅ Confirmed! Block:', receipt.blockNumber);
    
    // Check new balance
    const newWeth = await client.readContract({
      address: CONTRACTS.weth,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [deployer.address],
    });
    console.log('\n📊 Deployer WETH Balance:', formatUnits(newWeth, 18));
    console.log('🎉 SWAP SUCCESSFUL!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause?.data) {
      console.error('   Revert data:', error.cause.data);
    }
  }
}

main().catch(console.error);
