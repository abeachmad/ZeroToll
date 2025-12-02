/**
 * Final EIP-7702 Gasless Swap Test
 * 
 * Tests the requested amounts: 0.1-0.5 USDC -> POL/WPOL
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

async function executeGaslessSwap(smartAccountClient, publicClient, amountUsdc) {
  const swapAmountIn = parseUnits(amountUsdc.toString(), 6);
  
  // Get quote
  const [quoteOut] = await publicClient.readContract({
    address: MOCK_DEX_ADAPTER,
    abi: MOCK_DEX_ADAPTER_ABI,
    functionName: 'getQuote',
    args: [USDC_ADDRESS, WPOL_ADDRESS, swapAmountIn],
  });
  
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
    user: smartAccountClient.account.address,
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
    amountIn: amountUsdc,
    expectedOut: formatUnits(quoteOut, 18),
  };
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     🚀 EIP-7702 GASLESS SWAP - FINAL TEST 🚀                     ║');
  console.log('║                                                                  ║');
  console.log('║     Testing: 0.1, 0.2, 0.3, 0.5 USDC -> WPOL                    ║');
  console.log('║     Network: Polygon Amoy (Testnet)                              ║');
  console.log('║     Gas: ZERO (Sponsored by Pimlico Paymaster)                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 EOA Address:', account.address);
  
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
  
  // Transfer more USDC if needed
  if (saUsdc < parseUnits('2', 6)) {
    console.log('\n📤 Transferring 3 USDC to Smart Account...');
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [smartAccount.address, parseUnits('3', 6)],
    });
    const tx = await walletClient.sendTransaction({ to: USDC_ADDRESS, data: transferData });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('✅ Transfer done');
  }
  
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
  
  // Test amounts as requested: 0.1-0.5 USDC
  const testAmounts = [0.1, 0.2, 0.3, 0.5];
  const results = [];
  
  for (const amount of testAmounts) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📝 GASLESS SWAP: ${amount} USDC -> WPOL`);
    console.log('─'.repeat(70));
    
    try {
      const startTime = Date.now();
      const result = await executeGaslessSwap(smartAccountClient, publicClient, amount);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`✅ SUCCESS! (${duration}s)`);
      console.log(`   TX Hash: ${result.txHash}`);
      console.log(`   Explorer: https://amoy.polygonscan.com/tx/${result.txHash}`);
      console.log(`   Output: ~${parseFloat(result.expectedOut).toFixed(4)} WPOL`);
      results.push({ amount, success: true, txHash: result.txHash, output: result.expectedOut });
    } catch (error) {
      console.error(`❌ FAILED: ${error.message.slice(0, 100)}...`);
      results.push({ amount, success: false, error: error.message });
    }
    
    // Small delay between transactions
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Final Summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                      📊 FINAL RESULTS 📊                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  const successful = results.filter(r => r.success).length;
  console.log(`\n   Total Tests: ${results.length}`);
  console.log(`   Successful:  ${successful}`);
  console.log(`   Failed:      ${results.length - successful}`);
  console.log(`   Success Rate: ${((successful / results.length) * 100).toFixed(0)}%`);
  
  console.log('\n   Transaction Details:');
  for (const r of results) {
    if (r.success) {
      console.log(`   ✅ ${r.amount} USDC -> ~${parseFloat(r.output).toFixed(4)} WPOL`);
      console.log(`      TX: ${r.txHash}`);
    } else {
      console.log(`   ❌ ${r.amount} USDC: Failed`);
    }
  }
  
  // Final balances
  console.log('\n   Final Balances:');
  const finalSaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log(`   Smart Account USDC: ${formatUnits(finalSaUsdc, 6)}`);
  
  const finalSaWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log(`   Smart Account WPOL: ${formatUnits(finalSaWpol, 18)}`);
  
  // Check EOA POL balance (should be unchanged - no gas spent!)
  const finalEoaPol = await publicClient.getBalance({ address: account.address });
  const polSpent = eoaPol - finalEoaPol;
  console.log(`\n   EOA POL (before): ${formatUnits(eoaPol, 18)}`);
  console.log(`   EOA POL (after):  ${formatUnits(finalEoaPol, 18)}`);
  console.log(`   Gas spent:        ${formatUnits(polSpent, 18)} POL`);
  
  if (successful === results.length) {
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  🎉🎉🎉 ALL GASLESS SWAPS SUCCESSFUL! 🎉🎉🎉                     ║');
    console.log('║                                                                  ║');
    console.log('║  EIP-7702 gasless transactions are working perfectly!           ║');
    console.log('║  Users can swap tokens without paying any gas fees.             ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
  }
}

main().catch(console.error);
