/**
 * Test gasless transaction on Sepolia
 */
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';

async function testSepolia() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('Testing Sepolia with address:', account.address);

  // Step 1: Prepare
  console.log('\n1. Preparing UserOp on Sepolia...');
  const prepareResponse = await fetch('http://localhost:3002/api/gasless/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: account.address,
      chainId: 11155111, // Sepolia
      calls: [{
        to: account.address, // Self-transfer
        data: '0x',
        value: '0'
      }]
    })
  });

  const prepareData = await prepareResponse.json();
  
  if (!prepareData.success) {
    console.error('Prepare failed:', prepareData.error);
    return;
  }

  console.log('   opId:', prepareData.opId);

  // Step 2: Sign the typed data (EIP-712)
  console.log('\n2. Signing typed data...');
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http('https://ethereum-sepolia-rpc.publicnode.com')
  });

  const { typedData } = prepareData;
  
  const signature = await walletClient.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message
  });

  console.log('   Signature:', signature.substring(0, 40) + '...');

  // Step 3: Submit
  console.log('\n3. Submitting signed UserOp...');
  const submitResponse = await fetch('http://localhost:3002/api/gasless/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      opId: prepareData.opId,
      signature
    })
  });

  const submitData = await submitResponse.json();
  console.log('\nSepolia Result:', JSON.stringify(submitData, null, 2));
}

testSepolia().catch(console.error);
