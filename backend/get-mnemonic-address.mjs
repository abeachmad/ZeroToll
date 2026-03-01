import { mnemonicToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.credentials' });

const mnemonic = process.env.BUNDLER_MNEMONIC;
if (!mnemonic) {
  console.error('Missing BUNDLER_MNEMONIC in .env or .env.credentials');
  process.exit(1);
}

const account = mnemonicToAccount(mnemonic);

console.log('=== BUNDLER WALLET FROM MNEMONIC ===');
console.log('Mnemonic: [HIDDEN]');
console.log('Address:', account.address);

// Check balances
const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const amoyClient = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology')
});

const sepoliaBalance = await sepoliaClient.getBalance({ address: account.address });
const amoyBalance = await amoyClient.getBalance({ address: account.address });

console.log('\nBalances:');
console.log('  Sepolia:', formatEther(sepoliaBalance), 'ETH');
console.log('  Amoy:', formatEther(amoyBalance), 'POL');

console.log('\n⚠️  Fund this address to run the bundler!');
