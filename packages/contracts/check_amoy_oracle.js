const hre = require("hardhat");

async function main() {
  console.log("\n🔍 Checking Amoy Oracle Setup\n");
  
  const ORACLE_ADDR = "0x14BfA9bdf75a2c8049C826B63EeEf6ED7F52E838";
  const PYTH_AMOY = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
  
  const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  const oracle = await hre.ethers.getContractAt("MultiTokenPythOracle", ORACLE_ADDR);
  
  console.log("📋 Oracle Info:");
  console.log(`  Address: ${ORACLE_ADDR}`);
  
  try {
    const pythAddr = await oracle.pyth();
    console.log(`  Pyth Contract: ${pythAddr}`);
    console.log(`  Expected: ${PYTH_AMOY}`);
    console.log(`  Match: ${pythAddr.toLowerCase() === PYTH_AMOY.toLowerCase() ? '✅' : '❌'}`);
  } catch (e) {
    console.log(`  ❌ Error reading pyth(): ${e.message}`);
  }
  
  console.log("\n🔍 Checking Price Feeds:");
  
  // Check USDC
  try {
    const usdcFeed = await oracle.tokenToPriceFeed(USDC);
    console.log(`\n  USDC (${USDC}):`);
    console.log(`    Feed ID: ${usdcFeed}`);
    console.log(`    Configured: ${usdcFeed !== '0x' + '0'.repeat(64) ? '✅' : '❌'}`);
    
    if (usdcFeed !== '0x' + '0'.repeat(64)) {
      try {
        const price = await oracle.getPrice(USDC);
        console.log(`    Price: $${hre.ethers.formatUnits(price, 8)}`);
      } catch (e) {
        console.log(`    ❌ getPrice() failed: ${e.message}`);
        console.log(`    Error data: ${e.data}`);
      }
    }
  } catch (e) {
    console.log(`  ❌ Error checking USDC: ${e.message}`);
  }
  
  // Check WPOL
  try {
    const wpolFeed = await oracle.tokenToPriceFeed(WPOL);
    console.log(`\n  WPOL (${WPOL}):`);
    console.log(`    Feed ID: ${wpolFeed}`);
    console.log(`    Configured: ${wpolFeed !== '0x' + '0'.repeat(64) ? '✅' : '❌'}`);
    
    if (wpolFeed !== '0x' + '0'.repeat(64)) {
      try {
        const price = await oracle.getPrice(WPOL);
        console.log(`    Price: $${hre.ethers.formatUnits(price, 8)}`);
      } catch (e) {
        console.log(`    ❌ getPrice() failed: ${e.message}`);
        console.log(`    Error data: ${e.data}`);
      }
    }
  } catch (e) {
    console.log(`  ❌ Error checking WPOL: ${e.message}`);
  }
  
  console.log("\n");
}

main().catch(console.error);
