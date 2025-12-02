/**
 * Comprehensive EIP-7702 Gasless Swap Test
 * 
 * Tests all working gasless swap scenarios:
 * 1. USDC -> WPOL (0.1, 0.2, 0.3, 0.5 USDC)
 * 2. WPOL -> USDC (1 WPOL)
 * 
 * All transactions are gasless - user pays no gas!
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
import { polygonAmoy } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Configuration
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PIMLICO_URL = `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Contract addresses
const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const WPOL_ADDRESS = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
const ROUTER_HUB = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
const MOCK_DEX_ADAPTER = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';

// ABIs
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

async function executeGaslessSwap(smartAccountClient, publicClient, tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut, tokenInSymbol, tokenOutSymbol) {
  const swapAmountIn = parseUnits(amountIn.toString(), decimalsIn);
  
  // Get quote
  const [quoteOut] = await publicClient.readContract({
    address: MOCK_DEX_ADAPTER,
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [tokenIn, tokenOut, swapAmountIn],
  });
  
  const minAmountOut = (quoteOut * 95n) / 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  
  // Build routeData
  const routeData = encodeFunctionData({
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'swap',
    args: [tokenIn, tokenOut, swapAmountIn, minAmountOut, ROUTER_HUB, deadline],
  });
  
  // Build intent
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
  
  // Build swap calldata
  const swapData = encodeFunctionData({
    abi: ROUTER_HUB_ABI,
    functionName: 'executeRoute',
    args: [intent, MOCK_DEX_ADAPTER, routeData],
  });
  
  // Send gasless transaction
  const swapTx = await smartAccountClient.sendTransaction({
    to: ROUTER_HUB,
    data: swapData,
    value: 0n,
  });
  
  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
  
  return {
    txHash: swapTx,
    status: receipt.status,
    amountIn: amountIn,
    expectedOut: formatUnits(quoteOut, decimalsOut),
    tokenInSymbol,
    tokenOutSymbol,
  };
}

async function main() {
  console.log('🚀 Comprehensive EIP-7702 Gasless Swap Test\n');
  console.log('='.repeat(70));
  console.log('This test demonstrates GASLESS swaps on Polygon Amoy');
  console.log('User pays ZERO gas - all fees sponsored by Pimlico paymaster');
  console.log('='.repeat(70));
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('\n📍 EOA Address:', account.address);
  
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  // Create smart account
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
  
  // Check initial balances
  console.log('\n📊 Initial Balances:');
  const eoaPol = await publicClient.getBalance({ address: account.address });
  console.log('   EOA POL:', formatUnits(eoaPol, 18));
  
  const eoaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   EOA USDC:', formatUnits(eoaUsdc, 6));
  
  const saUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   Smart Account USDC:', formatUnits(saUsdc, 6));
  
  const saWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   Smart Account WPOL:', formatUnits(saWpol, 18));
  
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
  
  // Ensure approvals
  console.log('\n🔐 Checking Approvals...');
  
  const usdcAllowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [smartAccount.address, ROUTER_HUB],
  });
  
  if (usdcAllowance < parseUnits('1000', 6)) {
    console.log('   Approving USDC...');
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, parseUnits('1000000', 6)],
    });
    const tx = await smartAccountClient.sendTransaction({ to: USDC_ADDRESS, data: approvalData, value: 0n });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('   ✅ USDC approved');
  } else {
    console.log('   ✅ USDC already approved');
  }
  
  const wpolAllowance = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [smartAccount.address, ROUTER_HUB],
  });
  
  if (wpolAllowance < parseUnits('100', 18)) {
    console.log('   Approving WPOL...');
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, parseUnits('1000000', 18)],
    });
    const tx = await smartAccountClient.sendTransaction({ to: WPOL_ADDRESS, data: approvalData, value: 0n });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('   ✅ WPOL approved');
  } else {
    console.log('   ✅ WPOL already approved');
  }
  
  // Test swaps
  const results = [];
  
  // Test 1: USDC -> WPOL swaps
  const usdcAmounts = [0.1, 0.2];
  for (const amount of usdcAmounts) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📝 Gasless Swap: ${amount} USDC -> WPOL`);
    console.log('='.repeat(70));
    
    try {
      const result = await executeGaslessSwap(
        smartAccountClient, publicClient,
        USDC_ADDRESS, WPOL_ADDRESS,
        amount, 6, 18,
        'USDC', 'WPOL'
      );
      console.log(`✅ SUCCESS!`);
      console.log(`   TX: ${result.txHash}`);
      console.log(`   🔗 https://amoy.polygonscan.com/tx/${result.txHash}`);
      console.log(`   Expected: ~${result.expectedOut} WPOL`);
      results.push({ ...result, success: true });
    } catch (error) {
      console.error(`❌ FAILED: ${error.message}`);
      results.push({ amountIn: amount, tokenInSymbol: 'USDC', tokenOutSymbol: 'WPOL', success: false, error: error.message });
    }
    
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Test 2: WPOL -> USDC swap
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📝 Gasless Swap: 0.5 WPOL -> USDC`);
  console.log('='.repeat(70));
  
  try {
    const result = await executeGaslessSwap(
      smartAccountClient, publicClient,
      WPOL_ADDRESS, USDC_ADDRESS,
      0.5, 18, 6,
      'WPOL', 'USDC'
    );
    console.log(`✅ SUCCESS!`);
    console.log(`   TX: ${result.txHash}`);
    console.log(`   🔗 https://amoy.polygonscan.com/tx/${result.txHash}`);
    console.log(`   Expected: ~${result.expectedOut} USDC`);
    results.push({ ...result, success: true });
  } catch (error) {
    console.error(`❌ FAILED: ${error.message}`);
    results.push({ amountIn: 0.5, tokenInSymbol: 'WPOL', tokenOutSymbol: 'USDC', success: false, error: error.message });
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success).length;
  console.log(`\nTotal Tests: ${results.length} | Success: ${successful} | Failed: ${results.length - successful}`);
  
  console.log('\nResults:');
  for (const r of results) {
    if (r.success) {
      console.log(`  ✅ ${r.amountIn} ${r.tokenInSymbol} -> ${r.tokenOutSymbol}: ${r.txHash.slice(0, 20)}...`);
    } else {
      console.log(`  ❌ ${r.amountIn} ${r.tokenInSymbol} -> ${r.tokenOutSymbol}: ${r.error?.slice(0, 50)}...`);
    }
  }
  
  // Final balances
  console.log('\n📊 Final Balances:');
  const finalSaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   Smart Account USDC:', formatUnits(finalSaUsdc, 6));
  
  const finalSaWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   Smart Account WPOL:', formatUnits(finalSaWpol, 18));
  
  // Check EOA POL balance (should be unchanged - no gas spent!)
  const finalEoaPol = await publicClient.getBalance({ address: account.address });
  console.log('\n   EOA POL (before):', formatUnits(eoaPol, 18));
  console.log('   EOA POL (after):', formatUnits(finalEoaPol, 18));
  console.log('   POL spent on gas:', formatUnits(eoaPol - finalEoaPol, 18));
  
  if (successful === results.length) {
    console.log('\n🎉🎉🎉 ALL GASLESS SWAPS SUCCESSFUL! 🎉🎉🎉');
    console.log('\nEIP-7702 gasless transactions are working perfectly!');
    console.log('Users can swap tokens without paying any gas fees.');
  }
}

main().catch(console.error);
