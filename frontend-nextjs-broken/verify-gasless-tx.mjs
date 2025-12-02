/**
 * Verify the gasless transaction
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { polygonAmoy } from 'viem/chains';

const TX_HASH = '0x3ee52bdebd2d2fc091cb6debec6e243839c0d02603864d05dc7763a388d151cf';
const WALLET = '0x5a87A3c738cf99DB95787D51B627217B6dE12F62';

async function main() {
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology')
  });
  
  console.log('='.repeat(60));
  console.log('Verifying Gasless Transaction');
  console.log('='.repeat(60));
  
  // Get transaction
  const tx = await publicClient.getTransaction({ hash: TX_HASH });
  console.log('\n📋 Transaction Details:');
  console.log('   Hash:', tx.hash);
  console.log('   From:', tx.from);
  console.log('   To:', tx.to);
  console.log('   Block:', tx.blockNumber);
  
  // Get receipt
  const receipt = await publicClient.getTransactionReceipt({ hash: TX_HASH });
  console.log('\n📋 Receipt:');
  console.log('   Status:', receipt.status);
  console.log('   Gas Used:', receipt.gasUsed.toString());
  console.log('   Effective Gas Price:', formatUnits(receipt.effectiveGasPrice, 9), 'gwei');
  
  // Calculate gas cost
  const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log('   Total Gas Cost:', formatUnits(gasCost, 18), 'POL');
  
  // Check who paid
  console.log('\n📋 Who Paid Gas?');
  console.log('   TX From:', tx.from);
  console.log('   Our Wallet:', WALLET);
  
  if (tx.from.toLowerCase() !== WALLET.toLowerCase()) {
    console.log('\n🎉 CONFIRMED: Gas was paid by BUNDLER, not user!');
    console.log('   Bundler Address:', tx.from);
  } else {
    console.log('\n⚠️ Gas was paid by user wallet');
  }
  
  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
