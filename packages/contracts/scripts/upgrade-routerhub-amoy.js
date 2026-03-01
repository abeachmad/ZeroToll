const hre = require("hardhat");

async function main() {
  console.log("\n🚀 Upgrading RouterHub on Amoy...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  // Existing addresses
  const OLD_ROUTER_HUB = "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b";
  const MOCK_DEX_ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  // Deploy new RouterHub
  console.log("Deploying new RouterHub...");
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy({
    gasLimit: 3000000,
    gasPrice: hre.ethers.parseUnits('50', 'gwei')
  });
  await routerHub.waitForDeployment();
  
  const routerHubAddress = await routerHub.getAddress();
  console.log(`✅ New RouterHub deployed at: ${routerHubAddress}`);
  
  // Configure new RouterHub
  console.log("\nConfiguring new RouterHub...");
  
  console.log("1. Whitelisting MockDEXAdapter...");
  let tx = await routerHub.whitelistAdapter(MOCK_DEX_ADAPTER, true);
  await tx.wait();
  console.log("   ✅ Adapter whitelisted");
  
  console.log("2. Setting native wrapped (WMATIC)...");
  tx = await routerHub.setNativeWrapped(WMATIC);
  await tx.wait();
  console.log("   ✅ WMATIC set");
  
  console.log("\n" + "=".repeat(70));
  console.log("🎉 UPGRADE COMPLETE!");
  console.log("=".repeat(70));
  console.log(`Old RouterHub: ${OLD_ROUTER_HUB}`);
  console.log(`New RouterHub: ${routerHubAddress}`);
  console.log("\n⚠️  IMPORTANT: Update backend/frontend to use new address!");
  console.log("=".repeat(70));
  
  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: "amoy",
    timestamp: new Date().toISOString(),
    oldRouterHub: OLD_ROUTER_HUB,
    newRouterHub: routerHubAddress,
    mockDexAdapter: MOCK_DEX_ADAPTER,
    wmatic: WMATIC,
    deployer: deployer.address,
    bugFixed: "Transfer output to intent.user instead of msg.sender (relayer)"
  };
  
  fs.writeFileSync(
    `./deployments/amoy-routerhub-upgrade-${Date.now()}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("\n📄 Deployment info saved to deployments/ folder");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
