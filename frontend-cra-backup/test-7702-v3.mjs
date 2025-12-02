/**
 * Test EIP-7702 with EntryPoint 0.8 (required for EIP-7702)
 * Run with: node test-7702-v3.mjs
 */

import { 
  http, 
  createPublicClient,
  encodeFunctionData,
  parseAbi,
  formatUnits,
} from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint08Address } from 'viem/account-abstraction';

// Configuration
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';

// Test on Sepolia (better EIP-7702 support)
const CHAIN_ID = 11155111;
const chain = sepolia;

// USDC on Sepolia
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const ROUTER_HUB = '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84';

// ERC20 ABI
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

async function main() {
  console.log('🚀 Testing EIP-7702 with EntryPoint 0.8\n');
  
  // 1. Create owner account from private key
  const owner = privateKeyToAccount(PRIVATE_KEY);
  console.log('👤 Owner EOA:', owner.address);
  
  // 2. Create public client
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });
  
  // Check EOA USDC balance
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
  
  console.log('\n🔍 Checking Pimlico...');
  try {
    await pimlicoClient.getUserOperationGasPrice();
    console.log('✅ Pimlico available!');
  } catch (e) {
    console.error('❌ Pimlico not available:', e.message);
    return;
  }
  
  // 4. Create EIP-7702 SimpleSmartAccount with EntryPoint 0.8
  console.log('\n🔧 Creating EIP-7702 SimpleSmartAccount...');
  console.log('   Using EntryPoint 0.8:', entryPoint08Address);
  
  try {
    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: owner,
      eip7702: true, // This is the key flag!
      entryPoint: {
        address: entryPoint08Address,
        version: '0.8',
      },
    });
    
    console.log('✅ Smart Account Address:', smartAccount.address);
    console.log('   Owner EOA:', owner.address);
    
    // Verify same address
    if (smartAccount.address.toLowerCase() === owner.address.toLowerCase()) {
      console.log('✅ CONFIRMED: Uses EOA address directly!');
    } else {
      console.log('❌ ERROR: Different address!');
      return;
    }
    
    // 5. Create smart account client
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
    
    // 6. Send approval
    console.log('\n📝 Sending gasless approval...');
    
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_HUB, 1000000n],
    });
    
    const txHash = await smartAccountClient.sendTransaction({
      to: USDC_ADDRESS,
      value: 0n,
      data: approveData,
    });
    
    console.log('\n✅✅✅ SUCCESS! ✅✅✅');
    console.log('TX:', txHash);
    console.log(`View: https://sepolia.etherscan.io/tx/${txHash}`);
    console.log('\n🎉 EIP-7702 gasless works with EOA address!');
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    if (error.details) console.error('Details:', error.details);
    
    // Check if EntryPoint 0.8 is supported
    if (error.message?.includes('0.8') || error.message?.includes('entryPoint')) {
      console.log('\n💡 EntryPoint 0.8 may not be supported on this chain yet.');
      console.log('   Try using EntryPoint 0.7 with standard account instead.');
    }
  }
}

main().catch(console.error);
