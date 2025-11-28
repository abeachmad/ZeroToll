/**
 * EIP-7702 Gasless Swap Test
 * 
 * Tests gasless swap using SimpleSmartAccount with Pimlico bundler
 * Swaps USDC -> WPOL on Polygon Amoy
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseUnits,
  encodeFunctionData,
  formatUnits,
  encodeAbiParameters,
  parseAbiParameters,
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

// Contract addresses on Polygon Amoy
const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const WPOL_ADDRESS = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9'; // WMATIC on Amoy
const ROUTER_HUB = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
const MOCK_DEX_ADAPTER = '0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1';

// ABIs
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
];

// RouterHub ABI with correct Intent struct types (uint64 for dstChainId and deadline)
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
  {
    name: 'whitelistedAdapter',
    type: 'function',
    inputs: [{ name: 'adapter', type: 'address' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'gaslessFeeBps',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'uint16' }],
    stateMutability: 'view',
  },
];

// MockDEXAdapter ABI
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
    outputs: [
      { type: 'uint256' },
      { type: 'address[]' },
    ],
    stateMutability: 'view',
  },
];

async function main() {
  console.log('🚀 EIP-7702 Gasless Swap Test\n');
  console.log('='.repeat(60));
  
  // Setup account
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 EOA Address:', account.address);
  
  // Create clients
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  // Check EOA balances
  console.log('\n📊 EOA Balances:');
  const eoaBalance = await publicClient.getBalance({ address: account.address });
  console.log('   POL:', formatUnits(eoaBalance, 18));
  
  const eoaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   USDC:', formatUnits(eoaUsdc, 6));
  
  // Check contract state
  console.log('\n🔍 Contract State:');
  const isWhitelisted = await publicClient.readContract({
    address: ROUTER_HUB,
    abi: ROUTER_HUB_ABI,
    functionName: 'whitelistedAdapter',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter whitelisted:', isWhitelisted);
  
  const feeBps = await publicClient.readContract({
    address: ROUTER_HUB,
    abi: ROUTER_HUB_ABI,
    functionName: 'gaslessFeeBps',
  });
  console.log('   Gasless fee BPS:', feeBps);
  
  // Check adapter liquidity
  const adapterWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter WPOL:', formatUnits(adapterWpol, 18));
  
  // Create Pimlico client
  console.log('\n🔧 Creating Pimlico Client...');
  const pimlicoClient = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(PIMLICO_URL),
  });
  
  // Check Pimlico availability
  try {
    const gasPrices = await pimlicoClient.getUserOperationGasPrice();
    console.log('✅ Pimlico available, gas prices:', {
      maxFeePerGas: gasPrices.fast.maxFeePerGas.toString(),
      maxPriorityFeePerGas: gasPrices.fast.maxPriorityFeePerGas.toString(),
    });
  } catch (e) {
    console.error('❌ Pimlico not available:', e.message);
    return;
  }
  
  // Create SimpleSmartAccount
  console.log('\n🔧 Creating Smart Account...');
  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: account,
    entryPoint: {
      address: ENTRY_POINT_V07,
      version: '0.7',
    },
  });
  
  console.log('✅ Smart Account:', smartAccount.address);
  
  // Check smart account balances
  console.log('\n📊 Smart Account Balances:');
  const saUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   USDC:', formatUnits(saUsdc, 6));
  
  const saWpol = await publicClient.readContract({
    address: WPOL_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   WPOL:', formatUnits(saWpol, 18));
  
  // Transfer USDC to smart account if needed
  const minUsdcNeeded = parseUnits('1', 6);
  if (saUsdc < minUsdcNeeded) {
    console.log('\n📤 Transferring 2 USDC to Smart Account...');
    
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [smartAccount.address, parseUnits('2', 6)],
    });
    
    const transferTx = await walletClient.sendTransaction({
      to: USDC_ADDRESS,
      data: transferData,
    });
    
    console.log('   TX:', transferTx);
    await publicClient.waitForTransactionReceipt({ hash: transferTx });
    console.log('✅ Transfer confirmed');
    
    // Update balance
    const newSaUsdc = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    console.log('   New USDC balance:', formatUnits(newSaUsdc, 6));
  }
  
  // Create smart account client
  console.log('\n🔧 Creating Smart Account Client...');
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
  console.log('✅ Smart Account Client created');
  
  // Step 1: Gasless Approval
  console.log('\n' + '='.repeat(60));
  console.log('📝 Step 1: Gasless USDC Approval');
  console.log('='.repeat(60));
  
  // Check current allowance
  const currentAllowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [smartAccount.address, ROUTER_HUB],
  });
  console.log('   Current allowance:', formatUnits(currentAllowance, 6));
  
  if (currentAllowance < parseUnits('1000', 6)) {
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, parseUnits('1000000', 6)],
    });
    
    try {
      console.log('🔄 Sending gasless approval...');
      const approvalTx = await smartAccountClient.sendTransaction({
        to: USDC_ADDRESS,
        data: approvalData,
        value: 0n,
      });
      
      console.log('✅ Approval TX:', approvalTx);
      console.log('🔗 https://amoy.polygonscan.com/tx/' + approvalTx);
      
      await publicClient.waitForTransactionReceipt({ hash: approvalTx });
      console.log('✅ Approval confirmed!');
      
      // Verify allowance
      const newAllowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [smartAccount.address, ROUTER_HUB],
      });
      console.log('   New allowance:', formatUnits(newAllowance, 6));
      
    } catch (error) {
      console.error('❌ Approval failed:', error.message);
      if (error.cause?.details) {
        console.error('   Details:', error.cause.details);
      }
      return;
    }
  } else {
    console.log('✅ Sufficient allowance already exists');
  }
  
  // Step 2: Get quote from adapter
  console.log('\n' + '='.repeat(60));
  console.log('📝 Step 2: Get Quote');
  console.log('='.repeat(60));
  
  const swapAmountIn = parseUnits('0.1', 6); // 0.1 USDC
  
  try {
    const [quoteOut, path] = await publicClient.readContract({
      address: MOCK_DEX_ADAPTER,
      abi: MOCK_DEX_ADAPTER_ABI,
      functionName: 'getQuote',
      args: [USDC_ADDRESS, WPOL_ADDRESS, swapAmountIn],
    });
    console.log('   Quote: 0.1 USDC ->', formatUnits(quoteOut, 18), 'WPOL');
    console.log('   Path:', path);
    
    // Use 95% of quote as minOut for slippage protection
    const minAmountOut = (quoteOut * 95n) / 100n;
    console.log('   Min out (95%):', formatUnits(minAmountOut, 18), 'WPOL');
    
    // Step 3: Gasless Swap
    console.log('\n' + '='.repeat(60));
    console.log('📝 Step 3: Gasless Swap (0.1 USDC -> WPOL)');
    console.log('='.repeat(60));
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 minutes
    
    // Build routeData for adapter.swap()
    // The adapter expects: swap(tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadline)
    // recipient should be RouterHub so it can handle the output
    const routeData = encodeFunctionData({
      abi: MOCK_DEX_ADAPTER_ABI,
      functionName: 'swap',
      args: [
        USDC_ADDRESS,
        WPOL_ADDRESS,
        swapAmountIn,
        minAmountOut,
        ROUTER_HUB, // RouterHub receives output, then transfers to user
        deadline,
      ],
    });
    
    // Build intent struct
    const intent = {
      user: smartAccount.address,
      tokenIn: USDC_ADDRESS,
      amtIn: swapAmountIn,
      tokenOut: WPOL_ADDRESS,
      minOut: minAmountOut,
      dstChainId: 80002,
      deadline: Number(deadline),
      feeToken: USDC_ADDRESS,
      feeMode: 1, // TOKEN_INPUT_SOURCE
      feeCapToken: parseUnits('0.01', 18),
      routeHint: '0x',
      nonce: BigInt(Date.now()),
    };
    
    console.log('Intent:', {
      user: intent.user,
      tokenIn: intent.tokenIn,
      amtIn: formatUnits(intent.amtIn, 6) + ' USDC',
      tokenOut: intent.tokenOut,
      minOut: formatUnits(intent.minOut, 18) + ' WPOL',
      dstChainId: intent.dstChainId,
      deadline: new Date(intent.deadline * 1000).toISOString(),
    });
    
    // Simulate first
    console.log('\n🔄 Simulating swap...');
    try {
      await publicClient.simulateContract({
        address: ROUTER_HUB,
        abi: ROUTER_HUB_ABI,
        functionName: 'executeRoute',
        args: [intent, MOCK_DEX_ADAPTER, routeData],
        account: smartAccount.address,
      });
      console.log('✅ Simulation successful!');
    } catch (simError) {
      console.error('❌ Simulation failed:', simError.message);
      
      // Try to decode the error
      if (simError.cause?.data) {
        console.error('   Error data:', simError.cause.data);
      }
      
      // Continue anyway to see actual error
      console.log('⚠️ Continuing with actual transaction...');
    }
    
    // Build swap calldata
    const swapData = encodeFunctionData({
      abi: ROUTER_HUB_ABI,
      functionName: 'executeRoute',
      args: [intent, MOCK_DEX_ADAPTER, routeData],
    });
    
    console.log('\n🔄 Sending gasless swap...');
    const swapTx = await smartAccountClient.sendTransaction({
      to: ROUTER_HUB,
      data: swapData,
      value: 0n,
    });
    
    console.log('✅ Swap TX:', swapTx);
    console.log('🔗 https://amoy.polygonscan.com/tx/' + swapTx);
    
    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });
    console.log('✅ Swap confirmed! Status:', receipt.status);
    
    // Check final balances
    console.log('\n📊 Final Balances:');
    const finalUsdc = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    console.log('   USDC:', formatUnits(finalUsdc, 6));
    
    const finalWpol = await publicClient.readContract({
      address: WPOL_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    console.log('   WPOL:', formatUnits(finalWpol, 18));
    
    console.log('\n🎉 GASLESS SWAP SUCCESSFUL!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause?.details) {
      console.error('   Details:', error.cause.details);
    }
    if (error.cause?.shortMessage) {
      console.error('   Short message:', error.cause.shortMessage);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
