const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("\n🔧 Fixing Sepolia MockDEXAdapter Oracle Bug");
  console.log("==========================================");
  console.log("Deployer:", deployer.address);

  // Sepolia testnet addresses
  const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789";
  const ROUTER_HUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";

  // Step 1: Deploy TestnetPriceOracle
  console.log("\n📜 Step 1: Deploying TestnetPriceOracle...");
  const TestnetPriceOracle = await hre.ethers.getContractFactory("TestnetPriceOracle");
  const oracle = await TestnetPriceOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("✅ TestnetPriceOracle deployed:", oracleAddress);

  // Step 2: Set token prices (8 decimals)
  console.log("\n💰 Step 2: Setting token prices...");
  
  // WETH: ~$3390 → 339000000000 (8 decimals)
  await oracle.setPrice(WETH, 339000000000);
  console.log("  WETH price set: $3390.00");
  
  // USDC: $1.00 → 100000000 (8 decimals)
  await oracle.setPrice(USDC, 100000000);
  console.log("  USDC price set: $1.00");
  
  // LINK: ~$15 → 1500000000 (8 decimals)
  await oracle.setPrice(LINK, 1500000000);
  console.log("  LINK price set: $15.00");

  // Step 3: Deploy MockDEXAdapter with correct oracle
  console.log("\n🏭 Step 3: Deploying MockDEXAdapter...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const adapter = await MockDEXAdapter.deploy(oracleAddress);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ MockDEXAdapter deployed:", adapterAddress);

  // Step 4: Add supported tokens
  console.log("\n🪙 Step 4: Adding supported tokens...");
  await adapter.addSupportedToken(WETH);
  console.log("  ✅ WETH added");
  await adapter.addSupportedToken(USDC);
  console.log("  ✅ USDC added");
  await adapter.addSupportedToken(LINK);
  console.log("  ✅ LINK added");

  // Step 5: Test getQuote
  console.log("\n🧪 Step 5: Testing getQuote()...");
  try {
    // Test 1: 100 USDC → WETH
    const usdcAmount = hre.ethers.parseUnits("100", 6);
    const wethQuote = await adapter.getQuote(USDC, WETH, usdcAmount);
    console.log(`  100 USDC → ${hre.ethers.formatEther(wethQuote)} WETH ✅`);
    
    // Test 2: 0.01 WETH → USDC
    const wethAmount = hre.ethers.parseEther("0.01");
    const usdcQuote = await adapter.getQuote(WETH, USDC, wethAmount);
    console.log(`  0.01 WETH → ${hre.ethers.formatUnits(usdcQuote, 6)} USDC ✅`);
  } catch (error) {
    console.error("❌ getQuote test failed:", error.message);
    return;
  }

  // Step 6: Whitelist adapter in RouterHub
  console.log("\n🔓 Step 6: Whitelisting adapter in RouterHub...");
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);
  await routerHub.whitelistAdapter(adapterAddress, true);
  console.log("✅ Adapter whitelisted in RouterHub");

  // Step 7: Verify whitelist status
  const isWhitelisted = await routerHub.whitelistedAdapter(adapterAddress);
  console.log(`  Whitelist status: ${isWhitelisted ? '✅ ACTIVE' : '❌ FAILED'}`);

  console.log("\n" + "=".repeat(50));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
  console.log("\n📋 Summary:");
  console.log(`  TestnetPriceOracle: ${oracleAddress}`);
  console.log(`  MockDEXAdapter:     ${adapterAddress}`);
  console.log(`  RouterHub:          ${ROUTER_HUB}`);
  console.log("\n⚠️  IMPORTANT NEXT STEPS:");
  console.log("  1. Fund adapter with tokens:");
  console.log(`     • WETH: 0.01+ (for testing)`);
  console.log(`     • USDC: 50+ (for testing)`);
  console.log("  2. Update backend/.env:");
  console.log(`     SEPOLIA_MOCKDEX_ADAPTER=${adapterAddress}`);
  console.log("  3. Restart backend to load new adapter");
  console.log("  4. Test swaps on Sepolia network\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
