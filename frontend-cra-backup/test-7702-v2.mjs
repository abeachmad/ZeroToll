/**
 * Test EIP-7702 with correct signer setup
 * Run with: node test-7702-v2.mjs
 */

import { 
  http, 
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  parseAbi,
  formatUnits,
  formatEther,
} from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

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
  console.log('🚀 Testing EIP-7702 SimpleSmartAccount\n');
  
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
  
  // 4. Try SimpleSmartAccount (standard ERC-4337, not EIP-7702)
  console.log('\n🔧 Creating SimpleSmartAccount...');
  
  try {
    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: owner,
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });
    
    console.log('✅ Smart Account Address:', smartAccount.address);
    console.log('   Owner EOA:', owner.address);
    
    // Check if same address
    if (smartAccount.address.toLowerCase() === owner.address.toLowerCase()) {
      console.log('✅ SAME ADDRESS as EOA!');
    } else {
      console.log('⚠️ Different address (counterfactual)');
      
      // Check USDC balance in smart account
      const saUsdcBalance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [smartAccount.address],
      });
      console.log('💵 Smart Account USDC:', formatUnits(saUsdcBalance, 6));
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
    console.log(`View: https://amoy.polygonscan.com/tx/${txHash}`);
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    if (error.details) console.error('Details:', error.details);
  }
}

main().catch(console.error);
