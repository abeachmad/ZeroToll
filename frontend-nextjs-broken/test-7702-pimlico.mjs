/**
 * Test EIP-7702 following Pimlico's exact guide
 * https://docs.pimlico.io/guides/eip7702
 */

import { 
  http, 
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  parseAbi,
  formatUnits,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { 
  createBundlerClient,
  createPaymasterClient,
} from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';

// Configuration
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';

// Test on Sepolia
const chain = sepolia;
const CHAIN_ID = chain.id;

// USDC on Sepolia
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const ROUTER_HUB = '0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84';

// ERC20 ABI
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

async function main() {
  console.log('🚀 Testing EIP-7702 (Pimlico Guide)\n');
  
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
    const gasPrices = await pimlicoClient.getUserOperationGasPrice();
    console.log('✅ Pimlico available!');
    console.log('   Gas prices:', gasPrices.fast.maxFeePerGas.toString());
  } catch (e) {
    console.error('❌ Pimlico not available:', e.message);
    return;
  }
  
  // 4. Create EIP-7702 smart account
  console.log('\n🔧 Creating EIP-7702 smart account...');
  
  try {
    // Use eip7702: true to enable EIP-7702 mode
    const smartAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner: owner,
      eip7702: true,
    });
    
    console.log('✅ Smart Account Address:', smartAccount.address);
    
    // Verify same address
    if (smartAccount.address.toLowerCase() === owner.address.toLowerCase()) {
      console.log('✅ Uses EOA address directly!');
    } else {
      console.log('❌ Different address - not EIP-7702!');
      return;
    }
    
    // 5. Create smart account client (from permissionless)
    console.log('\n🔧 Creating smart account client...');
    
    const { createSmartAccountClient } = await import('permissionless');
    
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
    
    // 6. Send transaction
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
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    if (error.details) console.error('Details:', error.details);
    if (error.cause) console.error('Cause:', error.cause?.message);
  }
}

main().catch(console.error);
