/**
 * Configure ZeroTollRouterV2 with adapter fallback chain
 * 
 * Usage:
 *   npx hardhat run scripts/configure-router-adapters.js --network sepolia
 *   npx hardhat run scripts/configure-router-adapters.js --network amoy
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Contract addresses from deployments (updated Dec 4, 2025 - V2 with decimal conversion fix)
const ROUTER_ADDRESSES = {
  sepolia: "0x577560699EF88e99f15d04df57c9552056d2a10D",
  amoy: "0xc75df1943d6EFE04b422b9bB45509782609Fc67a"
};

const SMART_DEX_ADAPTER = {
  sepolia: "0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa",
  amoy: "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84"
};

// Load ZeroTollAdapter addresses from latest deployment
function getZeroTollAdapterAddress(network) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith(`ztokens-${network}-`))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    throw new Error(`No zTokens deployment found for ${network}`);
  }
  
  const deployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, files[0]), "utf8")
  );
  
  return deployment.adapter;
}

async function main() {
  const network = hre.network.name;
  console.log(`\n⚙️ Configuring ZeroTollRouterV2 adapters on ${network}...\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const routerAddress = ROUTER_ADDRESSES[network];
  if (!routerAddress) {
    throw new Error(`No router address configured for ${network}`);
  }
  console.log(`Router: ${routerAddress}`);

  const primaryAdapter = SMART_DEX_ADAPTER[network];
  console.log(`Primary Adapter (SmartDex): ${primaryAdapter}`);

  const fallbackAdapter = getZeroTollAdapterAddress(network);
  console.log(`Fallback Adapter (ZeroToll): ${fallbackAdapter}`);

  // Get router contract
  const router = await hre.ethers.getContractAt("ZeroTollRouterV2", routerAddress);

  // Check current configuration
  console.log("\n📋 Current configuration:");
  try {
    const currentPrimary = await router.primaryAdapter();
    const currentFallback = await router.fallbackAdapter();
    const currentLegacy = await router.dexAdapter();
    console.log(`  Primary: ${currentPrimary}`);
    console.log(`  Fallback: ${currentFallback}`);
    console.log(`  Legacy: ${currentLegacy}`);
  } catch (e) {
    console.log("  (New fields not yet deployed - need to redeploy router)");
  }

  // Configure adapters
  console.log("\n🔧 Setting adapters...");
  
  try {
    const tx = await router.setAdapters(primaryAdapter, fallbackAdapter);
    console.log(`  Transaction: ${tx.hash}`);
    await tx.wait();
    console.log("  ✅ Adapters configured!");
  } catch (e) {
    if (e.message.includes("setAdapters")) {
      console.log("  ⚠️ setAdapters function not found - router needs redeployment");
      console.log("  Falling back to setDexAdapter...");
      
      // Use legacy single adapter (ZeroTollAdapter)
      const tx = await router.setDexAdapter(fallbackAdapter);
      console.log(`  Transaction: ${tx.hash}`);
      await tx.wait();
      console.log("  ✅ Legacy adapter configured!");
    } else {
      throw e;
    }
  }

  // Verify configuration
  console.log("\n📋 New configuration:");
  try {
    const newPrimary = await router.primaryAdapter();
    const newFallback = await router.fallbackAdapter();
    console.log(`  Primary: ${newPrimary}`);
    console.log(`  Fallback: ${newFallback}`);
  } catch (e) {
    const newLegacy = await router.dexAdapter();
    console.log(`  Legacy: ${newLegacy}`);
  }

  console.log("\n✅ Router configuration complete!");
  console.log("\nAdapter Fallback Chain:");
  console.log("  1. SmartDexAdapter (tries Uniswap → internal pool)");
  console.log("  2. ZeroTollAdapter (Pyth oracle, zTokens)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
