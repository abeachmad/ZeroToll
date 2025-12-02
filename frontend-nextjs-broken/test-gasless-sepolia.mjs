/**
 * GASLESS TEST ON SEPOLIA
 * 
 * Test EIP-7702 gasless transactions on Sepolia testnet
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

// Configuration
const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

const SEPOLIA_CONFIG = {
  chain: sepolia,
  chainId: 11155111,
  rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  pimlicoRpc: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
  tokens: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
  }
};

// ABIs
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }]
  }
];

async function main() {
  console.log('='.repeat(70));
  console.log('GASLESS TEST ON SEPOLIA');
  console.log('='.repeat(70));
  
  // Create account
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('\n📍 Wallet Address:', account.address);
  
  // Create clients
  const publicClient = createPublicClient({
    chain: SEPOLIA_CONFIG.chain,
    transport: http(SEPOLIA_CONFIG.rpc)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: SEPOLIA_CONFIG.chain,
    transport: http(SEPOLIA_CONFIG.rpc)
  });
  
  // Step 1: Check Smart Account on Sepolia
  console.log('\n📋 Step 1: Checking Smart Account on Sepolia...');
  const code = await publicClient.getCode({ address: account.address });
  
  if (!code || code === '0x') {
    console.log('❌ No Smart Account on Sepolia');
    console.log('   The wallet needs to be upgraded to Smart Account on Sepolia first');
    console.log('   This requires an EIP-7702 authorization transaction');
    
    // Check if we can upgrade
    console.log('\n📋 Attempting to upgrade to Smart Account...');
    
    // For Sepolia, we need to sign an authorization and submit it
    // This is a one-time operation
    
    return;
  }
  
  if (code.startsWith('0xef0100')) {
    const delegator = '0x' + code.substring(8, 48);
    console.log('✅ Smart Account ENABLED on Sepolia');
    console.log('   Delegator:', delegator);
  } else {
    console.log('⚠️ Has code but not EIP-7702 format');
    return;
  }
  
  // Step 2: Check balances
  console.log('\n📋 Step 2: Checking Balances...');
  
  const nativeBalance = await publicClient.getBalance({ address: account.address });
  console.log('   ETH:', formatUnits(nativeBalance, 18));
  
  // Step 3: Create Smart Account
  console.log('\n📋 Step 3: Creating Smart Account Instance...');
  
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: 'Stateless7702',
    address: account.address,
    signer: { walletClient }
  });
  
  console.log('✅ Smart Account ready');
  
  // Step 4: Create Pimlico client
  console.log('\n📋 Step 4: Creating Pimlico Client...');
  
  const pimlicoClient = createPimlicoClient({
    chain: SEPOLIA_CONFIG.chain,
    transport: http(SEPOLIA_CONFIG.pimlicoRpc),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });
  
  // Step 5: Create Bundler Client
  console.log('\n📋 Step 5: Creating Bundler Client...');
  
  const bundlerClient = createBundlerClient({
    chain: SEPOLIA_CONFIG.chain,
    transport: http(SEPOLIA_CONFIG.pimlicoRpc),
    account: smartAccount,
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      }
    }
  });
  
  console.log('✅ Bundler client ready');
  
  // Step 6: Build test call (simple ETH transfer to self)
  console.log('\n📋 Step 6: Building Test Call...');
  
  const calls = [{
    to: account.address, // Send to self
    data: '0x',
    value: 0n
  }];
  
  console.log('   Call: Self-transfer (0 ETH)');
  
  // Step 7: Send UserOperation
  console.log('\n📋 Step 7: Sending GASLESS UserOperation...');
  
  try {
    const userOpHash = await bundlerClient.sendUserOperation({ calls });
    
    console.log('✅ UserOperation sent!');
    console.log('   Hash:', userOpHash);
    
    // Step 8: Wait for confirmation
    console.log('\n📋 Step 8: Waiting for confirmation...');
    
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120000
    });
    
    console.log('✅ Transaction confirmed!');
    console.log('   TX Hash:', receipt.receipt.transactionHash);
    console.log('   Block:', receipt.receipt.blockNumber);
    console.log('   Success:', receipt.success);
    
    // Step 9: Check final balance
    console.log('\n📋 Step 9: Checking Final Balance...');
    const finalBalance = await publicClient.getBalance({ address: account.address });
    console.log('   ETH:', formatUnits(finalBalance, 18));
    
    const balanceChange = nativeBalance - finalBalance;
    console.log('   Change:', formatUnits(balanceChange, 18), 'ETH');
    
    if (balanceChange === 0n) {
      console.log('\n🎉🎉🎉 GASLESS TRANSACTION ON SEPOLIA SUCCESSFUL! 🎉🎉🎉');
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    if (error.details) {
      console.log('   Details:', error.details);
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
