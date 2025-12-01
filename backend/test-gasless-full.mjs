/**
 * Full Gasless Transaction Test using @metamask/smart-accounts-kit
 * 
 * This test demonstrates TRUE gasless transactions using:
 * 1. MetaMask Smart Accounts Kit
 * 2. Pimlico as paymaster
 * 3. EIP-7702 upgraded EOA
 */

import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';
// Use the account that is already upgraded to Smart Account
const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';

const RPC_URL = 'https://rpc-amoy.polygon.technology';
const PIMLICO_RPC = `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`;

async function main() {
  console.log('🚀 Testing TRUE Gasless Transaction with MetaMask Smart Accounts Kit\n');

  // Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('📍 Account:', account.address);

  // Create public client
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(RPC_URL)
  });

  // Check if account is upgraded (EIP-7702)
  const code = await publicClient.getCode({ address: account.address });
  const isUpgraded = code && code.startsWith('0xef0100');
  
  if (!isUpgraded) {
    console.log('❌ Account is NOT upgraded to Smart Account');
    console.log('   Please enable Smart Account in MetaMask first');
    process.exit(1);
  }

  const delegator = '0x' + code.substring(8, 48);
  console.log('✅ Smart Account ENABLED');
  console.log('   Delegator:', delegator);

  // Get initial balance
  const initialBalance = await publicClient.getBalance({ address: account.address });
  console.log('💰 Initial Balance:', formatUnits(initialBalance, 18), 'POL');

  // Create wallet client
  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(RPC_URL)
  });

  // Create MetaMask Smart Account
  console.log('\n📦 Creating MetaMask Smart Account...');
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: account.address,
    signer: { account }  // Using account signer (private key)
  });

  console.log('✅ Smart Account created');
  console.log('   Address:', smartAccount.address);

  // Create Pimlico client
  console.log('\n🔧 Setting up Pimlico paymaster...');
  const pimlicoClient = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(PIMLICO_RPC),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });

  // Create bundler client with paymaster
  const bundlerClient = createBundlerClient({
    chain: polygonAmoy,
    transport: http(PIMLICO_RPC),
    account: smartAccount,
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      }
    }
  });

  console.log('✅ Bundler client created with Pimlico paymaster');

  // Prepare a simple test call (self-transfer of 0 POL)
  const calls = [
    {
      to: account.address,
      data: '0x',
      value: 0n
    }
  ];

  console.log('\n📤 Sending UserOperation...');
  console.log('   Calls:', calls.length);

  try {
    // Send UserOperation
    const userOpHash = await bundlerClient.sendUserOperation({
      calls
    });

    console.log('✅ UserOp submitted:', userOpHash);

    // Wait for receipt
    console.log('⏳ Waiting for confirmation...');
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
      timeout: 120000
    });

    console.log('\n🎉 Transaction confirmed!');
    console.log('   TX Hash:', receipt.receipt.transactionHash);
    console.log('   Success:', receipt.success);
    console.log('   Explorer:', `https://amoy.polygonscan.com/tx/${receipt.receipt.transactionHash}`);

    // Check final balance
    const finalBalance = await publicClient.getBalance({ address: account.address });
    const gasPaid = initialBalance - finalBalance;

    console.log('\n💰 Final Balance:', formatUnits(finalBalance, 18), 'POL');
    console.log('⛽ Gas Paid:', formatUnits(gasPaid, 18), 'POL');

    if (gasPaid === 0n) {
      console.log('\n🎉🎉🎉 TRUE GASLESS SUCCESS! User paid $0 in gas! 🎉🎉🎉');
    } else {
      console.log('\n⚠️ User paid gas. Paymaster may not have sponsored.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
  }
}

main().catch(console.error);
