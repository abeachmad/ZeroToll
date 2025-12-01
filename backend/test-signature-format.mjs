/**
 * Test to understand the exact signature format expected by MetaMask Smart Account
 */

import { createPublicClient, http, hashMessage, recoverAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit';
import dotenv from 'dotenv';

dotenv.config();

const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY || 'pim_SBVmcVZ3jZgcvmDWUSE6QR';

async function testSignatureFormat() {
  const privateKey = process.env.TEST_PRIVATE_KEY;
  if (!privateKey) {
    console.error('TEST_PRIVATE_KEY not set');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  console.log('Account:', account.address);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com')
  });

  // Create smart account
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Stateless7702,
    address: account.address,
    signer: { account }
  });

  console.log('Smart Account:', smartAccount.address);

  // Test signing a hash
  const testHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  
  // Sign using the account directly (what works)
  const directSig = await account.signMessage({ message: { raw: testHash } });
  console.log('\nDirect signMessage (personal_sign style):');
  console.log('  Signature:', directSig);
  
  // Recover to verify
  const recoveredFromDirect = await recoverAddress({
    hash: hashMessage({ raw: testHash }),
    signature: directSig
  });
  console.log('  Recovered:', recoveredFromDirect);
  console.log('  Matches:', recoveredFromDirect.toLowerCase() === account.address.toLowerCase());

  // Sign the raw hash without prefix (what eth_sign would do)
  const rawSig = await account.sign({ hash: testHash });
  console.log('\nRaw sign (eth_sign style):');
  console.log('  Signature:', rawSig);
  
  // Recover from raw
  const recoveredFromRaw = await recoverAddress({
    hash: testHash,
    signature: rawSig
  });
  console.log('  Recovered:', recoveredFromRaw);
  console.log('  Matches:', recoveredFromRaw.toLowerCase() === account.address.toLowerCase());

  // Check what the smart account's signUserOperation would produce
  // We need to understand if it uses personal_sign prefix or raw signing
  console.log('\n--- Smart Account Signature Analysis ---');
  console.log('The smart account uses ECDSA validation.');
  console.log('For Stateless7702, the signature should be a raw ECDSA signature over the userOpHash.');
  console.log('personal_sign adds a prefix, so the recovered address would be different.');
  console.log('\nSolution: The backend should sign the userOpHash using account.sign() (raw),');
  console.log('not account.signMessage() (which adds prefix).');
}

testSignatureFormat().catch(console.error);
