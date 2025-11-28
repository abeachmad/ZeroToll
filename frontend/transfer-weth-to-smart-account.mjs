/**
 * Transfer WETH from EOA to Smart Account
 * 
 * Problem: EOA has WETH but no ETH for gas
 * Solution: Use EIP-7702 to upgrade EOA and do gasless transfer
 */

import { 
  createPublicClient, 
  http, 
  parseEther,
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
];

async function main() {
  console.log('🔧 Transfer WETH to Smart Account & Adapter\n');
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 EOA:', account.address);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
  });
  
  // Check balances
  console.log('   WETH Contract:', WETH_ADDRESS);
  const eoaWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   EOA WETH:', formatUnits(eoaWeth, 18));
  
  // Also check EOA ETH
  const eoaEth = await publicClient.getBalance({ address: account.address });
  console.log('   EOA ETH:', formatUnits(eoaEth, 18));
  
  // Check EOA USDC
  const eoaUsdc = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   EOA USDC:', formatUnits(eoaUsdc, 6));
  
  // Create Pimlico client
  const pimlicoClient = createPimlicoClient({
    chain: sepolia,
    transport: http(PIMLICO_URL),
  });
  
  // Create SimpleSmartAccount
  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner: account,
    entryPoint: {
      address: ENTRY_POINT_V07,
      version: '0.7',
    },
  });
  console.log('✅ Smart Account:', smartAccount.address);
  
  // Check smart account WETH
  const saWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [smartAccount.address],
  });
  console.log('   Smart Account WETH:', formatUnits(saWeth, 18));
  
  // Check adapter WETH
  const adapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('   Adapter WETH:', formatUnits(adapterWeth, 18));
  
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
  
  // If smart account has WETH, transfer to adapter
  if (saWeth >= parseEther('0.05')) {
    console.log('\n📤 Step 1: Transfer WETH from Smart Account to Adapter...');
    
    const transferAmount = parseEther('0.05');
    
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [MOCK_DEX_ADAPTER, transferAmount],
    });
    
    try {
      const tx = await smartAccountClient.sendTransaction({
        to: WETH_ADDRESS,
        data: transferData,
        value: 0n,
      });
      
      console.log('✅ TX:', tx);
      console.log('🔗 https://sepolia.etherscan.io/tx/' + tx);
      
      await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log('✅ Transfer to adapter confirmed!');
      
      // Check final adapter balance
      const finalAdapterWeth = await publicClient.readContract({
        address: WETH_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [MOCK_DEX_ADAPTER],
      });
      console.log('   Final Adapter WETH:', formatUnits(finalAdapterWeth, 18));
      
    } catch (error) {
      console.error('❌ Transfer failed:', error.message);
    }
  } else {
    console.log('\n⚠️ Smart Account has insufficient WETH:', formatUnits(saWeth, 18));
    console.log('\n📋 MANUAL STEPS NEEDED:');
    console.log('   1. Send WETH directly to Smart Account:', smartAccount.address);
    console.log('   2. Or get Sepolia ETH for EOA to pay gas');
    console.log('   3. Or use deployer wallet to fund adapter');
    console.log('\n   EOA has', formatUnits(eoaWeth, 18), 'WETH but no ETH for gas');
    console.log('   Smart Account address:', smartAccount.address);
  }
  
  console.log('\n🏁 Done');
}

main().catch(console.error);
