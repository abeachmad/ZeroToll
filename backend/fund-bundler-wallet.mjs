/**
 * Fund the bundler wallet from relayer
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const RELAYER_KEY = process.env.RELAYER_PRIVATE_KEY;
const BUNDLER_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // From test mnemonic
const FUND_AMOUNT = parseEther('0.1'); // 0.1 ETH

const account = privateKeyToAccount(`0x${RELAYER_KEY}`);

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com')
});

async function main() {
  console.log('\n=== FUNDING BUNDLER WALLET ===');
  console.log('From:', account.address);
  console.log('To:', BUNDLER_WALLET);
  console.log('Amount:', formatEther(FUND_AMOUNT), 'ETH');

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Relayer Balance:', formatEther(balance), 'ETH');

  if (balance < FUND_AMOUNT) {
    console.log('ERROR: Insufficient balance');
    return;
  }

  console.log('\nSending...');
  const hash = await walletClient.sendTransaction({
    to: BUNDLER_WALLET,
    value: FUND_AMOUNT
  });

  console.log('Tx:', hash);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Status:', receipt.status);

  const newBalance = await publicClient.getBalance({ address: BUNDLER_WALLET });
  console.log('\n✅ Bundler wallet funded!');
  console.log('New Balance:', formatEther(newBalance), 'ETH');
}

main().catch(console.error);
