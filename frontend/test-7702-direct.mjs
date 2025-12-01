/**
 * Test EIP-7702 with private key signer (keeps EOA address!)
 * Run with: node test-7702-direct.mjs
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
import { to7702SimpleSmartAccount } from 'permissionless/accounts';

// Configuration
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';

// Test on Amoy
const CHAIN_ID = 80002;
const chain = polygonAmoy;

// USDC on Amoy
const USDC_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
const ROUTER_HUB = '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84';

// ERC20 ABI
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

async function main() {
  console.log('🚀 Testing EIP-7702 with Private Key Signer\n');
  
  // 1. Create owner account from private key
  const owner = privateKeyToAccount(PRIVATE_KEY);
  console.log('👤 Owner EOA:', owner.address);
  
  // 2. Create public client
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });
  
  // Check EOA balance
  const balance = await publicClient.getBalance({ address: owner.address });
  console.log('💰 EOA Balance:', formatEther(balance), 'POL');
  
  // Check USDC balance in EOA
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner.address],
  });
  console.log('💵 EOA USDC:', formatUnits(usdcBalance, 6));
  
  // 3. Create Pimlico client
  const pimlicoUrl = `https://api.pimlico.io/v2/${CHAIN_ID}/rpc?apikey=${PIMLICO_API_KEY}`;
  
  const pimlicoClient = createPimlicoClient({
    chain,
    transport: http(pimlicoUrl),
  });
  
  // Check Pimlico is available
  console.log('\n🔍 Checking Pimlico availability...');
  try {
    const gasPrices = await pimlicoClient.getUserOperationGasPrice();
    console.log('✅ Pimlico available!');
  } catch (e) {
    console.error('❌ Pimlico not available:', e.message);
    return;
  }
  
  // 4. Create EIP-7702 smart account with private key owner
  console.log('\n🔧 Creating EIP-7702 smart account...');
  
  const smartAccount = await to7702SimpleSmartAccount({
    client: publicClient,
    owner: owner, // Private key account - can sign EIP-7702 authorizations!
  });
  
  console.log('✅ EIP-7702 Smart Account Address:', smartAccount.address);
  console.log('   (This should be SAME as EOA!)');
  
  // Verify it's the same address
  if (smartAccount.address.toLowerCase() === owner.address.toLowerCase()) {
    console.log('✅ CONFIRMED: Smart account uses EOA address!');
  } else {
    console.log('⚠️ WARNING: Different address!');
    console.log('   Smart Account:', smartAccount.address);
    console.log('   EOA:', owner.address);
  }
  
  // 5. Create smart account client with paymaster
  console.log('\n🔧 Creating smart account client...');
  
  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      },
    },
  });
  
  console.log('✅ Smart account client ready');
  
  // 6. Prepare approval transaction
  console.log('\n📝 Preparing approval transaction...');
  
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [ROUTER_HUB, 1000000n], // 1 USDC (6 decimals)
  });
  
  console.log('   Token:', USDC_ADDRESS);
  console.log('   Spender:', ROUTER_HUB);
  console.log('   Amount: 1 USDC');
  
  // 7. Send the transaction
  console.log('\n🚀 Sending gasless transaction...');
  
  try {
    const txHash = await smartAccountClient.sendTransaction({
      to: USDC_ADDRESS,
      value: 0n,
      data: approveData,
    });
    
    console.log('\n✅✅✅ SUCCESS! ✅✅✅');
    console.log('Transaction Hash:', txHash);
    console.log(`View on PolygonScan: https://amoy.polygonscan.com/tx/${txHash}`);
    console.log('\n🎉 EIP-7702 gasless transaction works!');
    console.log('   - Uses your EOA address directly');
    console.log('   - No need to transfer tokens anywhere');
    console.log('   - Zero gas fees!');
    
  } catch (error) {
    console.error('\n❌ Transaction failed:', error.message);
    
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

main().catch(console.error);
