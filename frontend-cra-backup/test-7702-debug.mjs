/**
 * Debug EIP-7702 authorization signing
 */

import { 
  http, 
  createPublicClient,
  encodeFunctionData,
  parseAbi,
  formatUnits,
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverAuthorizationAddress, hashAuthorization, signAuthorization } from 'viem/experimental';
import { entryPoint08Address } from 'viem/account-abstraction';

const PRIVATE_KEY = '0xf9e200b9438c68fb62cce9fe16d2d339559c560d21e492440df539cb0c42db6b';
const SIMPLE_ACCOUNT_IMPL = '0xe6Cae83BdE06E4c305530e199D7217f42808555B';

async function main() {
  console.log('🔍 Debug EIP-7702 Authorization Signing\n');
  
  const owner = privateKeyToAccount(PRIVATE_KEY);
  console.log('👤 Owner address:', owner.address);
  
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });
  
  // Get current nonce
  const nonce = await publicClient.getTransactionCount({ address: owner.address });
  console.log('📊 Current nonce:', nonce);
  
  // Create authorization
  const authorization = {
    address: SIMPLE_ACCOUNT_IMPL,
    chainId: sepolia.id,
    nonce: nonce,
  };
  
  console.log('\n📝 Authorization to sign:', authorization);
  
  // Sign authorization using the account's signAuthorization method
  try {
    const signedAuth = await owner.signAuthorization(authorization);
    
    console.log('\n✅ Signed authorization:', signedAuth);
    
    // Verify the signature
    const recoveredAddress = await recoverAuthorizationAddress({
      authorization: signedAuth,
    });
    
    console.log('\n🔍 Recovered address:', recoveredAddress);
    console.log('   Expected address:', owner.address);
    
    if (recoveredAddress.toLowerCase() === owner.address.toLowerCase()) {
      console.log('✅ MATCH! Authorization signature is valid.');
    } else {
      console.log('❌ MISMATCH! Something is wrong with the signing.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main().catch(console.error);
