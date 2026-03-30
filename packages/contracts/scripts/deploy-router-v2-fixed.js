/**
 * Deploy ZeroTollRouterV2 with fixed permit handling
 * 
 * This version fixes the silent permit failure bug where:
 * - Old: try-catch swallowed permit errors, causing subsequent transferFrom to fail
 * - New: permit errors propagate properly, with allowance verification
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-router-v2-fixed.js --network sepolia
 *   npx hardhat run scripts/deploy-router-v2-fixed.js --network amoy
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  console.log(`\n🚀 Deploying ZeroTollRouterV2 (fixed) on ${network}...\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Deploy the router
  console.log("Deploying ZeroTollRouterV2...");
  const Router = await hre.ethers.getContractFactory("ZeroTollRouterV2");
  const router = await Router.deploy();
  await router.waitForDeployment();
  
  const routerAddress = await router.getAddress();
  console.log(`✅ ZeroTollRouterV2 deployed to: ${routerAddress}`);

  // Enable test mode
  console.log("\nEnabling test mode...");
  const testModeTx = await router.setTestMode(true);
  await testModeTx.wait();
  console.log("✅ Test mode enabled");

  // Save deployment info
  const deployment = {
    contract: "ZeroTollRouterV2",
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    address: routerAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    version: "2.1.0-fixed",
    changes: [
      "Fixed silent permit failure bug",
      "Permit errors now propagate properly",
      "Added allowance verification after permit"
    ]
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `zerotoll-router-v2-fixed-${network}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deployment, null, 2)
  );
  console.log(`\n📁 Deployment saved to: deployments/${filename}`);

  // Print update instructions
  console.log("\n" + "=".repeat(60));
  console.log("📝 UPDATE REQUIRED:");
  console.log("=".repeat(60));
  console.log("\n1. Update packages/shared-config/src/source-of-truth.json:");
  console.log(`   zeroTollRouterV3 / zeroTollRouter: '${routerAddress}'`);
  console.log("\n2. Run npm run sync:shared-config");
  console.log("\n3. Configure adapters:");
  console.log(`   npx hardhat run scripts/configure-router-adapters.js --network ${network}`);
  console.log("=".repeat(60));

  return routerAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
