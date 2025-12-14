const hre = require("hardhat");

async function main() {
  const ROUTER = "0x577560699EF88e99f15d04df57c9552056d2a10D";
  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

  console.log("Deploying GaslessTestTokens...\n");

  const GaslessTestToken = await hre.ethers.getContractFactory("GaslessTestToken");
  
  // Deploy Token A
  const tokenA = await GaslessTestToken.deploy("ZeroToll Token A", "ZTA");
  await tokenA.waitForDeployment();
  const tokenAAddr = await tokenA.getAddress();
  console.log("Token A (ZTA):", tokenAAddr);

  // Deploy Token B
  const tokenB = await GaslessTestToken.deploy("ZeroToll Token B", "ZTB");
  await tokenB.waitForDeployment();
  const tokenBAddr = await tokenB.getAddress();
  console.log("Token B (ZTB):", tokenBAddr);

  // Wait for confirmations
  await tokenA.deploymentTransaction().wait(2);
  await tokenB.deploymentTransaction().wait(2);

  // Mint tokens to router for liquidity
  console.log("\nMinting liquidity to router...");
  const mintAmount = hre.ethers.parseEther("1000000"); // 1M tokens
  
  await (await tokenA.mint(ROUTER, mintAmount)).wait();
  await (await tokenB.mint(ROUTER, mintAmount)).wait();
  console.log("✓ Router funded with 1M of each token");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Token A (ZTA):", tokenAAddr);
  console.log("Token B (ZTB):", tokenBAddr);
  console.log("Router:", ROUTER);
  console.log("\nThese tokens support ERC-2612 Permit for gasless approvals!");
  console.log("Users can call faucet() to get free test tokens.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
