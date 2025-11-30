/**
 * Comprehensive test of TRUE GASLESS transactions
 * Tests both Amoy and Sepolia
 */
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, encodeFunctionData, parseUnits, parseAbi, formatUnits } from 'viem';
import { polygonAmoy, sepolia } from 'viem/chains';

const PRIVATE_KEY = '0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04';
const GASLESS_API_URL = 'http://localhost:3002';

const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)'
]);

const CHAINS = {
  80002: {
    chain: polygonAmoy,
    name: 'Polygon Amoy',
    rpc: 'https://rpc-amoy.polygon.technology',
    token: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // USDC
    routerHub: '0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881'
  },
  11155111: {
    chain: sepolia,
    name: 'Ethereum Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC
    routerHub: '0x86D1AA2228F3ce649d415F19fC71134264D0E84B'
  }
};

async function testChain(chainId) {
  const config = CHAINS[chainId];
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🧪 Testing ${config.name} (${chainId})`);
  console.log(`${'='.repeat(50)}`);
  console.log(`   Address: ${account.address}`);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpc)
  });

  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpc)
  });

  // Check initial balance
  const initialBalance = await publicClient.getBalance({ address: account.address });
  console.log(`\n📊 Initial Balance: ${formatUnits(initialBalance, 18)} ${chainId === 80002 ? 'POL' : 'ETH'}`);

  // Step 1: Check Smart Account status
  console.log('\n1️⃣ Checking Smart Account status...');
  const checkResponse = await fetch(`${GASLESS_API_URL}/api/gasless/check/${account.address}/${chainId}`);
  const checkData = await checkResponse.json();
  
  if (!checkData.enabled) {
    console.log(`   ❌ Smart Account NOT enabled on ${config.name}`);
    console.log(`   Please enable Smart Account in MetaMask first`);
    return { success: false, chain: config.name, reason: 'Smart Account not enabled' };
  }
  console.log(`   ✅ Smart Account ENABLED`);
  console.log(`   Delegator: ${checkData.delegator}`);

  // Build approve call
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [config.routerHub, parseUnits('1', 6)]
  });

  // Step 2: Prepare UserOp
  console.log('\n2️⃣ Preparing gasless transaction...');
  const prepareResponse = await fetch(`${GASLESS_API_URL}/api/gasless/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: account.address,
      chainId,
      calls: [{
        to: config.token,
        data: approveData,
        value: '0'
      }]
    })
  });

  const prepareData = await prepareResponse.json();
  
  if (!prepareData.success) {
    console.log(`   ❌ Prepare failed: ${prepareData.error}`);
    return { success: false, chain: config.name, reason: prepareData.error };
  }
  console.log(`   ✅ UserOp prepared`);
  console.log(`   opId: ${prepareData.opId}`);

  // Step 3: Sign typed data (EIP-712)
  console.log('\n3️⃣ Signing EIP-712 typed data...');
  const { typedData } = prepareData;
  
  const signature = await walletClient.signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message
  });
  console.log(`   ✅ Signature obtained`);

  // Step 4: Submit to bundler
  console.log('\n4️⃣ Submitting to bundler...');
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
    console.log(`   ❌ Submit failed: ${submitData.error}`);
    return { success: false, chain: config.name, reason: submitData.error };
  }

  console.log(`\n🎉 GASLESS TRANSACTION SUCCESSFUL!`);
  console.log(`   TX Hash: ${submitData.txHash}`);
  console.log(`   Explorer: ${submitData.explorerUrl}`);

  // Check final balance
  const finalBalance = await publicClient.getBalance({ address: account.address });
  const gasPaid = initialBalance - finalBalance;
  
  console.log(`\n📊 Final Balance: ${formatUnits(finalBalance, 18)} ${chainId === 80002 ? 'POL' : 'ETH'}`);
  console.log(`   Gas Paid: ${formatUnits(gasPaid, 18)}`);
  
  const isGasless = gasPaid === 0n;
  if (isGasless) {
    console.log(`\n✅ TRUE GASLESS CONFIRMED! User paid $0 in gas!`);
  } else {
    console.log(`\n⚠️ Some gas was paid (unexpected)`);
  }

  return { 
    success: true, 
    chain: config.name, 
    txHash: submitData.txHash,
    gasless: isGasless
  };
}

async function runAllTests() {
  console.log('\n🚀 COMPREHENSIVE GASLESS TEST');
  console.log('Testing TRUE EIP-7702 gasless transactions on multiple chains\n');

  const results = [];

  // Test Amoy
  try {
    const amoyResult = await testChain(80002);
    results.push(amoyResult);
  } catch (error) {
    console.error('Amoy test error:', error.message);
    results.push({ success: false, chain: 'Polygon Amoy', reason: error.message });
  }

  // Test Sepolia
  try {
    const sepoliaResult = await testChain(11155111);
    results.push(sepoliaResult);
  } catch (error) {
    console.error('Sepolia test error:', error.message);
    results.push({ success: false, chain: 'Ethereum Sepolia', reason: error.message });
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(50));
  
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.chain}: SUCCESS ${result.gasless ? '(TRUE GASLESS!)' : ''}`);
      if (result.txHash) {
        console.log(`   TX: ${result.txHash}`);
      }
    } else {
      console.log(`❌ ${result.chain}: FAILED - ${result.reason}`);
    }
  }

  const allPassed = results.every(r => r.success && r.gasless);
  console.log('\n' + (allPassed ? '🎉 ALL TESTS PASSED! TRUE GASLESS WORKING!' : '⚠️ Some tests failed'));
}

runAllTests().catch(console.error);
