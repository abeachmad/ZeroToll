// SPDX-License-Identifier: MIT
const hre = require("hardhat");

/**
 * Add WETH and USDC to MockDEXAdapter supportedTokens on Sepolia
 * 
 * PROBLEM: WETH swap fails with "Adapter call failed"
 * ROOT CAUSE: WETH not added to MockDEXAdapter's supportedTokens mapping
 * 
 * SOLUTION: Add WETH and USDC to adapter's supportedTokens
 */

async function main() {
  console.log("\n🔧 Adding Tokens to MockDEXAdapter on Sepolia...\n");

  const MOCK_DEX_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  console.log("📍 Adapter:", MOCK_DEX_ADAPTER);
  console.log("🪙 Adding tokens:");
  console.log("   - WETH:", WETH);
  console.log("   - USDC:", USDC);

  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", MOCK_DEX_ADAPTER);

  // Check if tokens already supported
  console.log("\n🔍 Checking current support status...");
  const wethSupported = await adapter.supportedTokens(WETH);
  const usdcSupported = await adapter.supportedTokens(USDC);
  
  console.log(`   WETH supported: ${wethSupported ? '✅' : '❌'}`);
  console.log(`   USDC supported: ${usdcSupported ? '✅' : '❌'}`);

  // Add WETH if not already supported
  if (!wethSupported) {
    console.log("\n➕ Adding WETH to supported tokens...");
    const tx1 = await adapter.addSupportedToken(WETH);
    await tx1.wait();
    console.log("✅ Added WETH");
  } else {
    console.log("\n✓ WETH already supported");
  }

  // Add USDC if not already supported
  if (!usdcSupported) {
    console.log("\n➕ Adding USDC to supported tokens...");
    const tx2 = await adapter.addSupportedToken(USDC);
    await tx2.wait();
    console.log("✅ Added USDC");
  } else {
    console.log("\n✓ USDC already supported");
  }

  // Verify
  console.log("\n🔍 Verifying...");
  const wethSupportedAfter = await adapter.supportedTokens(WETH);
  const usdcSupportedAfter = await adapter.supportedTokens(USDC);
  
  console.log(`   WETH supported: ${wethSupportedAfter ? '✅' : '❌'}`);
  console.log(`   USDC supported: ${usdcSupportedAfter ? '✅' : '❌'}`);

  if (wethSupportedAfter && usdcSupportedAfter) {
    console.log("\n✅ Done! MockDEXAdapter now supports WETH and USDC");
    console.log("\n📋 Summary:");
    console.log("   • Adapter:", MOCK_DEX_ADAPTER);
    console.log("   • WETH:", WETH, "✓");
    console.log("   • USDC:", USDC, "✓");
    console.log("\n🧪 Test: Try swapping 0.001 WETH → USDC on Sepolia");
    console.log("   Expected: Should work now! ✨");
  } else {
    console.error("\n❌ Error: Tokens not added properly");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
