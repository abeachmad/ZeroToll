// SPDX-License-Identifier: MIT
const hre = require("hardhat");

/**
 * Add missing token to MockDEXAdapter supportedTokens
 * 
 * PROBLEM: Frontend tokenlist uses different USDC address than deployment script
 * - Deployment: 0x150ae9614a43361775d9d3a006f75ccc558b598f
 * - Frontend:   0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582
 * 
 * SOLUTION: Add frontend USDC to adapter's supportedTokens
 */

async function main() {
  console.log("\n🔧 Adding Missing Token to MockDEXAdapter on Amoy...\n");

  const MOCK_DEX_ADAPTER = "0x7cafe27c7367fa0e929d4e83578cec838e3ceec7";
  const FRONTEND_USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";
  const WMATIC = "0x360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9";

  console.log("📍 Adapter:", MOCK_DEX_ADAPTER);
  console.log("🪙 Adding token: USDC (frontend)", FRONTEND_USDC);

  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", MOCK_DEX_ADAPTER);

  // Add frontend USDC
  console.log("\n➕ Adding USDC (frontend) to supported tokens...");
  const tx1 = await adapter.addSupportedToken(FRONTEND_USDC);
  await tx1.wait();
  console.log("✅ Added USDC (frontend)");

  // Also add WMATIC if not already
  console.log("\n➕ Adding WMATIC to supported tokens...");
  const tx2 = await adapter.addSupportedToken(WMATIC);
  await tx2.wait();
  console.log("✅ Added WMATIC");

  console.log("\n✅ Done! MockDEXAdapter now supports frontend USDC address");
  console.log("\n📋 Summary:");
  console.log("   • Adapter:", MOCK_DEX_ADAPTER);
  console.log("   • USDC (frontend):", FRONTEND_USDC, "✓");
  console.log("   • WMATIC:", WMATIC, "✓");
  console.log("\n🧪 Test: Try swapping USDC → WMATIC on Amoy");
  console.log("\nNote: Prices come from PythPriceOracle, no need to add pairs manually");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
