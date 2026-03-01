#!/usr/bin/env node

/**
 * Whitelist adapter baru di RouterHub Amoy
 */

const { ethers } = require("hardhat");

// NEW RouterHub v1.4 with gasless fee support
const ROUTER_HUB = "0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881";
const NEW_ADAPTER = "0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1";

async function main() {
  console.log("🔧 Whitelisting adapter in RouterHub...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const RouterHub = await ethers.getContractAt("RouterHub", ROUTER_HUB);

  // Check if already whitelisted
  const isWhitelisted = await RouterHub.whitelistedAdapter(NEW_ADAPTER);
  
  if (isWhitelisted) {
    console.log("✅ Adapter already whitelisted!");
    return;
  }

  // Whitelist
  console.log("Whitelisting adapter:", NEW_ADAPTER);
  const tx = await RouterHub.whitelistAdapter(NEW_ADAPTER, true);
  console.log("TX:", tx.hash);
  
  await tx.wait();
  console.log("✅ Adapter whitelisted!");

  // Verify
  const verified = await RouterHub.whitelistedAdapter(NEW_ADAPTER);
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
