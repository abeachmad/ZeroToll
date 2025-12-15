// Deploy Phase 2B: Treasury + RouterV3 with fee support
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const chainId = await hre.ethers.provider.getNetwork().then(n => n.chainId);
  
  console.log("=".repeat(60));
  console.log("PHASE 2B DEPLOYMENT: Treasury + RouterV3");
  console.log("=".repeat(60));
  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", chainId);
  console.log("Network:", hre.network.name);
  console.log("");

  // 1. Deploy Treasury
  console.log("1. Deploying ZeroTollTreasury...");
  const Treasury = await hre.ethers.getContractFactory("ZeroTollTreasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("   ✅ Treasury deployed:", treasuryAddress);

  // 2. Deploy RouterV3
  console.log("\n2. Deploying ZeroTollRouterV3...");
  const RouterV3 = await hre.ethers.getContractFactory("ZeroTollRouterV3");
  const routerV3 = await RouterV3.deploy();
  await routerV3.waitForDeployment();
  const routerV3Address = await routerV3.getAddress();
  console.log("   ✅ RouterV3 deployed:", routerV3Address);

  // 3. Configure Treasury
  console.log("\n3. Configuring Treasury...");
  const tx1 = await treasury.setCollector(routerV3Address, true);
  await tx1.wait();
  console.log("   ✅ RouterV3 authorized as fee collector");

  // 4. Configure RouterV3
  console.log("\n4. Configuring RouterV3...");
  const tx2 = await routerV3.setTreasury(treasuryAddress);
  await tx2.wait();
  console.log("   ✅ Treasury set in RouterV3");

  // Set gasless fee config: 1% max cap, enabled
  const tx3 = await routerV3.setGaslessFeeConfig(100, true);
  await tx3.wait();
  console.log("   ✅ Gasless fee config: max 1%, enabled");

  // Enable test mode for testnet
  const tx4 = await routerV3.setTestMode(true);
  await tx4.wait();
  console.log("   ✅ Test mode enabled");

  // 5. Get existing adapter addresses (from V2 deployment)
  const existingAdapters = {
    11155111: { // Sepolia
      primary: "0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa", // SmartDexAdapter
      fallback: "0x4E6A591459F0724E19f9B06A584B26fFB724a2a3", // ZeroTollAdapter
    },
    80002: { // Amoy
      primary: "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84", // SmartDexAdapter
      fallback: "0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87", // ZeroTollAdapter
    }
  };

  if (existingAdapters[chainId]) {
    console.log("\n5. Setting adapters from existing deployment...");
    const tx5 = await routerV3.setAdapters(
      existingAdapters[chainId].primary,
      existingAdapters[chainId].fallback
    );
    await tx5.wait();
    console.log("   ✅ Primary adapter:", existingAdapters[chainId].primary);
    console.log("   ✅ Fallback adapter:", existingAdapters[chainId].fallback);
  }

  // 6. Fund RouterV3 with test liquidity (zTokens)
  const zTokens = {
    11155111: {
      zUSDC: "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C",
      zETH: "0x8153FA09Be1689D44C343f119C829F6702A8720b",
      zPOL: "0x63c31C4247f6AA40B676478226d6FEB5707649D6",
      zLINK: "0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C",
    },
    80002: {
      zUSDC: "0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD",
      zETH: "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9",
      zPOL: "0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d",
      zLINK: "0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1",
    }
  };

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("");
  console.log("Contracts:");
  console.log(`  Treasury:  ${treasuryAddress}`);
  console.log(`  RouterV3:  ${routerV3Address}`);
  console.log("");
  console.log("Configuration:");
  console.log("  - RouterV3 authorized as Treasury collector");
  console.log("  - Treasury set in RouterV3");
  console.log("  - Gasless fee: max 1% cap, enabled");
  console.log("  - Test mode: enabled");
  console.log("");
  console.log("Next Steps:");
  console.log("  1. Fund RouterV3 with zToken liquidity for test swaps");
  console.log("  2. Update phase2-relayer.mjs with new RouterV3 address");
  console.log("  3. Update frontend to use new router");
  console.log("  4. Test gasless swap with fee collection");
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    chainId: Number(chainId),
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      treasury: treasuryAddress,
      routerV3: routerV3Address,
    },
    config: {
      maxGaslessFeePercent: 100, // 1%
      gaslessFeeEnabled: true,
      testMode: true,
    }
  };

  console.log("Deployment Info (JSON):");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
