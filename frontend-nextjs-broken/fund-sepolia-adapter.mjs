/**
 * Fund Sepolia MockDEXAdapter with WETH
 * Uses deployer wallet to wrap ETH and send to adapter
 */

import { 
  createPublicClient, 
  createWalletClient,
  http, 
  parseEther,
  formatUnits,
  encodeFunctionData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

// Deployer private key (has ETH on Sepolia)
// NOTE: This is a testnet key with no real value
const DEPLOYER_PRIVATE_KEY = '0x' + process.env.DEPLOYER_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000';

// Contract addresses
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const MOCK_DEX_ADAPTER = '0x86D1AA2228F3ce649d415F19fC71134264D0E84B';

// WETH ABI
const WETH_ABI = [
  {
    name: 'deposit',
    type: 'function',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
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
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
];

async function main() {
  console.log('🔧 Fund Sepolia Adapter with WETH\n');
  
  if (!process.env.DEPLOYER_KEY) {
    console.log('❌ Please set DEPLOYER_KEY environment variable');
    console.log('   Usage: DEPLOYER_KEY=your_private_key node fund-sepolia-adapter.mjs');
    return;
  }
  
  const account = privateKeyToAccount('0x' + process.env.DEPLOYER_KEY);
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
  
  // Check balances
  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log('   ETH:', formatUnits(ethBalance, 18));
  
  const wethBalance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('   WETH:', formatUnits(wethBalance, 18));
  
  const adapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('\n💰 Adapter WETH:', formatUnits(adapterWeth, 18));
  
  // Wrap 0.1 ETH to WETH
  const wrapAmount = parseEther('0.1');
  console.log('\n🔄 Wrapping 0.1 ETH to WETH...');
  
  const wrapTx = await walletClient.sendTransaction({
    to: WETH_ADDRESS,
    value: wrapAmount,
    data: encodeFunctionData({
      abi: WETH_ABI,
      functionName: 'deposit',
    }),
  });
  
  console.log('   TX:', wrapTx);
  await publicClient.waitForTransactionReceipt({ hash: wrapTx });
  console.log('✅ Wrap confirmed');
  
  // Transfer WETH to adapter
  console.log('\n📤 Transferring 0.1 WETH to Adapter...');
  
  const transferTx = await walletClient.sendTransaction({
    to: WETH_ADDRESS,
    data: encodeFunctionData({
      abi: WETH_ABI,
      functionName: 'transfer',
      args: [MOCK_DEX_ADAPTER, wrapAmount],
    }),
  });
  
  console.log('   TX:', transferTx);
  await publicClient.waitForTransactionReceipt({ hash: transferTx });
  console.log('✅ Transfer confirmed');
  
  // Check final balance
  const finalAdapterWeth = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: WETH_ABI,
    functionName: 'balanceOf',
    args: [MOCK_DEX_ADAPTER],
  });
  console.log('\n💰 Final Adapter WETH:', formatUnits(finalAdapterWeth, 18));
  
  console.log('\n🎉 Adapter funded successfully!');
}

main().catch(console.error);
