const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying RouterHub v1.1 (with SafeERC20 + forceApprove)\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy RouterHub
  console.log("📦 Deploying RouterHub...");
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy();
  await routerHub.waitForDeployment();
  
  const routerAddress = await routerHub.getAddress();
  console.log("✅ RouterHub v1.1 deployed to:", routerAddress);
  console.log("");

  // Set wrapped token for native (WETH on Sepolia)
  const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const NATIVE_MARKER = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  
  console.log("🔧 Configuring wrapped token...");
  console.log("  Setting NATIVE_MARKER →", WETH_SEPOLIA);
  const tx = await routerHub.setNativeWrapped(WETH_SEPOLIA);
  await tx.wait();
  console.log("  ✅ Wrapped token configured");
  console.log("");

  // Whitelist existing adapter
  const ADAPTER = "0xEE4BeDddFdCfD485AbF3fF5DaE5ab34071338e24";
  console.log("🔐 Whitelisting adapter:", ADAPTER);
  const whitelistTx = await routerHub.whitelistAdapter(ADAPTER, true);
  await whitelistTx.wait();
  console.log("  ✅ Adapter whitelisted");
  console.log("");

  console.log("📋 Summary:");
  console.log("  RouterHub v1.1:", routerAddress);
  console.log("  Adapter:", ADAPTER);
  console.log("  WETH:", WETH_SEPOLIA);
  console.log("");
  console.log("✨ Deployment complete!");
  console.log("   Update backend/frontend with new RouterHub address");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
