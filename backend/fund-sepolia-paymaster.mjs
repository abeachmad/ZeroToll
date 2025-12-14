/**
 * Fund Sepolia VerifyingPaymaster using relayer wallet
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';

config({ path: '../.env.credentials' });

const RELAYER_KEY = process.env.RELAYER_PRIVATE_KEY;
const PAYMASTER = '0xB9F49b6d8e7af756dE755C254683B4aAAaCF27cF';
const FUND_AMOUNT = parseEther('0.3'); // 0.3 ETH

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

const PAYMASTER_ABI = parseAbi([
  'function deposit() external payable',
  'function getDeposit() view returns (uint256)'
]);

async function main() {
  console.log('\n=== FUNDING SEPOLIA PAYMASTER ===');
  console.log('Funder:', account.address);
  console.log('Paymaster:', PAYMASTER);
  console.log('Amount:', formatEther(FUND_AMOUNT), 'ETH');

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('Funder Balance:', formatEther(balance), 'ETH');

  if (balance < FUND_AMOUNT) {
    console.log('ERROR: Insufficient balance');
    return;
  }

  console.log('\nSending deposit transaction...');
  const hash = await walletClient.writeContract({
    address: PAYMASTER,
    abi: PAYMASTER_ABI,
    functionName: 'deposit',
    value: FUND_AMOUNT
  });

  console.log('Tx:', hash);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('Status:', receipt.status);

  // Check new deposit
  const ENTRYPOINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
  const deposit = await publicClient.readContract({
    address: ENTRYPOINT,
    abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
    functionName: 'balanceOf',
    args: [PAYMASTER]
  });

  console.log('\n✅ Paymaster funded!');
  console.log('New Deposit:', formatEther(deposit), 'ETH');
}

main().catch(console.error);
