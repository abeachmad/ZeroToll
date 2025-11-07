const hre = require("hardhat");

async function main() {
  console.log("\n🚀 Upgrading RouterHub on Sepolia...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  // Existing addresses
  const OLD_ROUTER_HUB = "0x1449279761a3e6642B02E82A7be9E5234be00159";
  const MOCK_DEX_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";  // Correct checksum
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  
  // Deploy new RouterHub
  console.log("Deploying new RouterHub...");
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy({
    gasLimit: 3000000
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
  
  console.log("2. Setting native wrapped (WETH)...");
  tx = await routerHub.setNativeWrapped(WETH);
  await tx.wait();
  console.log("   ✅ WETH set");
  
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
    network: "sepolia",
    timestamp: new Date().toISOString(),
    oldRouterHub: OLD_ROUTER_HUB,
    newRouterHub: routerHubAddress,
    mockDexAdapter: MOCK_DEX_ADAPTER,
    weth: WETH,
    deployer: deployer.address,
    bugFixed: "Transfer output to intent.user instead of msg.sender (relayer)"
  };
  
  fs.writeFileSync(
    `./deployments/sepolia-routerhub-upgrade-${Date.now()}.json`,
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
