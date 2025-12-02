const hre = require("hardhat");

async function main() {
  const ROUTER_V2 = "0xd475255Ae38C92404f9740A19F93B8D2526A684b";

  console.log("Deploying UniswapV3Adapter...");

  const UniswapV3Adapter = await hre.ethers.getContractFactory("contracts/UniswapV3Adapter.sol:UniswapV3Adapter");
  const adapter = await UniswapV3Adapter.deploy();
  await adapter.waitForDeployment();

  const adapterAddress = await adapter.getAddress();
  console.log("UniswapV3Adapter deployed to:", adapterAddress);

  // Wait for confirmations
  console.log("\nWaiting for block confirmations...");
  await adapter.deploymentTransaction().wait(2);

  // Set adapter on router
  console.log("\nSetting adapter on ZeroTollRouterV2...");
  const router = await hre.ethers.getContractAt("ZeroTollRouterV2", ROUTER_V2);
  
  const tx = await router.setDexAdapter(adapterAddress);
  await tx.wait();
  console.log("Adapter set on router!");

  // Disable test mode
  console.log("\nDisabling test mode...");
  const tx2 = await router.setTestMode(false);
  await tx2.wait();
  console.log("Test mode disabled!");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("UniswapV3Adapter:", adapterAddress);
  console.log("ZeroTollRouterV2:", ROUTER_V2);
  console.log("Uniswap V3 Router:", "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
