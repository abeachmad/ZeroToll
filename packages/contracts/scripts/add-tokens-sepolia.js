// Add WETH and USDC as supported tokens in MockDEXAdapter on Sepolia
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Adding tokens with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  // Sepolia addresses
  const MOCKDEX_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  console.log("\n📝 Configuration:");
  console.log("   MockDEXAdapter:", MOCKDEX_ADAPTER);
  console.log("   WETH:", WETH);
  console.log("   USDC:", USDC);

  // Get contract
  const MockDEXAdapter = await hre.ethers.getContractAt("MockDEXAdapter", MOCKDEX_ADAPTER);

  // Check current status
  console.log("\n🔍 Checking current token support...");
  const wethSupported = await MockDEXAdapter.supportedTokens(WETH);
  const usdcSupported = await MockDEXAdapter.supportedTokens(USDC);
  
  console.log("   WETH supported:", wethSupported);
  console.log("   USDC supported:", usdcSupported);

  // Add WETH if not supported
  if (!wethSupported) {
    console.log("\n➕ Adding WETH as supported token...");
    const tx1 = await MockDEXAdapter.addSupportedToken(WETH);
    console.log("   TX:", tx1.hash);
    await tx1.wait();
    console.log("   ✅ WETH added!");
  } else {
    console.log("\n✅ WETH already supported");
  }

  // Add USDC if not supported
  if (!usdcSupported) {
    console.log("\n➕ Adding USDC as supported token...");
    const tx2 = await MockDEXAdapter.addSupportedToken(USDC);
    console.log("   TX:", tx2.hash);
    await tx2.wait();
    console.log("   ✅ USDC added!");
  } else {
    console.log("\n✅ USDC already supported");
  }

  // Verify
  console.log("\n🔍 Verifying...");
  const wethSupportedAfter = await MockDEXAdapter.supportedTokens(WETH);
  const usdcSupportedAfter = await MockDEXAdapter.supportedTokens(USDC);
  
  console.log("   WETH supported:", wethSupportedAfter);
  console.log("   USDC supported:", usdcSupportedAfter);

  if (wethSupportedAfter && usdcSupportedAfter) {
    console.log("\n🎉 SUCCESS! Both tokens are now supported!");
    console.log("\n💡 You can now retry the failed swap transaction");
  } else {
    console.log("\n❌ Something went wrong");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
