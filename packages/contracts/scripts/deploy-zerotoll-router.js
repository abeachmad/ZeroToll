const hre = require("hardhat");

async function main() {
  console.log("Deploying ZeroTollRouter...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  const ZeroTollRouterV2 = await hre.ethers.getContractFactory("ZeroTollRouterV2");
  const router = await ZeroTollRouterV2.deploy();
  await router.waitForDeployment();

  const routerAddress = await router.getAddress();
  console.log("ZeroTollRouterV2 deployed to:", routerAddress);

  // Get chain info
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  console.log("Chain ID:", chainId);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    chainId: chainId.toString(),
    ZeroTollRouter: routerAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  const filename = `deployments/zerotoll-router-${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment saved to:", filename);

  // Verify on Etherscan (if not local)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await router.deploymentTransaction().wait(5);
    
    console.log("Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: routerAddress,
        constructorArguments: []
      });
      console.log("Contract verified!");
    } catch (e) {
      console.log("Verification failed:", e.message);
    }
  }

  return routerAddress;
}

main()
  .then((address) => {
    console.log("\n✅ Deployment complete!");
    console.log("Router address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
