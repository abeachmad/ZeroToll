const hre = require("hardhat");

async function main() {
  console.log("Deploying ZeroTollRouterV2...");

  const ZeroTollRouterV2 = await hre.ethers.getContractFactory("ZeroTollRouterV2");
  const router = await ZeroTollRouterV2.deploy();
  await router.waitForDeployment();

  const address = await router.getAddress();
  console.log("ZeroTollRouterV2 deployed to:", address);
  
  // Verify on Etherscan
  console.log("\nWaiting for block confirmations...");
  await router.deploymentTransaction().wait(3);
  
  console.log("\nVerifying on Etherscan...");
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: [],
    });
    console.log("Verified!");
  } catch (e) {
    console.log("Verification failed:", e.message);
  }

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Router V2:", address);
  console.log("Permit2:", "0x000000000022D473030F116dDEE9F6B43aC78BA3");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
