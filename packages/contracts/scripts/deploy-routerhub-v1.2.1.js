const hre = require("hardhat");

async function main() {
  console.log("Deploying RouterHub v1.2.1 (800k gas limit)...");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);

  // Deploy RouterHub
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy();
  await routerHub.waitForDeployment();
  const routerHubAddress = await routerHub.getAddress();

  console.log(`✅ RouterHub v1.2.1 deployed to: ${routerHubAddress}`);

  // Set wrapped native token (WETH on Sepolia)
  const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

  console.log("\nConfiguring wrapped native token...");
  const tx = await routerHub.setNativeWrapped(WETH_SEPOLIA);
  await tx.wait();
  console.log(`✅ Set WETH wrapper: ${WETH_SEPOLIA}`);

  // Whitelist adapter v7
  const ADAPTER_V7 = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  console.log(`\nWhitelisting adapter v7: ${ADAPTER_V7}...`);
  const whitelistTx = await routerHub.whitelistAdapter(ADAPTER_V7, true);
  await whitelistTx.wait();
  console.log(`✅ Adapter whitelisted`);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE - RouterHub v1.2.1 (800k gas)");
  console.log("=".repeat(60));
  console.log(`RouterHub: ${routerHubAddress}`);
  console.log(`Adapter v7: ${ADAPTER_V7}`);
  console.log("\nNext: Update backend/.env and test!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
