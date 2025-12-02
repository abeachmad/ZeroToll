/**
 * Fund Sepolia Adapter Gaslessly
 * 
 * Strategy: Use smart account to transfer WETH from EOA to adapter
 * This requires EOA to first approve smart account (which needs gas)
 * 
 * Alternative: Transfer WETH directly from EOA to adapter using gasless
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
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PIMLICO_URL = `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const MOCK_DEX_ADAPTER = '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';

const ERC20_ABI = [
  { name: 'transfer', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'transferFrom', type: 'function', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function main() {
  console.log('🔧 Fund Sepolia Adapter Gaslessly\n');
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 EOA:', account.address);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check EOA balances
  const eoaWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   EOA WETH:', formatUnits(eoaWeth, 18));
  
  const eoaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   EOA USDC:', formatUnits(eoaUsdc, 6));
  
  // Check adapter balances
  const adapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('\n💰 Adapter WETH:', formatUnits(adapterWeth, 18));
  
  const adapterUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter USDC:', formatUnits(adapterUsdc, 6));
  
  // Create Pimlico client
  console.log('\n🔧 Creating Pimlico Client...');
  const pimlicoClient = createPimlicoClient({
    chain: sepolia,
    transport: http(PIMLICO_URL),
  });
  
  // Create SimpleSmartAccount
  console.log('🔧 Creating Smart Account...');
  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: account,
    entryPoint: {
      address: ENTRY_POINT_V07,
      version: '0.7',
    },
  });
  console.log('✅ Smart Account:', smartAccount.address);
  
  // Check if EOA has approved smart account to spend WETH
  const wethAllowance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, smartAccount.address],
  });
  console.log('\n📋 EOA WETH allowance for Smart Account:', formatUnits(wethAllowance, 18));
  
  // Create smart account client
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
  
  // Strategy: Transfer USDC from EOA to Smart Account first (gaslessly)
  // Then Smart Account can fund the adapter
  
  // But wait - we need EOA to approve smart account first, which needs gas!
  // 
  // Alternative: Just transfer USDC from EOA to adapter directly
  // But that also needs gas...
  //
  // SOLUTION: Use the smart account to transfer its own tokens to adapter
  // First, we need to get tokens TO the smart account
  
  // Check smart account balances
  const saWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('\n📊 Smart Account WETH:', formatUnits(saWeth, 18));
  
  const saUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   Smart Account USDC:', formatUnits(saUsdc, 6));
  
  // If smart account has WETH, transfer to adapter
  if (saWeth > 0n) {
    console.log('\n📤 Transferring WETH from Smart Account to Adapter...');
    
    const transferAmount = saWeth > parseEther('0.1') ? parseEther('0.1') : saWeth;
    
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [MOCK_DEX_ADAPTER, transferAmount],
    });
    
    const tx = await smartAccountClient.sendTransaction({
      to: WETH_ADDRESS,
      data: transferData,
      value: 0n,
    });
    
    console.log('✅ TX:', tx);
    console.log('🔗 https://sepolia.etherscan.io/tx/' + tx);
    
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('✅ Transfer confirmed!');
  } else {
    console.log('\n⚠️ Smart Account has no WETH to transfer.');
    console.log('   Need to first get WETH to smart account.');
    console.log('\n   Options:');
    console.log('   1. Send WETH directly to smart account:', smartAccount.address);
    console.log('   2. Use deployer to fund adapter directly');
    console.log('   3. Get Sepolia ETH for EOA to pay gas for transfer');
  }
  
  // If smart account has USDC, transfer to adapter
  if (saUsdc > 0n) {
    console.log('\n📤 Transferring USDC from Smart Account to Adapter...');
    
    const transferAmount = saUsdc > parseUnits('10', 6) ? parseUnits('10', 6) : saUsdc;
    
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [MOCK_DEX_ADAPTER, transferAmount],
    });
    
    const tx = await smartAccountClient.sendTransaction({
      to: USDC_ADDRESS,
      data: transferData,
      value: 0n,
    });
    
    console.log('✅ TX:', tx);
    console.log('🔗 https://sepolia.etherscan.io/tx/' + tx);
    
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log('✅ Transfer confirmed!');
  }
  
  console.log('\n🏁 Done');
}

main().catch(console.error);
