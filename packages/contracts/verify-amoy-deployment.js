const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n✅ Verifying Amoy Deployment\n');
  
  const ORACLE = '0xB38C15BA6561caF0E7E1B0f3266Cf8473586129A';
  const ADAPTER = '0xF27e491EE3Ab6a87fa4b94854b90386f26Bd28f0';
  const USDC = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
  const WPOL = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
  
  const oracle = await hre.ethers.getContractAt('SimpleMockOracle', ORACLE);
  const adapter = await hre.ethers.getContractAt('MockDEXAdapter', ADAPTER);
  
  console.log('📋 Deployment Addresses:');
  console.log('  SimpleMockOracle:', ORACLE);
  console.log('  MockDEXAdapter:', ADAPTER);
  
  console.log('\n🔍 Verifying Oracle Prices:');
  const wpolPrice = await oracle.getPrice(WPOL);
  const usdcPrice = await oracle.getPrice(USDC);
  console.log('  WPOL:', hre.ethers.formatUnits(wpolPrice, 8), 'USD');
  console.log('  USDC:', hre.ethers.formatUnits(usdcPrice, 8), 'USD');
  
  console.log('\n🔍 Verifying Adapter:');
  const adapterOracle = await adapter.priceOracle();
  console.log('  Oracle address:', adapterOracle);
  console.log('  Oracle match:', adapterOracle === ORACLE ? '✅' : '❌');
  
  // Test quote
  console.log('\n🔍 Testing Quote:');
  const amountIn = hre.ethers.parseUnits('1', 18); // 1 WPOL
  try {
    const quote = await adapter.getQuote(WPOL, USDC, amountIn);
    console.log('  1 WPOL → USDC:');
    console.log('  Expected output:', hre.ethers.formatUnits(quote.amountOut, 6), 'USDC');
    console.log('  ✅ Quote successful!');
  } catch (e) {
    console.log('  ❌ Quote failed:', e.message);
  }
  
  // Save deployment info
  const deployment = {
    network: 'amoy',
    chainId: 80002,
    timestamp: new Date().toISOString(),
    contracts: {
      SimpleMockOracle: ORACLE,
      MockDEXAdapter: ADAPTER,
    },
    tokens: {
      USDC,
      WPOL,
    },
    prices: {
      WPOL: hre.ethers.formatUnits(wpolPrice, 8),
      USDC: hre.ethers.formatUnits(usdcPrice, 8),
    },
  };
  
  const filename = `amoy-mock-adapter-${Date.now()}.json`;
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deployment, null, 2)
  );
  
  console.log('\n✅ Verification complete!');
  console.log('  Saved to:', filename);
  console.log('\n🎯 Update backend config:');
  console.log(`  AMOY_ADAPTER = "${ADAPTER}"`);
  console.log('');
}

main().catch(console.error);
