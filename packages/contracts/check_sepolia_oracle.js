const hre = require("hardhat");

const ADAPTER = "0x3522D5F996a506374c33835a985Bf7ec775403B2";

async function main() {
  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
  const oracle = await adapter.priceOracle();
  console.log("Sepolia Adapter:", ADAPTER);
  console.log("Oracle:", oracle);
  
  const expected = "0x1240c97bc33f7635b8e25C721fF6D05d2bfC44Db";
  if (oracle.toLowerCase() === expected.toLowerCase()) {
    console.log("✅ Using NEW MultiTokenPythOracle!");
  } else {
    console.log("❌ Using OLD oracle!");
    console.log("Expected:", expected);
  }
}

main().catch(console.error);
