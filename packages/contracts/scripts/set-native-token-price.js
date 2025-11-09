const hre = require('hardhat');

/**
 * Set native token (address(0)) price in TestnetPriceOracle
 * This removes the hardcoded 2000 * 1e8 fallback in MockDEXAdapter
 */

async function main() {
  console.log('⚙️  Setting native token price in TestnetPriceOracle...\n');
  
  // Amoy TestnetPriceOracle
  const ORACLE_ADDRESS = '0xA4F18e08201949425B2330731782E4bba7FE1346';
  const NATIVE_TOKEN = '0x0000000000000000000000000000000000000000'; // address(0)
  
  // Native POL price on Amoy: $0.18 (same as WMATIC for consistency)
  const POL_PRICE = 18000000; // $0.18 in 8 decimals
  
  const oracle = await hre.ethers.getContractAt('TestnetPriceOracle', ORACLE_ADDRESS);
  
  console.log('Oracle:', ORACLE_ADDRESS);
  console.log('Native token (address(0)):', NATIVE_TOKEN);
  console.log('Price:', `$${(POL_PRICE / 1e8).toFixed(2)}`);
  console.log('');
  
  // Set price for native token
  console.log('🔧 Setting price for native POL...');
  const tx = await oracle.setPrice(NATIVE_TOKEN, POL_PRICE);
  console.log('  Tx:', tx.hash);
  await tx.wait();
  console.log('  ✅ Price set successfully!');
  console.log('');
  
  // Verify
  console.log('🧪 Verifying price...');
  const price = await oracle.getPrice(NATIVE_TOKEN);
  console.log(`  Native POL: $${(Number(price) / 1e8).toFixed(2)}`);
  console.log('');
  
  console.log('✅ Native token price configured!');
  console.log('🔄 Now MockDEXAdapter can swap native POL without hardcoded price');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
