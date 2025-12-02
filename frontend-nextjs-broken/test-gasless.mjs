#!/usr/bin/env node
/**
 * Test gasless transactions using Pimlico + Safe
 * 
 * Usage:
 *   node scripts/test-gasless.mjs [chain]
 * 
 * Where chain is: amoy | sepolia (default: amoy)
 * 
 * Prerequisites:
 *   - USDC tokens in the Safe account
 *   - Safe Account: 0x9D6009202Ee72d98d51C1bFe9914eCd7e50bF2e3
 */

import { 
  http, 
  createPublicClient,
  encodeFunctionData,
  parseAbi,
  formatUnits,
  formatEther,
} from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

// Configuration
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PRIVATE_KEY = process.env.TEST_PRIVATE_KEY || '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';

// Chain configs
const CHAINS = {
  amoy: {
    id: 80002,
    chain: polygonAmoy,
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
    explorer: 'https://amoy.polygonscan.com',
  },
  sepolia: {
    id: 11155111,
    chain: sepolia,
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    routerHub: '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84',
    explorer: 'https://sepolia.etherscan.io',
  },
};

// ERC20 ABI
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

async function main() {
  const chainName = process.argv[2] || 'amoy';
  const config = CHAINS[chainName];
  
  if (!config) {
    console.error('Invalid chain. Use: amoy | sepolia');
    process.exit(1);
  }
  
  console.log(`🚀 Testing Gasless on ${chainName.toUpperCase()}\n`);
  
  // Create owner account
  const owner = privateKeyToAccount(PRIVATE_KEY);
  console.log('👤 Owner EOA:', owner.address);
  
  // Create public client
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(),
  });
  
  // Check EOA balance
  const balance = await publicClient.getBalance({ address: owner.address });
  console.log('💰 EOA Balance:', formatEther(balance), config.chain.nativeCurrency.symbol);
  
  // Create Pimlico client
  const pimlicoUrl = `https://api.pimlico.io/v2/${config.id}/rpc?apikey=${PIMLICO_API_KEY}`;
  const pimlicoClient = createPimlicoClient({
    chain: config.chain,
    transport: http(pimlicoUrl),
  });
  
  // Check Pimlico
  console.log('\n🔍 Checking Pimlico...');
  try {
    const gasPrices = await pimlicoClient.getUserOperationGasPrice();
    console.log('✅ Pimlico available');
  } catch (e) {
    console.error('❌ Pimlico not available:', e.message);
    return;
  }
  
  // Create Safe account
  console.log('\n🔧 Creating Safe account...');
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    version: '1.4.1',
    entryPoint: { address: entryPoint07Address, version: '0.7' },
    saltNonce: 0n,
  });
  
  console.log('✅ Safe Address:', safeAccount.address);
  
  // Check Safe USDC balance
  const safeUsdc = await publicClient.readContract({
    address: config.usdc,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [safeAccount.address],
  });
  console.log('💰 Safe USDC:', formatUnits(safeUsdc, 6));
  
  if (safeUsdc === 0n) {
    console.log('\n⚠️ Safe has no USDC! Transfer some first.');
    console.log('   Safe Address:', safeAccount.address);
    return;
  }
  
  // Create smart account client
  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    chain: config.chain,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });
  
  // Send approval transaction
  console.log('\n📝 Sending gasless approval...');
  
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [config.routerHub, 1000000n], // 1 USDC
  });
  
  try {
    const txHash = await smartAccountClient.sendTransaction({
      to: config.usdc,
      value: 0n,
      data: approveData,
    });
    
    console.log('\n✅✅✅ SUCCESS! ✅✅✅');
    console.log('TX:', txHash);
    console.log(`View: ${config.explorer}/tx/${txHash}`);
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
  }
}

main().catch(console.error);
