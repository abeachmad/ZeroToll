const hre = require('hardhat');

/**
 * Configure Pyth oracle with correct token addresses
 */

async function main() {
  console.log('⚙️  Configuring Pyth oracle token mappings...\n');
  
  const PYTH_ORACLE = '0x88eb5eEACEF27C3B824fC891b4C37C819332d0b1';
  const WPOL = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
  const USDC = '0x642Ec30B4a41169770246d594621332eE60a28f0'; // Newly deployed
  
  // Official Pyth Price Feed IDs
  const PRICE_IDS = {
    POL_USD: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
    USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  };
  
  const oracle = await hre.ethers.getContractAt('MultiTokenPythOracle', PYTH_ORACLE);
  
  console.log('Setting price feeds:');
  console.log(`  WPOL: ${WPOL}`);
  console.log(`  USDC: ${USDC}`);
  console.log('');
  
  // Set WPOL
  console.log('1️⃣  Setting WPOL price feed...');
  const tx1 = await oracle.setPriceId(WPOL, PRICE_IDS.POL_USD);
  console.log('  Tx:', tx1.hash);
  await tx1.wait();
  console.log('  ✅ WPOL configured');
  console.log('');
  
  // Set USDC
  console.log('2️⃣  Setting USDC price feed...');
  const tx2 = await oracle.setPriceId(USDC, PRICE_IDS.USDC_USD);
  console.log('  Tx:', tx2.hash);
  await tx2.wait();
  console.log('  ✅ USDC configured');
  console.log('');
  
  // Test prices
  console.log('3️⃣  Testing prices...');
  try {
    const wpolPrice = await oracle.getPrice(WPOL);
    console.log(`  WPOL: $${(Number(wpolPrice) / 1e8).toFixed(4)}`);
    
    const usdcPrice = await oracle.getPrice(USDC);
    console.log(`  USDC: $${(Number(usdcPrice) / 1e8).toFixed(4)}`);
  } catch (error) {
    console.log('  ⚠️  Error:', error.message);
    console.log('  Pyth may need price updates - this is normal on testnet');
  }
  
  console.log('');
  console.log('✅ Configuration complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
