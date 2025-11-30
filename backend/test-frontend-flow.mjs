/**
 * Test the frontend gasless flow
 * This simulates exactly what the frontend hook does
 */
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits, parseAbi } from 'viem';
import { polygonAmoy } from 'viem/chains';

const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';
const GASLESS_API_URL = 'http://localhost:3002';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)'
]);

async function testFrontendFlow() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log('🧪 Testing Frontend Gasless Flow');
  console.log('   Address:', account.address);
  console.log('   Chain: Polygon Amoy (80002)');

  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology')
  });

  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology')
  });

  // Check initial balance
  const initialBalance = await publicClient.getBalance({ address: account.address });
  console.log('\n📊 Initial POL Balance:', (Number(initialBalance) / 1e18).toFixed(6));

  // Build approve call (like frontend does)
  const tokenAddress = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'; // USDC
  const routerHub = '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881';
  const amount = parseUnits('1', 6); // 1 USDC

  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [routerHub, amount]
  });

  console.log('\n📋 Call Details:');
  console.log('   Token:', tokenAddress);
  console.log('   Spender:', routerHub);
  console.log('   Amount: 1 USDC');

  // Step 1: Check Smart Account status
  console.log('\n1️⃣ Checking Smart Account status...');
  const checkResponse = await fetch(`${GASLESS_API_URL}/api/gasless/check/${account.address}/80002`);
  const checkData = await checkResponse.json();
  
  if (!checkData.enabled) {
    console.error('❌ Smart Account not enabled!');
    return;
  }
  console.log('   ✅ Smart Account ENABLED');
  console.log('   Delegator:', checkData.delegator);

  // Step 2: Prepare UserOp
  console.log('\n2️⃣ Preparing gasless transaction...');
  const prepareResponse = await fetch(`${GASLESS_API_URL}/api/gasless/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: account.address,
      chainId: 80002,
      calls: [{
        to: tokenAddress,
        data: approveData,
        value: '0'
      }]
    })
  });

  const prepareData = await prepareResponse.json();
  
  if (!prepareData.success) {
    console.error('❌ Prepare failed:', prepareData.error);
    return;
  }
  console.log('   ✅ UserOp prepared');
  console.log('   opId:', prepareData.opId);

  // Step 3: Sign typed data (EIP-712)
  console.log('\n3️⃣ Signing EIP-712 typed data...');
  const { typedData } = prepareData;
  
  const signature = await walletClient.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message
  });
  console.log('   ✅ Signature obtained');
  console.log('   (This is what MetaMask shows - NO GAS POPUP!)');

  // Step 4: Submit to bundler
  console.log('\n4️⃣ Submitting to bundler (you pay $0)...');
  const submitResponse = await fetch(`${GASLESS_API_URL}/api/gasless/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      opId: prepareData.opId,
      signature
    })
  });

  const submitData = await submitResponse.json();
  
  if (!submitData.success) {
    console.error('❌ Submit failed:', submitData.error);
    return;
  }

  console.log('\n🎉 GASLESS TRANSACTION SUCCESSFUL!');
  console.log('   TX Hash:', submitData.txHash);
  console.log('   Explorer:', submitData.explorerUrl);

  // Check final balance
  const finalBalance = await publicClient.getBalance({ address: account.address });
  const gasPaid = initialBalance - finalBalance;
  
  console.log('\n📊 Final POL Balance:', (Number(finalBalance) / 1e18).toFixed(6));
  console.log('   Gas Paid:', (Number(gasPaid) / 1e18).toFixed(6), 'POL');
  
  if (gasPaid === 0n) {
    console.log('\n✅ TRUE GASLESS CONFIRMED! User paid $0 in gas!');
  } else {
    console.log('\n⚠️ Some gas was paid (this should not happen)');
  }
}

testFrontendFlow().catch(console.error);
