/**
 * Test 0.5 USDC -> WPOL gasless swap
 */

import { 
  createPublicClient, 
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PIMLICO_URL = `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const WPOL_ADDRESS = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
const ROUTER_HUB = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
const MOCK_DEX_ADAPTER = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
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
  console.log('🚀 Testing 0.5 USDC -> WPOL Gasless Swap\n');
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  const pimlicoClient = createPimlicoClient({
    chain: polygonAmoy,
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
  console.log('💵 USDC:', formatUnits(saUsdc, 6));
  
  const adapterWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('💰 Adapter WPOL:', formatUnits(adapterWpol, 18));
  
  // Create smart account client
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: polygonAmoy,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      },
    },
  });
  
  // Swap 0.5 USDC
  const swapAmountIn = parseUnits('0.5', 6);
  
  // Get quote
  const [quoteOut] = await publicClient.readContract({
    address: MOCK_DEX_ADAPTER,
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [USDC_ADDRESS, WPOL_ADDRESS, swapAmountIn],
  });
  console.log('\n📊 Quote: 0.5 USDC ->', formatUnits(quoteOut, 18), 'WPOL');
  
  const minAmountOut = (quoteOut * 95n) / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
  // Build routeData
  const routeData = encodeFunctionData({
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [USDC_ADDRESS, WPOL_ADDRESS, swapAmountIn, minAmountOut, ROUTER_HUB, deadline],
  });
  
  // Build intent
  const intent = {
    user: smartAccount.address,
    tokenIn: USDC_ADDRESS,
    amtIn: swapAmountIn,
    tokenOut: WPOL_ADDRESS,
    minOut: minAmountOut,
    dstChainId: 80002,
    deadline: Number(deadline),
    feeToken: USDC_ADDRESS,
    feeMode: 1,
    feeCapToken: parseUnits('0.01', 18),
    routeHint: '0x',
    nonce: BigInt(Date.now()),
  };
  
  // Build swap calldata
  const swapData = encodeFunctionData({
    abi: ROUTER_HUB_ABI,
    functionName: 'executeRoute',
    args: [intent, MOCK_DEX_ADAPTER, routeData],
  });
  
  console.log('\n🔄 Sending gasless swap...');
  try {
    const swapTx = await smartAccountClient.sendTransaction({
      to: ROUTER_HUB,
      data: swapData,
      value: 0n,
    });
    
    console.log('✅ TX:', swapTx);
    console.log('🔗 https://amoy.polygonscan.com/tx/' + swapTx);
    
    await publicClient.waitForTransactionReceipt({ hash: swapTx });
    console.log('✅ Confirmed!');
    
    // Final balances
    const finalUsdc = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    console.log('\n💵 Final USDC:', formatUnits(finalUsdc, 6));
    
    const finalWpol = await publicClient.readContract({
      address: WPOL_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    console.log('💰 Final WPOL:', formatUnits(finalWpol, 18));
    
    console.log('\n🎉 0.5 USDC GASLESS SWAP SUCCESSFUL!');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

main().catch(console.error);
