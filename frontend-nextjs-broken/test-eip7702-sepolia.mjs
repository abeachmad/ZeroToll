/**
 * EIP-7702 Gasless Swap Test - Ethereum Sepolia
 * 
 * Tests gasless swap using SimpleSmartAccount with Pimlico bundler
 * Swaps USDC -> WETH on Ethereum Sepolia
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
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Configuration
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PIMLICO_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Contract addresses on Ethereum Sepolia (from README)
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // Circle USDC on Sepolia
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'; // WETH on Sepolia
const ROUTER_HUB = '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84';
const MOCK_DEX_ADAPTER = '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';

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
  console.log('🚀 EIP-7702 Gasless Swap Test - ETHEREUM SEPOLIA\n');
  console.log('='.repeat(60));
  
  // Setup account
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 EOA Address:', account.address);
  
  // Create clients
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check EOA balances
  console.log('\n📊 EOA Balances:');
  const eoaBalance = await publicClient.getBalance({ address: account.address });
  console.log('   ETH:', formatUnits(eoaBalance, 18));
  
  const eoaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   USDC:', formatUnits(eoaUsdc, 6));
  
  const eoaWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   WETH:', formatUnits(eoaWeth, 18));
  
  // Check contract state
  console.log('\n🔍 Contract State:');
  try {
    const isWhitelisted = await publicClient.readContract({
      address: ROUTER_HUB,
      abi: ROUTER_HUB_ABI,
      functionName: 'whitelistedAdapter',
      args: [MOCK_DEX_ADAPTER],
    });
    console.log('   Adapter whitelisted:', isWhitelisted);
  } catch (e) {
    console.log('   ⚠️ Could not check adapter whitelist:', e.message);
  }
  
  // Check adapter liquidity
  console.log('\n💰 Adapter Liquidity:');
  const adapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter USDC:', formatUnits(adapterUsdc, 6));
  
  const adapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter WETH:', formatUnits(adapterWeth, 18));
  
  // Create Pimlico client
  console.log('\n🔧 Creating Pimlico Client...');
  const pimlicoClient = createPimlicoClient({
    chain: sepolia,
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
  
  const saWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   WETH:', formatUnits(saWeth, 18));
  
  // Transfer USDC to smart account GASLESSLY if needed
  const minUsdcNeeded = parseUnits('2', 6);
  if (saUsdc < minUsdcNeeded && eoaUsdc >= minUsdcNeeded) {
    console.log('\n📤 Transferring 5 USDC to Smart Account GASLESSLY...');
    console.log('   (EOA has no ETH, using gasless transfer via smart account)');
    
    // First, we need to approve the smart account to spend EOA's USDC
    // But we can't do that without ETH either...
    // 
    // Alternative: Use the smart account to pull USDC from EOA
    // But that requires EOA to approve smart account first...
    //
    // SOLUTION: Just transfer directly from EOA if it has ETH,
    // otherwise skip and check if smart account already has USDC
    
    if (eoaBalance > 0n) {
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [smartAccount.address, parseUnits('5', 6)],
      });
      
      const transferTx = await walletClient.sendTransaction({
        to: USDC_ADDRESS,
        data: transferData,
      });
      
      console.log('   TX:', transferTx);
      await publicClient.waitForTransactionReceipt({ hash: transferTx });
      console.log('✅ Transfer confirmed');
    } else {
      console.log('   ⚠️ EOA has no ETH for gas. Checking if we can proceed...');
      console.log('   Smart Account USDC:', formatUnits(saUsdc, 6));
      console.log('   EOA USDC:', formatUnits(eoaUsdc, 6));
      
      if (saUsdc < parseUnits('1', 6)) {
        console.log('\n❌ BLOCKER: Smart Account needs USDC but EOA has no ETH to transfer.');
        console.log('   Please fund EOA with Sepolia ETH from: https://sepoliafaucet.com');
        console.log('   Or manually send USDC to Smart Account:', smartAccount.address);
        return;
      }
    }
  }
  
  // Create smart account client
  console.log('\n🔧 Creating Smart Account Client...');
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: sepolia,
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
      console.log('🔗 https://sepolia.etherscan.io/tx/' + approvalTx);
      
      await publicClient.waitForTransactionReceipt({ hash: approvalTx });
      console.log('✅ Approval confirmed!');
      
    } catch (error) {
      console.error('❌ Approval failed:', error.message);
      return;
    }
  } else {
    console.log('✅ Sufficient allowance already exists');
  }
  
  // Step 2: Get quote from adapter
  console.log('\n' + '='.repeat(60));
  console.log('📝 Step 2: Get Quote');
  console.log('='.repeat(60));
  
  const swapAmountIn = parseUnits('1', 6); // 1 USDC
  
  try {
    const [quoteOut, path] = await publicClient.readContract({
      address: MOCK_DEX_ADAPTER,
      abi: MOCK_DEX_ADAPTER_ABI,
      functionName: 'getQuote',
      args: [USDC_ADDRESS, WETH_ADDRESS, swapAmountIn],
    });
    console.log('   Quote: 1 USDC ->', formatUnits(quoteOut, 18), 'WETH');
    
    const minAmountOut = (quoteOut * 95n) / 100n;
    console.log('   Min out (95%):', formatUnits(minAmountOut, 18), 'WETH');
    
    // Step 3: Gasless Swap
    console.log('\n' + '='.repeat(60));
    console.log('📝 Step 3: Gasless Swap (1 USDC -> WETH)');
    console.log('='.repeat(60));
    
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    
    const routeData = encodeFunctionData({
      abi: MOCK_DEX_ADAPTER_ABI,
      functionName: 'swap',
      args: [
        USDC_ADDRESS,
        WETH_ADDRESS,
        swapAmountIn,
        minAmountOut,
        ROUTER_HUB,
        deadline,
      ],
    });
    
    const intent = {
      user: smartAccount.address,
      tokenIn: USDC_ADDRESS,
      amtIn: swapAmountIn,
      tokenOut: WETH_ADDRESS,
      minOut: minAmountOut,
      dstChainId: 11155111,
      deadline: Number(deadline),
      feeToken: USDC_ADDRESS,
      feeMode: 1,
      feeCapToken: parseUnits('0.01', 18),
      routeHint: '0x',
      nonce: BigInt(Date.now()),
    };
    
    console.log('Intent:', {
      user: intent.user,
      tokenIn: intent.tokenIn,
      amtIn: formatUnits(intent.amtIn, 6) + ' USDC',
      tokenOut: intent.tokenOut,
      minOut: formatUnits(intent.minOut, 18) + ' WETH',
    });
    
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
    console.log('🔗 https://sepolia.etherscan.io/tx/' + swapTx);
    
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
    
    const finalWeth = await publicClient.readContract({
      address: WETH_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [smartAccount.address],
    });
    console.log('   WETH:', formatUnits(finalWeth, 18));
    
    console.log('\n🎉 GASLESS SWAP SUCCESSFUL ON SEPOLIA!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause?.details) {
      console.error('   Details:', error.cause.details);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
