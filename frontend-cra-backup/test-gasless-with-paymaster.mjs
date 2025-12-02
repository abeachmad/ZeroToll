/**
 * TRUE EIP-7702 Gasless Transaction with Pimlico Paymaster
 * 
 * This uses:
 * 1. MetaMask Smart Accounts Kit for proper UserOp formatting
 * 2. Pimlico bundler for UserOp submission
 * 3. Pimlico paymaster for gas sponsorship
 */

import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits, formatUnits, toHex } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
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
  console.log('TRUE EIP-7702 GASLESS with Pimlico Paymaster');
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
  
  // Step 1: Check Smart Account status
  console.log('\n📋 Step 1: Checking Smart Account Status...');
  const code = await publicClient.getCode({ address: account.address });
  
  if (!code || !code.startsWith('0xef0100')) {
    console.log('❌ Wallet is not upgraded to Smart Account');
    return;
  }
  
  const delegator = '0x' + code.substring(8, 48);
  console.log('✅ Smart Account ENABLED');
  console.log('   Delegator:', delegator);
  
  // Step 2: Create MetaMask Smart Account
  console.log('\n📋 Step 2: Creating MetaMask Smart Account...');
  
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
  
  // Step 3: Create Pimlico client for paymaster
  console.log('\n📋 Step 3: Creating Pimlico Paymaster Client...');
  
  const pimlicoClient = createPimlicoClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.pimlicoRpc),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });
  
  console.log('✅ Pimlico client created');
  
  // Step 4: Create Bundler Client with paymaster
  console.log('\n📋 Step 4: Creating Bundler Client with Paymaster...');
  
  const bundlerClient = createBundlerClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.pimlicoRpc),
    account: smartAccount,
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      }
    }
  });
  
  console.log('✅ Bundler client created with paymaster');
  
  // Step 5: Prepare test call
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
  
  // Step 6: Check initial balance
  console.log('\n📋 Step 6: Checking Initial Balance...');
  const initialBalance = await publicClient.getBalance({ address: account.address });
  console.log('   Native Balance:', formatUnits(initialBalance, 18), 'POL');
  
  // Step 7: Send UserOperation (GASLESS!)
  console.log('\n📋 Step 7: Sending UserOperation (GASLESS)...');
  
  try {
    const userOpHash = await bundlerClient.sendUserOperation({
      calls
    });
    
    console.log('✅ UserOperation sent!');
    console.log('   Hash:', userOpHash);
    
    // Step 8: Wait for receipt
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
    console.log('   Native Balance:', formatUnits(finalBalance, 18), 'POL');
    
    const balanceDiff = initialBalance - finalBalance;
    console.log('   Balance Change:', formatUnits(balanceDiff, 18), 'POL');
    
    if (balanceDiff === 0n) {
      console.log('\n🎉🎉🎉 TRUE GASLESS TRANSACTION SUCCESSFUL! 🎉🎉🎉');
      console.log('   User paid $0 in gas fees!');
    } else {
      console.log('\n⚠️ Transaction succeeded but user paid gas');
      console.log('   This means paymaster did not sponsor');
    }
    
  } catch (error) {
    console.log('\n❌ Error:', error.message);
    
    // Try to understand the error
    if (error.details) {
      console.log('   Details:', error.details);
    }
    
    if (error.cause) {
      console.log('   Cause:', error.cause.message || error.cause);
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
