/**
 * Stress test for EIP-7702 gasless swaps
 * Tests multiple swaps in sequence
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

async function swap(smartAccountClient, publicClient, tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut) {
  const swapAmountIn = parseUnits(amountIn.toString(), decimalsIn);
  
  const [quoteOut] = await publicClient.readContract({
    address: MOCK_DEX_ADAPTER,
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [tokenIn, tokenOut, swapAmountIn],
  });
  
  const minAmountOut = (quoteOut * 95n) / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
  const routeData = encodeFunctionData({
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [tokenIn, tokenOut, swapAmountIn, minAmountOut, ROUTER_HUB, deadline],
  });
  
  const intent = {
    user: smartAccountClient.account.address,
    tokenIn: tokenIn,
    amtIn: swapAmountIn,
    tokenOut: tokenOut,
    minOut: minAmountOut,
    dstChainId: 80002,
    deadline: Number(deadline),
    feeToken: tokenIn,
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
  
  const tx = await smartAccountClient.sendTransaction({
    to: ROUTER_HUB,
    data: swapData,
    value: 0n,
  });
  
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  return { tx, expectedOut: formatUnits(quoteOut, decimalsOut) };
}

async function main() {
  console.log('🔥 EIP-7702 Gasless Swap Stress Test\n');
  
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
  
  // Check adapter liquidity
  const adapterWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('💰 Adapter WPOL:', formatUnits(adapterWpol, 18));
  
  const adapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('💵 Adapter USDC:', formatUnits(adapterUsdc, 6));
  
  // Run stress test - alternating swaps
  const tests = [
    { tokenIn: USDC_ADDRESS, tokenOut: WPOL_ADDRESS, amount: 0.1, decimalsIn: 6, decimalsOut: 18, label: '0.1 USDC -> WPOL' },
    { tokenIn: WPOL_ADDRESS, tokenOut: USDC_ADDRESS, amount: 0.5, decimalsIn: 18, decimalsOut: 6, label: '0.5 WPOL -> USDC' },
    { tokenIn: USDC_ADDRESS, tokenOut: WPOL_ADDRESS, amount: 0.15, decimalsIn: 6, decimalsOut: 18, label: '0.15 USDC -> WPOL' },
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🔄 ${test.label}...`);
    try {
      const result = await swap(
        smartAccountClient, publicClient,
        test.tokenIn, test.tokenOut,
        test.amount, test.decimalsIn, test.decimalsOut
      );
      console.log(`✅ TX: ${result.tx}`);
      console.log(`   Output: ~${result.expectedOut}`);
      results.push({ ...test, success: true, tx: result.tx });
    } catch (error) {
      console.error(`❌ Failed: ${error.message.slice(0, 80)}...`);
      results.push({ ...test, success: false });
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 STRESS TEST RESULTS');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  console.log(`Total: ${results.length} | Success: ${successful} | Failed: ${results.length - successful}`);
  
  if (successful === results.length) {
    console.log('\n🎉 ALL STRESS TESTS PASSED!');
  }
}

main().catch(console.error);
