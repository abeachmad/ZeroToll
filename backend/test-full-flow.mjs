/**
 * Test the full gasless flow: prepare -> sign -> submit
 */
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';

const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';

async function test() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('Testing with address:', account.address);

  // Step 1: Prepare
  console.log('\n1. Preparing UserOp...');
  const prepareResponse = await fetch('http://localhost:3002/api/gasless/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: account.address,
      chainId: 80002,
      calls: [{
        to: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // USDC
        data: '0x095ea7b300000000000000000000000049ade5fbc18b1d2471e6001725c6ba3fe190488100000000000000000000000000000000000000000000000000000000000f4240',
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
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology')
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
  console.log('\nResult:', JSON.stringify(submitData, null, 2));
}

test().catch(console.error);
