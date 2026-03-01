const hre = require("hardhat");

async function main() {
  console.log("Deploying RouterHub v1.2 with PUSH pattern...");

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying from: ${deployer.address}`);

  // Deploy RouterHub
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy();
  await routerHub.waitForDeployment();
  const routerHubAddress = await routerHub.getAddress();

  console.log(`✅ RouterHub v1.2 deployed to: ${routerHubAddress}`);

  // Set wrapped native token (WETH on Sepolia)
  const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

  console.log("\nConfiguring wrapped native token...");
  const tx = await routerHub.setNativeWrapped(WETH_SEPOLIA);
  await tx.wait();
  console.log(`✅ Set WETH wrapper: ${WETH_SEPOLIA}`);

  // Whitelist existing adapter v6
  const ADAPTER_V6 = "0xcf9f209DCED8181937E289E3D68f8B2cEB77A904";
  console.log(`\nWhitelisting adapter v6: ${ADAPTER_V6}...`);
  const whitelistTx = await routerHub.whitelistAdapter(ADAPTER_V6, true);
  await whitelistTx.wait();
  console.log(`✅ Adapter whitelisted`);

  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE - RouterHub v1.2 (PUSH PATTERN)");
  console.log("=".repeat(60));
  console.log(`RouterHub: ${routerHubAddress}`);
  console.log(`Adapter v6: ${ADAPTER_V6}`);
  console.log("\nNext steps:");
  console.log("1. Update backend/.env SEPOLIA_ROUTERHUB");
  console.log("2. Redeploy adapter v7 with push pattern");
  console.log("3. Test swap transaction");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
