const hre = require("hardhat");

async function main() {
  console.log("\n🔍 Checking Amoy Price Feed Configuration\n");
  
  const ORACLE_ADDR = "0x14BfA9bdf75a2c8049C826B63EeEf6ED7F52E838";
  const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  const oracle = await hre.ethers.getContractAt("MultiTokenPythOracle", ORACLE_ADDR);
  
  // Check USDC price feed
  const usdcPriceId = await oracle.tokenToPriceId(USDC);
  console.log(`USDC Price Feed ID:`);
  console.log(`  ${usdcPriceId}`);
  console.log(`  Configured: ${usdcPriceId !== '0x' + '0'.repeat(64) ? '✅' : '❌ NOT SET'}`);
  
  // Check WPOL price feed
  const wpolPriceId = await oracle.tokenToPriceId(WPOL);
  console.log(`\nWPOL Price Feed ID:`);
  console.log(`  ${wpolPriceId}`);
  console.log(`  Configured: ${wpolPriceId !== '0x' + '0'.repeat(64) ? '✅' : '❌ NOT SET'}`);
  
  // Try to get prices if configured
  if (usdcPriceId !== '0x' + '0'.repeat(64)) {
    try {
      const price = await oracle.getPrice(USDC);
      console.log(`\nUSDC Price: $${hre.ethers.formatUnits(price, 8)}`);
    } catch (e) {
      console.log(`\n❌ USDC getPrice() failed: ${e.message}`);
    }
  }
  
  if (wpolPriceId !== '0x' + '0'.repeat(64)) {
    try {
      const price = await oracle.getPrice(WPOL);
      console.log(`WPOL Price: $${hre.ethers.formatUnits(price, 8)}`);
    } catch (e) {
      console.log(`❌ WPOL getPrice() failed: ${e.message}`);
    }
  }
  
  console.log("\n");
}

main().catch(console.error);
