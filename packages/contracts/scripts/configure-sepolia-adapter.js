const hre = require("hardhat");

async function main() {
  console.log("🔧 Configuring Sepolia Adapter (Step 2)...\n");
  
  const ADAPTER = "0x3522D5F996a506374c33835a985Bf7ec775403B2";
  const ROUTER_HUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
  
  // Add USDC (WETH already added probably)
  console.log("Adding USDC...");
  await adapter.addSupportedToken(USDC);
  console.log("✅ USDC added");
  
  // Whitelist
  console.log("\nWhitelisting adapter...");
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);
  await routerHub.whitelistAdapter(ADAPTER, true);
  console.log("✅ Whitelisted");
  
  // Test
  console.log("\nTesting quote...");
  const quote = await adapter.getQuote(USDC, WETH, hre.ethers.parseUnits("1", 6));
  console.log(`1 USDC → ${hre.ethers.formatEther(quote[0])} WETH ✅`);
  
  console.log("\n✅ DONE! Adapter ready for funding");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
