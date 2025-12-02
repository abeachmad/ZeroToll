/**
 * Fund Sepolia MockDEXAdapter with WETH using Deployer
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseEther,
  parseUnits,
  formatUnits,
  encodeFunctionData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Deployer private key
const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';

// Contract addresses
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const MOCK_DEX_ADAPTER = '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';
const SMART_ACCOUNT = '0xEef74EB6f5eA5f869115846E9771A8551f9e4323';

// ABIs
const WETH_ABI = [
  { name: 'deposit', type: 'function', inputs: [], outputs: [], stateMutability: 'payable' },
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const ERC20_ABI = [
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function main() {
  console.log('🔧 Fund Sepolia Adapter with WETH\n');
  
  const account = privateKeyToAccount(DEPLOYER_KEY);
  console.log('📍 Deployer:', account.address);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check deployer balances
  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log('   ETH:', formatUnits(ethBalance, 18));
  
  const wethBalance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   WETH:', formatUnits(wethBalance, 18));
  
  // Check adapter balances
  console.log('\n💰 Current Adapter Balances:');
  const adapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   WETH:', formatUnits(adapterWeth, 18));
  
  const adapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   USDC:', formatUnits(adapterUsdc, 6));
  
  // Step 1: Wrap 0.1 ETH to WETH
  const wrapAmount = parseEther('0.1');
  console.log('\n🔄 Step 1: Wrapping 0.1 ETH to WETH...');
  
  try {
    const wrapTx = await walletClient.sendTransaction({
      to: WETH_ADDRESS,
      value: wrapAmount,
    });
    
    console.log('   TX:', wrapTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + wrapTx);
    await publicClient.waitForTransactionReceipt({ hash: wrapTx });
    console.log('✅ Wrap confirmed');
  } catch (e) {
    console.error('❌ Wrap failed:', e.message);
    return;
  }
  
  // Check new WETH balance
  const newWethBalance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   Deployer WETH:', formatUnits(newWethBalance, 18));
  
  // Step 2: Transfer WETH to adapter
  console.log('\n📤 Step 2: Transferring 0.1 WETH to Adapter...');
  
  try {
    const transferData = encodeFunctionData({
      abi: WETH_ABI,
      functionName: 'transfer',
      args: [MOCK_DEX_ADAPTER, wrapAmount],
    });
    
    const transferTx = await walletClient.sendTransaction({
      to: WETH_ADDRESS,
      data: transferData,
    });
    
    console.log('   TX:', transferTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + transferTx);
    await publicClient.waitForTransactionReceipt({ hash: transferTx });
    console.log('✅ Transfer to adapter confirmed');
  } catch (e) {
    console.error('❌ Transfer failed:', e.message);
    return;
  }
  
  // Step 3: Also send some USDC to smart account for testing
  // First check if deployer has USDC
  const deployerUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('\n📊 Deployer USDC:', formatUnits(deployerUsdc, 6));
  
  // Check final adapter balance
  console.log('\n💰 Final Adapter Balances:');
  const finalAdapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   WETH:', formatUnits(finalAdapterWeth, 18));
  
  const finalAdapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   USDC:', formatUnits(finalAdapterUsdc, 6));
  
  console.log('\n🎉 Adapter funded successfully!');
  console.log('\n📋 Next: Run test-eip7702-sepolia.mjs to test gasless swaps');
}

main().catch(console.error);
