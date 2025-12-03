const hre = require("hardhat");

async function main() {
  const address = "0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD";
  console.log("Checking zUSDC at:", address);
  
  const token = await hre.ethers.getContractAt("ZeroTollToken", address);
  
  console.log("Symbol:", await token.symbol());
  console.log("Decimals:", await token.decimals());
  console.log("Total Supply:", (await token.totalSupply()).toString());
  console.log("Max Supply:", (await token.maxSupply()).toString());
  
  // Check if faucet would work
  const [signer] = await hre.ethers.getSigners();
  console.log("\nSigner:", signer.address);
  
  // Try to estimate gas for faucet
  try {
    const gasEstimate = await token.faucet.estimateGas();
    console.log("Gas estimate for faucet():", gasEstimate.toString());
  } catch (e) {
    console.log("Gas estimation failed:", e.message);
  }
}

main().catch(console.error);
