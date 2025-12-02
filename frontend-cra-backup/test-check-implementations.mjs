/**
 * Check available implementations in MetaMask Smart Accounts Kit
 */

import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit';
import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';

const WALLET_ADDRESS = '0x5a87A3c738cf99DB95787D51B627217B6dE12F62';

async function main() {
  console.log('='.repeat(70));
  console.log('Checking MetaMask Smart Accounts Implementations');
  console.log('='.repeat(70));
  
  // Check Amoy environment
  console.log('\n📋 Polygon Amoy (80002):');
  try {
    const env = getSmartAccountsEnvironment(80002);
    console.log('   Implementations:', JSON.stringify(env.implementations, null, 2));
    console.log('   DelegationManager:', env.delegationManager);
    console.log('   EntryPoint:', env.entryPoint);
  } catch (e) {
    console.log('   Error:', e.message);
  }
  
  // Check Sepolia environment
  console.log('\n📋 Sepolia (11155111):');
  try {
    const env = getSmartAccountsEnvironment(11155111);
    console.log('   Implementations:', JSON.stringify(env.implementations, null, 2));
    console.log('   DelegationManager:', env.delegationManager);
    console.log('   EntryPoint:', env.entryPoint);
  } catch (e) {
    console.log('   Error:', e.message);
  }
  
  // Check the wallet's delegator
  console.log('\n📋 Checking Wallet Delegator...');
  
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology')
  });
  
  const code = await publicClient.getCode({ address: WALLET_ADDRESS });
  const delegator = '0x' + code.substring(8, 48);
  
  console.log('   Wallet:', WALLET_ADDRESS);
  console.log('   Delegator:', delegator);
  
  // Check if delegator matches any known implementation
  const amoyEnv = getSmartAccountsEnvironment(80002);
  
  console.log('\n📋 Comparing with known implementations:');
  for (const [name, address] of Object.entries(amoyEnv.implementations)) {
    const match = address.toLowerCase() === delegator.toLowerCase();
    console.log(`   ${name}: ${address} ${match ? '✅ MATCH!' : ''}`);
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
