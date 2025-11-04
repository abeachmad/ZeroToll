// Quick deployment script for testing
const hre = require("hardhat");

async function main() {
  console.log("🚀 ZeroToll Quick Deploy");
  console.log("Network:", hre.network.name);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH/POL");
  
  // Deploy RouterHub
  console.log("\n📦 Deploying RouterHub...");
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy();
  await routerHub.waitForDeployment();
  console.log("✅ RouterHub:", await routerHub.getAddress());
  
  // Deploy FeeSink
  console.log("\n📦 Deploying FeeSink...");
  const FeeSink = await hre.ethers.getContractFactory("FeeSink");
  const vault = deployer.address; // Use deployer as vault for testing
  const treasury = deployer.address; // Use deployer as treasury for testing
  const feeSink = await FeeSink.deploy(vault, treasury);
  await feeSink.waitForDeployment();
  console.log("✅ FeeSink:", await feeSink.getAddress());
  
  // Set FeeSink in RouterHub
  console.log("\n⚙️  Configuring RouterHub...");
  await routerHub.setFeeSink(await feeSink.getAddress());
  console.log("✅ FeeSink set in RouterHub");
  
  // Set native wrapped address
  const wrappedAddress = hre.network.name === "amoy" 
    ? "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9" // WPOL
    : "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // WETH
  
  await routerHub.setNativeWrapped(wrappedAddress);
  console.log("✅ Native wrapped set:", wrappedAddress);
  
  // Summary
  console.log("\n📋 Deployment Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", hre.network.name);
  console.log("RouterHub:", await routerHub.getAddress());
  console.log("FeeSink:", await feeSink.getAddress());
  console.log("Wrapped Token:", wrappedAddress);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Save addresses
  const fs = require("fs");
  const addresses = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    routerHub: await routerHub.getAddress(),
    feeSink: await feeSink.getAddress(),
    wrappedToken: wrappedAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  
  const filename = `deployments/${hre.network.name}-${Date.now()}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(addresses, null, 2));
  console.log("\n💾 Addresses saved to:", filename);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
