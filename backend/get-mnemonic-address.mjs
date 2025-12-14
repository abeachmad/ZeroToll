import { mnemonicToAccount } from 'viem/accounts';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia, polygonAmoy } from 'viem/chains';

const mnemonic = 'story object decorate advance fitness wrestle delay entire next crater test toddler';
const account = mnemonicToAccount(mnemonic);

console.log('=== BUNDLER WALLET FROM MNEMONIC ===');
console.log('Mnemonic:', mnemonic);
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
