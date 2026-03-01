#!/usr/bin/env node

/**
 * Deploy MockDEXAdapter baru untuk Amoy dengan SimpleMockOracle
 */

const { ethers } = require("hardhat");

// Oracle yang baru di-deploy
const SIMPLE_ORACLE = "0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e";

// RouterHub Amoy
const ROUTER_HUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";

// Tokens
const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
const USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";
const LINK = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";

async function main() {
  console.log("🚀 Deploying NEW MockDEXAdapter to Amoy...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "POL\n");

  // Deploy MockDEXAdapter
  console.log("Deploying MockDEXAdapter with oracle:", SIMPLE_ORACLE);
  const MockDEXAdapter = await ethers.getContractFactory("MockDEXAdapter");
  const adapter = await MockDEXAdapter.deploy(SIMPLE_ORACLE);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ MockDEXAdapter deployed:", adapterAddress);

  // Add supported tokens
  console.log("\nAdding supported tokens...");
  
  console.log("  Adding WMATIC...");
  let tx = await adapter.addSupportedToken(WMATIC);
  await tx.wait();
  
  console.log("  Adding USDC...");
  tx = await adapter.addSupportedToken(USDC);
  await tx.wait();
  
  console.log("  Adding LINK...");
  tx = await adapter.addSupportedToken(LINK);
  await tx.wait();
  
  console.log("✅ Tokens added!");

  // Verify configuration
  console.log("\nVerifying adapter configuration:");
  const oracleAddr = await adapter.priceOracle();
  console.log("  Oracle:", oracleAddr);
  console.log("  Owner:", await adapter.owner());

  // Test quote
  console.log("\nTesting quote: 1 WMATIC → USDC");
  try {
    const quote = await adapter.getQuote(
      WMATIC,
      USDC,
      ethers.parseEther("1")
    );
    
    const quoteFloat = parseFloat(ethers.formatUnits(quote[0], 6));
    console.log(`  Quote: ${quoteFloat} USDC`);
    
    if (quoteFloat > 0) {
      console.log("✅ Quote working!");
    } else {
      console.error("❌ Quote is ZERO!");
    }
  } catch (e) {
    console.error("❌ Quote failed:", e.message);
  }

  console.log("\n" + "=".repeat(50));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log("MockDEXAdapter:", adapterAddress);
  console.log("Oracle:", SIMPLE_ORACLE);
  
  console.log("\n✅ Add to backend/.env:");
  console.log(`AMOY_MOCKDEX_ADAPTER=${adapterAddress}`);
  
  console.log("\n✅ Next steps:");
  console.log("1. Whitelist adapter in RouterHub:");
  console.log(`   npx hardhat run scripts/whitelist-adapter-amoy.js --network amoy`);
  console.log("\n2. Fund adapter with test tokens (optional for testing):");
  console.log(`   npx hardhat run scripts/fund-adapter-amoy.js --network amoy`);
  console.log("\n3. Update prices periodically from backend:");
  console.log(`   python3 backend/update_amoy_prices.py`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
