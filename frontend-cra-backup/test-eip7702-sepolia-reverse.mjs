/**
 * Gasless Swap WETH -> USDC on Sepolia
 */

import { 
  createPublicClient, 
  http, 
  parseEther,
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
const PIMLICO_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const ROUTER_HUB = '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84';
const MOCK_DEX_ADAPTER = '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';

const ERC20_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
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

const MOCK_DEX_ADAPTER_ABI = [
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
    outputs: [{ type: 'uint256' }, { type: 'address[]' }],
    stateMutability: 'view',
  },
];

async function main() {
  console.log('🚀 Gasless Swap WETH -> USDC on Sepolia\n');
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const pimlicoClient = createPimlicoClient({
    chain: sepolia,
    transport: http(PIMLICO_URL),
  });
  
  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: account,
    entryPoint: { address: ENTRY_POINT_V07, version: '0.7' },
  });
  
  console.log('📍 Smart Account:', smartAccount.address);
  
  // Check balances
  const saUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   USDC:', formatUnits(saUsdc, 6));
  
  const saWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   WETH:', formatUnits(saWeth, 18));
  
  if (saWeth < parseEther('0.0005')) {
    console.log('\n⚠️ Smart Account has insufficient WETH for swap');
    return;
  }
  
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: sepolia,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });
  
  // Step 1: Approve WETH
  console.log('\n📝 Step 1: Approve WETH...');
  const wethAllowance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [smartAccount.address, ROUTER_HUB],
  });
  
  if (wethAllowance < parseEther('1')) {
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, parseEther('1000')],
    });
    
    const approvalTx = await smartAccountClient.sendTransaction({
      to: WETH_ADDRESS,
      data: approvalData,
      value: 0n,
    });
    
    console.log('✅ Approval TX:', approvalTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + approvalTx);
    await publicClient.waitForTransactionReceipt({ hash: approvalTx });
  } else {
    console.log('✅ WETH already approved');
  }
  
  // Step 2: Swap WETH -> USDC
  console.log('\n📝 Step 2: Swap 0.0005 WETH -> USDC...');
  
  const swapAmountIn = parseEther('0.0005');
  
  const [quoteOut] = await publicClient.readContract({
    address: MOCK_DEX_ADAPTER,
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [WETH_ADDRESS, USDC_ADDRESS, swapAmountIn],
  });
  
  console.log('   Quote: 0.0005 WETH ->', formatUnits(quoteOut, 6), 'USDC');
  
  const minAmountOut = (quoteOut * 95n) / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
  const routeData = encodeFunctionData({
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [WETH_ADDRESS, USDC_ADDRESS, swapAmountIn, minAmountOut, ROUTER_HUB, deadline],
  });
  
  const intent = {
    user: smartAccount.address,
    tokenIn: WETH_ADDRESS,
    amtIn: swapAmountIn,
    tokenOut: USDC_ADDRESS,
    minOut: minAmountOut,
    dstChainId: 11155111,
    deadline: Number(deadline),
    feeToken: WETH_ADDRESS,
    feeMode: 1,
    feeCapToken: parseUnits('0.01', 18),
    routeHint: '0x',
    nonce: BigInt(Date.now()),
  };
  
  const swapData = encodeFunctionData({
    abi: ROUTER_HUB_ABI,
    functionName: 'executeRoute',
    args: [intent, MOCK_DEX_ADAPTER, routeData],
  });
  
  const swapTx = await smartAccountClient.sendTransaction({
    to: ROUTER_HUB,
    data: swapData,
    value: 0n,
  });
  
  console.log('✅ Swap TX:', swapTx);
  console.log('   🔗 https://sepolia.etherscan.io/tx/' + swapTx);
  
  await publicClient.waitForTransactionReceipt({ hash: swapTx });
  console.log('✅ Swap confirmed!');
  
  // Final balances
  console.log('\n📊 Final Balances:');
  const finalUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   USDC:', formatUnits(finalUsdc, 6));
  
  const finalWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   WETH:', formatUnits(finalWeth, 18));
  
  console.log('\n🎉 WETH -> USDC GASLESS SWAP SUCCESSFUL!');
}

main().catch(console.error);
