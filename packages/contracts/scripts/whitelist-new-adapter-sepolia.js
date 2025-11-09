const hre = require("hardhat");

async function main() {
  console.log("Whitelisting new MockDEXAdapter in RouterHub (Sepolia)...");
  console.log("==========================================================");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const routerHubAddress = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
  const newAdapterAddress = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301";
  const oldAdapterAddress = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  
  // Load RouterHub ABI
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = RouterHub.attach(routerHubAddress);
  
  // Whitelist new adapter
  console.log("\nWhitelisting new adapter:", newAdapterAddress);
  const tx1 = await routerHub.whitelistAdapter(newAdapterAddress, true);
  await tx1.wait();
  console.log("✅ New adapter whitelisted!");
  
  // Optionally keep old adapter whitelisted too (for backward compat)
  const isOldWhitelisted = await routerHub.whitelistedAdapter(oldAdapterAddress);
  console.log("\nOld adapter status:", isOldWhitelisted ? "✅ Still whitelisted" : "❌ Not whitelisted");
  
  console.log("\n✅ Whitelist update complete!");
  console.log("New MockDEXAdapter is ready to use!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
