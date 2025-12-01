/**
 * TRUE EIP-7702 Gasless Transaction using MetaMask Smart Accounts Kit
 * 
 * This uses the official MetaMask delegation framework to create
 * properly formatted UserOperations for gasless execution.
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits, toHex } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { toMetaMaskSmartAccount, getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';

// Configuration
const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';
const PIMLICO_API_KEY = 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

// Chain configs
const CHAINS = {
  amoy: {
    chain: polygonAmoy,
    chainId: 80002,
    rpc: 'https://rpc-amoy.polygon.technology',
    pimlicoRpc: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`,
    tokens: {
      USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      WMATIC: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9'
    },
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881'
  },
  sepolia: {
    chain: sepolia,
    chainId: 11155111,
    rpc: 'https://rpc.sepolia.org',
    pimlicoRpc: `https://api.pimlico.io/v2/11155111/rpc?apikey=${PIMLICO_API_KEY}`,
    tokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14'
    }
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
  console.log('MetaMask Smart Accounts Kit - TRUE GASLESS TEST');
  console.log('='.repeat(70));
  
  // Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('\n📍 Wallet Address:', account.address);
  
  // Use Amoy
  const chainConfig = CHAINS.amoy;
  console.log('🔗 Chain:', chainConfig.chain.name);
  
  // Create clients
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc)
  });
  
  // Step 1: Check if wallet has Smart Account code
  console.log('\n📋 Step 1: Checking Smart Account Status...');
  const code = await publicClient.getCode({ address: account.address });
  
  if (!code || !code.startsWith('0xef0100')) {
    console.log('❌ Wallet is not upgraded to Smart Account');
    return;
  }
  
  const delegator = '0x' + code.substring(8, 48);
  console.log('✅ Smart Account ENABLED');
  console.log('   Delegator:', delegator);
  
  // Step 2: Get Smart Accounts Environment
  console.log('\n📋 Step 2: Getting Smart Accounts Environment...');
  
  try {
    const environment = getSmartAccountsEnvironment(chainConfig.chainId);
    console.log('✅ Environment loaded');
    console.log('   Implementations:', Object.keys(environment.implementations || {}));
  } catch (e) {
    console.log('⚠️ Environment not found for chain:', chainConfig.chainId);
    console.log('   Error:', e.message);
    console.log('   Trying to proceed anyway...');
  }
  
  // Step 3: Create MetaMask Smart Account
  console.log('\n📋 Step 3: Creating MetaMask Smart Account...');
  
  try {
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: 'Stateless7702',
      address: account.address,
      signer: {
        walletClient
      }
    });
    
    console.log('✅ Smart Account created!');
    console.log('   Address:', smartAccount.address);
    console.log('   Type:', smartAccount.type);
    
    // Step 4: Create Bundler Client with Pimlico
    console.log('\n📋 Step 4: Creating Bundler Client...');
    
    const bundlerClient = createBundlerClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.pimlicoRpc),
      account: smartAccount
    });
    
    console.log('✅ Bundler client created');
    
    // Step 5: Prepare a simple call (approve USDC)
    console.log('\n📋 Step 5: Preparing Test Call...');
    
    const calls = [{
      to: chainConfig.tokens.USDC,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [chainConfig.routerHub, parseUnits('1', 6)]
      }),
      value: 0n
    }];
    
    console.log('   Call: Approve 1 USDC to RouterHub');
    
    // Step 6: Send UserOperation
    console.log('\n📋 Step 6: Sending UserOperation (GASLESS)...');
    
    const userOpHash = await bundlerClient.sendUserOperation({
      calls
    });
    
    console.log('✅ UserOperation sent!');
    console.log('   Hash:', userOpHash);
    
    // Step 7: Wait for receipt
    console.log('\n📋 Step 7: Waiting for confirmation...');
    
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 60000
    });
    
    console.log('✅ Transaction confirmed!');
    console.log('   TX Hash:', receipt.receipt.transactionHash);
    console.log('   Block:', receipt.receipt.blockNumber);
    console.log('   Success:', receipt.success);
    
    console.log('\n🎉 TRUE GASLESS TRANSACTION SUCCESSFUL!');
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    console.log('\nFull error:', error);
    
    // Try to understand the error
    if (error.message.includes('implementation')) {
      console.log('\n💡 The implementation type might be wrong.');
      console.log('   The delegator address is:', delegator);
      console.log('   Try checking what implementation this corresponds to.');
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
