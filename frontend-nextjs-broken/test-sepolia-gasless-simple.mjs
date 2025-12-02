/**
 * Simple Sepolia Gasless Swap Test
 */

import { 
  createPublicClient, 
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

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
  console.log('🔄 Sepolia Gasless Swap Test\n');
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 EOA:', account.address);
  
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
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('📊 USDC Balance:', formatUnits(usdcBalance, 6));
  
  const wethBalance = await client.readContract({
    address: CONTRACTS.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('📊 WETH Balance:', formatUnits(wethBalance, 18));
  
  // Check allowance
  const allowance = await client.readContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [smartAccount.address, CONTRACTS.routerHub],
  });
  console.log('📊 USDC Allowance:', formatUnits(allowance, 6));
  
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
  
  // Step 1: Approve if needed
  if (allowance < parseUnits('100', 6)) {
    console.log('\n📝 Approving USDC...');
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.routerHub, parseUnits('1000000', 6)],
    });
    
    try {
      const approvalTx = await smartAccountClient.sendTransaction({
        to: CONTRACTS.usdc,
        data: approvalData,
        value: 0n,
      });
      console.log('✅ Approval TX:', approvalTx);
      await client.waitForTransactionReceipt({ hash: approvalTx });
    } catch (e) {
      console.error('❌ Approval failed:', e.message);
      return;
    }
  }
  
  // Step 2: Execute swap with smaller amount
  console.log('\n📝 Executing swap: 0.1 USDC -> WETH');
  
  const swapAmountIn = parseUnits('0.1', 6);
  
  // Get quote
  const [expectedOut] = await client.readContract({
    address: CONTRACTS.mockDexAdapter,
    abi: DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [CONTRACTS.usdc, CONTRACTS.weth, swapAmountIn],
  });
  console.log('   Expected output:', formatUnits(expectedOut, 18), 'WETH');
  
  const minOut = expectedOut * 90n / 100n; // 10% slippage tolerance
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
  
  // Create intent
  const intent = {
    user: smartAccount.address,
    tokenIn: CONTRACTS.usdc,
    amtIn: swapAmountIn,
    tokenOut: CONTRACTS.weth,
    minOut: minOut,
    dstChainId: 0n,
    deadline: Number(deadline),
    feeToken: CONTRACTS.usdc,
    feeMode: 1,
    feeCapToken: 0n, // No legacy fee
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
      smartAccount.address,
      deadline,
    ],
  });
  
  // Create executeRoute call
  const swapData = encodeFunctionData({
    abi: ROUTER_HUB_ABI,
    functionName: 'executeRoute',
    args: [intent, CONTRACTS.mockDexAdapter, routeData],
  });
  
  console.log('\n🔄 Sending gasless swap transaction...');
  
  try {
    const swapTx = await smartAccountClient.sendTransaction({
      to: CONTRACTS.routerHub,
      data: swapData,
      value: 0n,
    });
    
    console.log('✅ Swap TX:', swapTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + swapTx);
    
    const receipt = await client.waitForTransactionReceipt({ hash: swapTx });
    console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
    
    // Check new balance
    const newWethBalance = await client.readContract({
      address: CONTRACTS.weth,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    
    console.log('\n📊 Final WETH Balance:', formatUnits(newWethBalance, 18));
    console.log('📊 WETH Received:', formatUnits(newWethBalance - wethBalance, 18));
    console.log('\n🎉 GASLESS SWAP SUCCESSFUL!');
    
  } catch (error) {
    console.error('\n❌ Swap failed:', error.message);
    
    // Try to simulate the call directly
    console.log('\n🔍 Simulating direct contract call...');
    try {
      await client.simulateContract({
        address: CONTRACTS.routerHub,
        abi: ROUTER_HUB_ABI,
        functionName: 'executeRoute',
        args: [intent, CONTRACTS.mockDexAdapter, routeData],
        account: smartAccount.address,
      });
      console.log('✅ Direct simulation passed - issue is with UserOp');
    } catch (simError) {
      console.error('❌ Direct simulation failed:', simError.message);
    }
  }
}

main().catch(console.error);
