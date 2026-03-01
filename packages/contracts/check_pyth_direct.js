const hre = require("hardhat");

async function main() {
  console.log("\n🔍 Checking Pyth Network Directly on Amoy\n");
  
  const PYTH = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
  
  // Price feed IDs from oracle
  const USDC_FEED = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
  const POL_FEED = "0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472";
  
  const pythAbi = [
    "function getPriceUnsafe(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)",
    "function getPrice(bytes32 id) external view returns (int64 price, uint64 conf, int32 expo, uint256 publishTime)"
  ];
  
  const pyth = await hre.ethers.getContractAt(pythAbi, PYTH);
  
  console.log("Testing USDC feed...");
  try {
    const result = await pyth.getPriceUnsafe(USDC_FEED);
    console.log(`✅ USDC Price: ${result.price} (expo: ${result.expo})`);
    console.log(`   Published: ${new Date(Number(result.publishTime) * 1000).toISOString()}`);
  } catch (e) {
    console.log(`❌ USDC feed failed: ${e.message}`);
    if (e.data) console.log(`   Error data: ${e.data}`);
  }
  
  console.log("\nTesting POL feed...");
  try {
    const result = await pyth.getPriceUnsafe(POL_FEED);
    console.log(`✅ POL Price: ${result.price} (expo: ${result.expo})`);
    console.log(`   Published: ${new Date(Number(result.publishTime) * 1000).toISOString()}`);
  } catch (e) {
    console.log(`❌ POL feed failed: ${e.message}`);
    if (e.data) console.log(`   Error data: ${e.data}`);
  }
  
  console.log("\n");
}

main().catch(console.error);
