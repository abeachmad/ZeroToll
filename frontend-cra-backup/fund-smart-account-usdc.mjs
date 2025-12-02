/**
 * Fund Smart Account with USDC for testing
 * Uses deployer to send ETH to EOA, then EOA transfers USDC to smart account
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

// Keys
const DEPLOYER_KEY = '0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332';
const USER_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';

// Addresses
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const SMART_ACCOUNT = '0xEef74EB6f5eA5f869115846E9771A8551f9e4323';

const ERC20_ABI = [
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function main() {
  console.log('🔧 Fund Smart Account with USDC\n');
  
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  const user = privateKeyToAccount(USER_KEY);
  
  console.log('📍 Deployer:', deployer.address);
  console.log('📍 User EOA:', user.address);
  console.log('📍 Smart Account:', SMART_ACCOUNT);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const deployerWallet = createWalletClient({
    account: deployer,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  const userWallet = createWalletClient({
    account: user,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check balances
  console.log('\n📊 Current Balances:');
  const userEth = await publicClient.getBalance({ address: user.address });
  console.log('   User ETH:', formatUnits(userEth, 18));
  
  const userUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [user.address],
  });
  console.log('   User USDC:', formatUnits(userUsdc, 6));
  
  const saUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ACCOUNT],
  });
  console.log('   Smart Account USDC:', formatUnits(saUsdc, 6));
  
  // Step 1: Send ETH from deployer to user (for gas)
  if (userEth < parseEther('0.01')) {
    console.log('\n📤 Step 1: Sending 0.05 ETH from Deployer to User...');
    
    const sendEthTx = await deployerWallet.sendTransaction({
      to: user.address,
      value: parseEther('0.05'),
    });
    
    console.log('   TX:', sendEthTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + sendEthTx);
    await publicClient.waitForTransactionReceipt({ hash: sendEthTx });
    console.log('✅ ETH sent to user');
  } else {
    console.log('\n✅ User already has ETH for gas');
  }
  
  // Step 2: Transfer USDC from user to smart account
  if (userUsdc > 0n && saUsdc < parseUnits('5', 6)) {
    console.log('\n📤 Step 2: Transferring 5 USDC from User to Smart Account...');
    
    const transferAmount = parseUnits('5', 6);
    
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [SMART_ACCOUNT, transferAmount],
    });
    
    const transferTx = await userWallet.sendTransaction({
      to: USDC_ADDRESS,
      data: transferData,
    });
    
    console.log('   TX:', transferTx);
    console.log('   🔗 https://sepolia.etherscan.io/tx/' + transferTx);
    await publicClient.waitForTransactionReceipt({ hash: transferTx });
    console.log('✅ USDC transferred to smart account');
  } else if (saUsdc >= parseUnits('5', 6)) {
    console.log('\n✅ Smart Account already has sufficient USDC');
  } else {
    console.log('\n⚠️ User has no USDC to transfer');
  }
  
  // Check final balances
  console.log('\n💰 Final Balances:');
  const finalUserEth = await publicClient.getBalance({ address: user.address });
  console.log('   User ETH:', formatUnits(finalUserEth, 18));
  
  const finalUserUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [user.address],
  });
  console.log('   User USDC:', formatUnits(finalUserUsdc, 6));
  
  const finalSaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [SMART_ACCOUNT],
  });
  console.log('   Smart Account USDC:', formatUnits(finalSaUsdc, 6));
  
  console.log('\n🎉 Smart Account funded!');
  console.log('\n📋 Next: Run test-eip7702-sepolia.mjs to test gasless swaps');
}

main().catch(console.error);
