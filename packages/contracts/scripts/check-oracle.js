const hre = require("hardhat");

async function main() {
  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5");
  const oracle = await adapter.priceOracle();
  console.log("Sepolia MockDEXAdapter oracle:", oracle);
}

main().catch(console.error);
