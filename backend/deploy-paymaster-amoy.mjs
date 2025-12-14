/**
 * Deploy VerifyingPaymasterV07 to Amoy using relayer wallet
 */

import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config({ path: '.env' });
config({ path: '.env.credentials' });

const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';
const POLICY_SIGNER = '0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A';

const relayerAccount = privateKeyToAccount(`0x${process.env.RELAYER_PRIVATE_KEY}`);

const publicClient = createPublicClient({
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology')
});

const walletClient = createWalletClient({
  account: relayerAccount,
  chain: polygonAmoy,
  transport: http('https://rpc-amoy.polygon.technology')
});

async function main() {
  console.log('\n=== DEPLOYING VERIFYING PAYMASTER V07 TO AMOY ===');
  console.log('Deployer:', relayerAccount.address);
  
  const balance = await publicClient.getBalance({ address: relayerAccount.address });
  console.log('Balance:', formatEther(balance), 'POL');

  // Read compiled contract
  const artifact = JSON.parse(readFileSync('packages/contracts/artifacts/contracts/VerifyingPaymasterV07.sol/VerifyingPaymasterV07.json', 'utf8'));
  
  console.log('\nDeploying...');
  console.log('EntryPoint:', ENTRYPOINT_V07);
  console.log('Policy Signer:', POLICY_SIGNER);

  // Deploy
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [ENTRYPOINT_V07, POLICY_SIGNER]
  });

  console.log('Tx:', hash);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  console.log('\n✅ Deployed to:', receipt.contractAddress);
  console.log('\nAdd to .env:');
  console.log(`AMOY_VERIFYING_PAYMASTER=${receipt.contractAddress}`);
  
  // Fund the paymaster
  console.log('\nFunding paymaster with 2 POL...');
  const fundHash = await walletClient.writeContract({
    address: receipt.contractAddress,
    abi: artifact.abi,
    functionName: 'deposit',
    value: 2000000000000000000n // 2 POL
  });
  
  console.log('Fund Tx:', fundHash);
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log('✅ Funded!');
}

main().catch(console.error);
