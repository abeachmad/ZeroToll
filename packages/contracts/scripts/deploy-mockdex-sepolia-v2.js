const hre = require("hardhat");

async function main() {
  console.log("Deploying updated MockDEXAdapter to Sepolia...");
  console.log("=====================================");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  // Mock oracle address (0x1 is placeholder, adapter uses hardcoded prices)
  const mockOracleAddress = "0x0000000000000000000000000000000000000001";
  
  // Deploy MockDEXAdapter
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const adapter = await MockDEXAdapter.deploy(mockOracleAddress);
  await adapter.waitForDeployment();
  
  const adapterAddress = await adapter.getAddress();
  console.log("MockDEXAdapter deployed to:", adapterAddress);
  
  // Add supported tokens (WETH, USDC, LINK)
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
  
  console.log("\nAdding supported tokens...");
  
  // Wait a bit between transactions to avoid nonce issues
  await adapter.addSupportedToken(WETH);
  console.log("✅ WETH supported");
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await adapter.addSupportedToken(USDC);
  console.log("✅ USDC supported");
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await adapter.addSupportedToken(LINK);
  console.log("✅ LINK supported");
  
  // Fund adapter with USDC for swaps (owner needs to have USDC first)
  console.log("\n📋 To fund adapter with USDC for swaps, run:");
  console.log(`   npx hardhat run scripts/fund-adapter-sepolia.js --network sepolia`);
  
  // Whitelist in RouterHub
  const routerHubAddress = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
  console.log("\n📋 To whitelist adapter in RouterHub, run:");
  console.log(`   npx hardhat run scripts/whitelist-adapter-sepolia.js --network sepolia`);
  console.log(`   Or manually call: RouterHub.setAdapter("${adapterAddress}", true)`);
  
  console.log("\n✅ Deployment complete!");
  console.log("=====================================");
  console.log("Summary:");
  console.log("  MockDEXAdapter:", adapterAddress);
  console.log("  RouterHub:", routerHubAddress);
  console.log("  Prices synced with backend:");
  console.log("    WETH: $3709.35");
  console.log("    USDC: $1.00");
  console.log("    LINK: $23.45");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
