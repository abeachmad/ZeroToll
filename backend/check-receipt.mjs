import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const receipt = await client.getTransactionReceipt({
  hash: '0x910e01f020129f5b5e313d4e7425fe1ee19464d5c35c6be6fb842d1d93abb3f6'
});

console.log('Receipt:');
console.log('  Status:', receipt.status);
console.log('  Block:', receipt.blockNumber);
console.log('  Gas Used:', receipt.gasUsed.toString());

// The address might be different - check what address the test mnemonic generates
import { mnemonicToAccount } from 'viem/accounts';
const account = mnemonicToAccount('test test test test test test test test test test test junk');
console.log('\nTest mnemonic address:', account.address);

const balance = await client.getBalance({ address: account.address });
console.log('Balance:', formatEther(balance), 'ETH');
