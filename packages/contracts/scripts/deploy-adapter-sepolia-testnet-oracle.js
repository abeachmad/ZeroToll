const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying MockDEXAdapter to Sepolia with TestnetPriceOracle...\n");
  
  const ORACLE = "0xC9aB81218270C4419ec0929A074E39E81DB9b64E";
  const ROUTER_HUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Oracle:", ORACLE);
  console.log("");
  
  // Deploy adapter
  console.log("1️⃣  Deploying MockDEXAdapter...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const adapter = await MockDEXAdapter.deploy(ORACLE);
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  console.log("✅ Adapter deployed:", adapterAddr);
  
  // Add supported tokens
  console.log("\n2️⃣  Adding supported tokens...");
  await adapter.addSupportedToken(WETH);
  console.log("  ✅ WETH added");
  await adapter.addSupportedToken(USDC);
  console.log("  ✅ USDC added");
  
  // Whitelist in RouterHub
  console.log("\n3️⃣  Whitelisting in RouterHub...");
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);
  await routerHub.whitelistAdapter(adapterAddr, true);
  console.log("✅ Adapter whitelisted");
  
  // Test quote
  console.log("\n4️⃣  Testing getQuote()...");
  const quote = await adapter.getQuote(USDC, WETH, hre.ethers.parseUnits("1", 6));
  console.log(`  1 USDC → ${hre.ethers.formatEther(quote[0])} WETH ✅`);
  
  console.log("\n✅ DEPLOYMENT COMPLETE!");
  console.log("\n📋 SUMMARY:");
  console.log(`  Oracle: ${ORACLE}`);
  console.log(`  Adapter: ${adapterAddr}`);
  console.log(`  RouterHub: ${ROUTER_HUB}`);
  console.log("\n⚠️  NEXT STEPS:");
  console.log("  1. Fund adapter with WETH and USDC");
  console.log("  2. Update backend/.env:");
  console.log(`     SEPOLIA_PYTH_ORACLE=${ORACLE}`);
  console.log(`     SEPOLIA_MOCKDEX_ADAPTER=${adapterAddr}`);
  console.log("  3. Restart backend");
  console.log("  4. Test swaps!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
