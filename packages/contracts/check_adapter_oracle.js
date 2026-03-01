const hre = require("hardhat");

const ADAPTER = "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec";

async function main() {
  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
  const oracle = await adapter.priceOracle();
  console.log("Adapter:", ADAPTER);
  console.log("Oracle:", oracle);
  
  // Check if oracle matches MultiTokenPythOracle
  const expected = "0x14BfA9bdf75a2c8049C826B63EeEf6ED7F52E838";
  if (oracle.toLowerCase() === expected.toLowerCase()) {
    console.log("✅ Using NEW MultiTokenPythOracle!");
  } else {
    console.log("❌ Using OLD oracle!");
    console.log("Expected:", expected);
  }
}

main().catch(console.error);
