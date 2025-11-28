/**
 * Test script for EIP-7702 gasless transactions
 * Uses a local account (private key) which supports signAuthorization
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
import { to7702SimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Configuration
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const CHAIN_ID = 80002;
const PIMLICO_URL = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`;

// Contract addresses on Amoy
const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const WPOL_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
const ROUTER_HUB = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
const MOCK_DEX_ADAPTER = '0xc8a7e30e3ea68a2eaba3428acbf535f3320715d1';

// ERC20 ABI for approval and balance
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
];

// RouterHub ABI
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
          { name: 'dstChainId', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
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

async function main() {
  console.log('🚀 Starting EIP-7702 Gasless Transaction Test\n');
  
  // Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 Account address:', account.address);
  
  // Create public client
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology'),
  });
  
  // Check account balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('💰 POL Balance:', formatUnits(balance, 18), 'POL');
  
  // Check USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('💵 USDC Balance:', formatUnits(usdcBalance, 6), 'USDC');
  
  // Check if account has code (EIP-7702 delegation)
  const code = await publicClient.getCode({ address: account.address });
  console.log('📝 Account code:', code || '0x (fresh EOA)');
  
  const isDeployed = code && code !== '0x' && code.length > 2;
  console.log('🔍 Is deployed (has delegation):', isDeployed);
  
  // Create Pimlico client
  console.log('\n🔧 Creating Pimlico client...');
  const pimlicoClient = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(PIMLICO_URL),
  });
  
  // Check Pimlico availability
  try {
    const entryPoints = await pimlicoClient.request({
      method: 'eth_supportedEntryPoints',
      params: [],
    });
    console.log('✅ Pimlico available, entry points:', entryPoints);
  } catch (error) {
    console.error('❌ Pimlico not available:', error.message);
    return;
  }
  
  // Create EIP-7702 smart account
  console.log('\n🔧 Creating EIP-7702 smart account...');
  
  try {
    const smartAccount = await to7702SimpleSmartAccount({
      client: publicClient,
      owner: account,
    });
    
    console.log('✅ Smart account created:', smartAccount.address);
    console.log('📍 Smart account type:', smartAccount.type);
    
    // Create smart account client
    console.log('\n🔧 Creating smart account client...');
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
    
    console.log('✅ Smart account client created');
    
    // Check USDC allowance
    const allowance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, ROUTER_HUB],
    });
    console.log('\n💳 Current USDC allowance for RouterHub:', formatUnits(allowance, 6), 'USDC');
    
    // Test 1: Simple approval transaction
    console.log('\n📝 Test 1: Gasless USDC Approval');
    console.log('================================');
    
    const approvalAmount = parseUnits('1000000', 6); // 1M USDC
    const approvalData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, approvalAmount],
    });
    
    console.log('🔄 Sending gasless approval transaction...');
    
    try {
      const approvalTxHash = await smartAccountClient.sendTransaction({
        to: USDC_ADDRESS,
        data: approvalData,
        value: 0n,
      });
      
      console.log('✅ Approval transaction sent!');
      console.log('📝 Transaction hash:', approvalTxHash);
      console.log('🔗 Explorer:', `https://amoy.polygonscan.com/tx/${approvalTxHash}`);
      
      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
      console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
      
    } catch (error) {
      console.error('❌ Approval failed:', error.message);
      console.error('Full error:', error);
    }
    
    // Test 2: Swap transaction
    console.log('\n📝 Test 2: Gasless Swap (0.1 USDC -> WPOL)');
    console.log('==========================================');
    
    const swapAmountIn = parseUnits('0.1', 6); // 0.1 USDC
    const minAmountOut = parseUnits('0.00001', 18); // Very low min for testing
    
    const intent = {
      user: account.address,
      tokenIn: USDC_ADDRESS,
      amtIn: swapAmountIn,
      tokenOut: WPOL_ADDRESS,
      minOut: minAmountOut,
      dstChainId: BigInt(CHAIN_ID),
      deadline: BigInt(Math.floor(Date.now() / 1000) + 600), // 10 minutes
      feeToken: USDC_ADDRESS,
      feeMode: 1, // INPUT
      feeCapToken: parseUnits('0.01', 18),
      routeHint: '0x',
      nonce: BigInt(Date.now()),
    };
    
    const swapData = encodeFunctionData({
      abi: ROUTER_HUB_ABI,
      functionName: 'executeRoute',
      args: [
        [
          intent.user,
          intent.tokenIn,
          intent.amtIn,
          intent.tokenOut,
          intent.minOut,
          intent.dstChainId,
          intent.deadline,
          intent.feeToken,
          intent.feeMode,
          intent.feeCapToken,
          intent.routeHint,
          intent.nonce,
        ],
        MOCK_DEX_ADAPTER,
        '0x',
      ],
    });
    
    console.log('🔄 Sending gasless swap transaction...');
    console.log('📊 Swap details:', {
      amountIn: '0.1 USDC',
      tokenOut: 'WPOL',
      adapter: MOCK_DEX_ADAPTER,
    });
    
    try {
      const swapTxHash = await smartAccountClient.sendTransaction({
        to: ROUTER_HUB,
        data: swapData,
        value: 0n,
      });
      
      console.log('✅ Swap transaction sent!');
      console.log('📝 Transaction hash:', swapTxHash);
      console.log('🔗 Explorer:', `https://amoy.polygonscan.com/tx/${swapTxHash}`);
      
      // Wait for confirmation
      console.log('⏳ Waiting for confirmation...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash });
      console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
      
      // Check new balances
      const newUsdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      });
      console.log('💵 New USDC Balance:', formatUnits(newUsdcBalance, 6), 'USDC');
      
    } catch (error) {
      console.error('❌ Swap failed:', error.message);
      console.error('Full error:', error);
    }
    
  } catch (error) {
    console.error('❌ Failed to create smart account:', error.message);
    console.error('Full error:', error);
  }
  
  console.log('\n🏁 Test complete!');
}

main().catch(console.error);
