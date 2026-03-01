#!/usr/bin/env node

/**
 * Debug Amoy Adapter - Check configuration
 */

const { ethers } = require("hardhat");

const AMOY_RPC = "https://rpc-amoy.polygon.technology";
const AMOY_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
const AMOY_ROUTER = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";

// Token addresses (testnet)
const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
const USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";

async function main() {
  console.log("🔍 Debugging Amoy Adapter Configuration\n");
  console.log("=".repeat(50));
  console.log("Adapter:", AMOY_ADAPTER);
  console.log("RouterHub:", AMOY_ROUTER);
  console.log("WMATIC:", WMATIC);
  console.log("USDC:", USDC);
  console.log("=".repeat(50) + "\n");

  // Connect to Amoy
  const provider = new ethers.JsonRpcProvider(AMOY_RPC);
  
  // Check 1: Adapter is contract
  const adapterCode = await provider.getCode(AMOY_ADAPTER);
  if (adapterCode === "0x") {
    console.error("❌ Adapter is NOT a contract!");
    process.exit(1);
  }
  console.log("✅ Adapter is deployed");

  // Check 2: RouterHub is contract
  const routerCode = await provider.getCode(AMOY_ROUTER);
  if (routerCode === "0x") {
    console.error("❌ RouterHub is NOT a contract!");
    process.exit(1);
  }
  console.log("✅ RouterHub is deployed\n");

  // Check 3: Adapter has oracle configured
  const adapterAbi = [
    "function oracle() view returns (address)",
    "function router() view returns (address)",
    "function getQuote(address tokenIn, uint256 amountIn, address tokenOut) view returns (uint256 amountOut)",
  ];
  const adapter = new ethers.Contract(AMOY_ADAPTER, adapterAbi, provider);

  try {
    const oracleAddr = await adapter.oracle();
    console.log("Adapter oracle:", oracleAddr);
    
    // Check oracle is contract
    const oracleCode = await provider.getCode(oracleAddr);
    if (oracleCode === "0x") {
      console.error("❌ Oracle is NOT a contract!");
    } else {
      console.log("✅ Oracle is deployed");
    }
  } catch (e) {
    console.error("❌ Failed to get oracle:", e.message);
  }

  try {
    const routerAddr = await adapter.router();
    console.log("Adapter router:", routerAddr);
    
    if (routerAddr.toLowerCase() !== AMOY_ROUTER.toLowerCase()) {
      console.error(`❌ Adapter router mismatch! Expected ${AMOY_ROUTER}, got ${routerAddr}`);
    } else {
      console.log("✅ Adapter router matches");
    }
  } catch (e) {
    console.error("❌ Failed to get router:", e.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Check 4: Test quote
  console.log("Testing quote: 1 WMATIC → USDC");
  try {
    const quote = await adapter.getQuote(
      WMATIC,
      ethers.parseEther("1"),  // 1 WMATIC
      USDC
    );
    
    const quoteFloat = parseFloat(ethers.formatUnits(quote, 6));  // USDC has 6 decimals
    console.log(`Quote: ${quoteFloat} USDC`);
    
    if (quoteFloat === 0) {
      console.error("❌ Quote is ZERO! Adapter oracle not working!");
    } else {
      console.log("✅ Quote looks reasonable");
    }
  } catch (e) {
    console.error("❌ Quote failed:", e.message);
    
    // Try to decode revert reason
    if (e.data) {
      console.error("Revert data:", e.data);
    }
  }

  console.log("\n" + "=".repeat(50) + "\n");

  // Check 5: Router has adapter whitelisted
  const routerAbi = [
    "function adapters(address) view returns (bool)",
  ];
  const router = new ethers.Contract(AMOY_ROUTER, routerAbi, provider);

  try {
    const isWhitelisted = await router.adapters(AMOY_ADAPTER);
    if (isWhitelisted) {
      console.log("✅ Adapter is whitelisted in RouterHub");
    } else {
      console.error("❌ Adapter is NOT whitelisted in RouterHub!");
      console.error("   Run: npx hardhat run scripts/whitelist-adapter-amoy.js");
    }
  } catch (e) {
    console.error("❌ Failed to check adapter whitelist:", e.message);
  }

  console.log("\n" + "=".repeat(50) + "\n");
  console.log("✅ Debug complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
