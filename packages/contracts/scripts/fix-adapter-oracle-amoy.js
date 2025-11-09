const hre = require("hardhat");

/**
 * Fix MockDEXAdapter oracle issue on Amoy
 * 
 * PROBLEM: Adapter was deployed with oracle = address(1), causing all swaps to revert
 * SOLUTION: Deploy new MockDEXAdapter with proper MockPriceOracle
 */

async function main() {
  console.log("\n🔧 FIXING ADAPTER ORACLE ISSUE ON AMOY\n");
  console.log("=".repeat(60));
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}\n`);
  
  // Step 1: Deploy TestnetPriceOracle
  console.log("📋 Step 1: Deploying TestnetPriceOracle...");
  const TestnetPriceOracle = await hre.ethers.getContractFactory("TestnetPriceOracle");
  const oracle = await TestnetPriceOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log(`✅ TestnetPriceOracle deployed: ${oracleAddress}\n`);
  
  // Step 2: Set prices for tokens
  console.log("📋 Step 2: Setting token prices...");
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  
  // Prices in 8 decimals (Pyth format)
  const WMATIC_PRICE = Math.floor(0.18 * 1e8); // $0.18
  const USDC_PRICE = Math.floor(1.00 * 1e8);   // $1.00
  
  await oracle.setPrice(WMATIC, WMATIC_PRICE);
  console.log(`  WMATIC price set: $${WMATIC_PRICE / 1e8}`);
  
  await oracle.setPrice(USDC, USDC_PRICE);
  console.log(`  USDC price set: $${USDC_PRICE / 1e8}\n`);
  
  // Step 3: Deploy new MockDEXAdapter with proper oracle
  console.log("📋 Step 3: Deploying MockDEXAdapter with oracle...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const adapter = await MockDEXAdapter.deploy(oracleAddress);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log(`✅ MockDEXAdapter deployed: ${adapterAddress}\n`);
  
  // Step 4: Add supported tokens
  console.log("📋 Step 4: Adding supported tokens...");
  await adapter.addSupportedToken(WMATIC);
  console.log(`  ✅ WMATIC supported`);
  
  await adapter.addSupportedToken(USDC);
  console.log(`  ✅ USDC supported\n`);
  
  // Step 5: Test getQuote
  console.log("📋 Step 5: Testing getQuote...");
  const quote = await adapter.getQuote(USDC, WMATIC, 1000000n); // 1 USDC
  console.log(`  Quote: 1 USDC → ${hre.ethers.formatEther(quote[0])} WMATIC`);
  console.log(`  Expected: ~5.55 WMATIC (1 / 0.18 = 5.55)\n`);
  
  // Step 6: Fund adapter with tokens
  console.log("📋 Step 6: Funding adapter...");
  console.log(`  ⚠️  Manual step required:`);
  console.log(`  1. Send 10 WMATIC to ${adapterAddress}`);
  console.log(`  2. Send 10 USDC to ${adapterAddress}\n`);
  
  // Step 7: Whitelist in RouterHub
  const ROUTER_HUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
  console.log("📋 Step 7: Whitelisting adapter in RouterHub...");
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);
  
  try {
    await routerHub.whitelistAdapter(adapterAddress, true);
    console.log(`  ✅ Adapter whitelisted in RouterHub\n`);
  } catch (err) {
    console.log(`  ⚠️  Manual whitelisting required (not owner): ${err.shortMessage}\n`);
  }
  
  // Summary
  console.log("=".repeat(60));
  console.log("\n✅ SETUP COMPLETE!\n");
  console.log("📝 NEXT STEPS:");
  console.log(`  1. Update backend .env:`);
  console.log(`     AMOY_MOCKDEX_ADAPTER=${adapterAddress}`);
  console.log(`  2. Fund adapter with tokens (see step 6 above)`);
  console.log(`  3. If RouterHub whitelist failed, run as owner:`);
  console.log(`     await routerHub.whitelistAdapter("${adapterAddress}", true)`);
  console.log(`  4. Restart backend to use new adapter`);
  console.log(`  5. Test swap: 1 USDC → WMATIC\n`);
  
  console.log("📊 DEPLOYMENT ADDRESSES:");
  console.log(`  TestnetPriceOracle: ${oracleAddress}`);
  console.log(`  MockDEXAdapter: ${adapterAddress}`);
  console.log(`  RouterHub: ${ROUTER_HUB}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
