#!/usr/bin/env node

/**
 * Deploy SimpleMockOracle untuk Amoy testnet
 * Oracle ini bisa di-update dari backend dengan harga LIVE dari Pyth REST API
 */

const { ethers } = require("hardhat");

// Token addresses (Amoy testnet)
const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
const USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";
const LINK = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";

// Initial prices (from Pyth REST API, 8 decimals)
// Will be updated by backend periodically
const INITIAL_PRICES = {
  [WMATIC]: "17585004",      // $0.176 (POL/MATIC price from Pyth)
  [USDC]: "99990071",        // $1.00
  [LINK]: "1500000000",      // $15.00 (example)
};

async function main() {
  console.log("🚀 Deploying SimpleMockOracle to Amoy...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "POL\n");

  // Deploy SimpleMockOracle
  console.log("Deploying SimpleMockOracle...");
  const SimpleMockOracle = await ethers.getContractFactory("SimpleMockOracle");
  const oracle = await SimpleMockOracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("✅ SimpleMockOracle deployed:", oracleAddress);

  // Set initial prices
  console.log("\nSetting initial prices...");
  const tokens = Object.keys(INITIAL_PRICES);
  const prices = Object.values(INITIAL_PRICES);

  const tx = await oracle.setPrices(tokens, prices);
  await tx.wait();
  console.log("✅ Prices set!");

  // Verify prices
  console.log("\nVerifying prices:");
  for (const [token, expectedPrice] of Object.entries(INITIAL_PRICES)) {
    const price = await oracle.getPrice(token);
    const priceFloat = parseFloat(price.toString()) / 1e8;
    console.log(`  ${token}: $${priceFloat.toFixed(6)}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log("SimpleMockOracle:", oracleAddress);
  console.log("\n✅ Add to backend/.env:");
  console.log(`AMOY_SIMPLE_ORACLE=${oracleAddress}`);
  
  console.log("\n✅ Next steps:");
  console.log("1. Update MockDEXAdapter oracle:");
  console.log(`   npx hardhat run scripts/update-adapter-oracle-amoy.js --network amoy`);
  console.log("\n2. Start price updater in backend:");
  console.log(`   python3 price_updater.py`);
  
  console.log("\n💡 Oracle can be updated with:");
  console.log(`   await oracle.setPrices([tokenAddr], [priceInUSD8Decimals])`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
