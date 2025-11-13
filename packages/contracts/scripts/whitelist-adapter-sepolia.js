#!/usr/bin/env node

/**
 * Whitelist adapter on RouterHub v1.4 (Sepolia)
 */

const { ethers } = require("hardhat");

// NEW RouterHub v1.4 with gasless fee support
const ROUTER_HUB = "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84";
const MOCK_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"; // Existing Sepolia adapter

async function main() {
  console.log("🔧 Whitelisting adapter in RouterHub (Sepolia)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const RouterHub = await ethers.getContractAt("RouterHub", ROUTER_HUB);

  // Check if already whitelisted
  const isWhitelisted = await RouterHub.whitelistedAdapter(MOCK_ADAPTER);
  
  if (isWhitelisted) {
    console.log("✅ Adapter already whitelisted!");
    return;
  }

  // Whitelist
  console.log("Whitelisting adapter:", MOCK_ADAPTER);
  const tx = await RouterHub.whitelistAdapter(MOCK_ADAPTER, true);
  console.log("TX:", tx.hash);
  
  await tx.wait();
  console.log("✅ Adapter whitelisted!");

  // Verify
  const verified = await RouterHub.whitelistedAdapter(MOCK_ADAPTER);
  if (verified) {
    console.log("✅ Verification SUCCESS!");
  } else {
    console.error("❌ Verification FAILED!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
