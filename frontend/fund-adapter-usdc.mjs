/**
 * Fund Sepolia Adapter with USDC from Deployer
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseUnits,
  formatUnits,
  encodeFunctionData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const MOCK_DEX_ADAPTER = '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';
const SMART_ACCOUNT = '0xEef74EB6f5eA5f869115846E9771A8551f9e4323';

const ERC20_ABI = [
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function main() {
  console.log('🔧 Fund Sepolia Adapter with USDC\n');
  
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  console.log('📍 Deployer:', deployer.address);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const walletClient = createWalletClient({
    account: deployer,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check deployer USDC
  const deployerUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [deployer.address],
  });
  console.log('   Deployer USDC:', formatUnits(deployerUsdc, 6));
  
  // Check adapter balances
  console.log('\n💰 Current Adapter Balances:');
  const adapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   USDC:', formatUnits(adapterUsdc, 6));
  
  const adapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   WETH:', formatUnits(adapterWeth, 18));
  
  // Transfer USDC to adapter (50 USDC)
  if (deployerUsdc > parseUnits('50', 6)) {
    console.log('\n📤 Transferring 50 USDC to Adapter...');
    
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [MOCK_DEX_ADAPTER, parseUnits('50', 6)],
    });
    
    const tx = await walletClient.sendTransaction({
      to: USDC_ADDRESS,
      data: transferData,
    });
    
    console.log('   TX:', tx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + tx);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('✅ USDC transferred to adapter');
  }
  
  // Also send some USDC to smart account for more testing
  const saUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ACCOUNT],
  });
  console.log('\n📊 Smart Account USDC:', formatUnits(saUsdc, 6));
  
  if (saUsdc < parseUnits('10', 6) && deployerUsdc > parseUnits('60', 6)) {
    console.log('\n📤 Transferring 10 USDC to Smart Account...');
    
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [SMART_ACCOUNT, parseUnits('10', 6)],
    });
    
    const tx = await walletClient.sendTransaction({
      to: USDC_ADDRESS,
      data: transferData,
    });
    
    console.log('   TX:', tx);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('✅ USDC transferred to smart account');
  }
  
  // Final balances
  console.log('\n💰 Final Balances:');
  const finalAdapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter USDC:', formatUnits(finalAdapterUsdc, 6));
  
  const finalAdapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter WETH:', formatUnits(finalAdapterWeth, 18));
  
  const finalSaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ACCOUNT],
  });
  console.log('   Smart Account USDC:', formatUnits(finalSaUsdc, 6));
  
  console.log('\n🎉 Funding complete!');
}

main().catch(console.error);
