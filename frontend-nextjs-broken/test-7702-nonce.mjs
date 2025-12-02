/**
 * Debug EIP-7702 nonce issue
 */

import { 
  http, 
  createPublicClient,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';

async function main() {
  const owner = privateKeyToAccount(PRIVATE_KEY);
  console.log('👤 Owner:', owner.address);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });
  
  // Get transaction count (nonce)
  const nonce = await publicClient.getTransactionCount({ address: owner.address });
  console.log('📊 Transaction nonce:', nonce);
  
  // Get code at address
  const code = await publicClient.getCode({ address: owner.address });
  console.log('📝 Code at address:', code ? code.substring(0, 50) + '...' : 'none');
  
  // Check if already delegated
  if (code && code.startsWith('0xef0100')) {
    console.log('✅ Already has EIP-7702 delegation!');
    const delegateTo = '0x' + code.substring(8, 48);
    console.log('   Delegated to:', delegateTo);
  } else if (code && code !== '0x') {
    console.log('⚠️ Has code but not EIP-7702 delegation');
  } else {
    console.log('📭 Fresh EOA - no code');
  }
}

main().catch(console.error);
