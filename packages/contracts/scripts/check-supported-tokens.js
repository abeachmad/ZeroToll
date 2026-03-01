const hre = require("hardhat");

async function main() {
  const ADAPTER = "0x7cafe27c7367fa0e929d4e83578cec838e3ceec7";
  const WMATIC = "0x360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9";
  const USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";
  
  const adapter = await hre.ethers.getContractAt(
    "MockDEXAdapter",
    ADAPTER
  );
  
  const wmaticSupported = await adapter.supportedTokens(WMATIC);
  const usdcSupported = await adapter.supportedTokens(USDC);
  
  console.log("\n=== ADAPTER SUPPORTED TOKENS ===");
  console.log(`Adapter: ${ADAPTER}`);
  console.log("");
  console.log(`WMATIC (${WMATIC}): ${wmaticSupported ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
  console.log(`USDC (${USDC}): ${usdcSupported ? '✅ SUPPORTED' : '❌ NOT SUPPORTED'}`);
  console.log("");
  
  if (!wmaticSupported || !usdcSupported) {
    console.log("🔥 ROOT CAUSE FOUND!");
    console.log("Adapter rejects swap because tokens are not whitelisted!");
    console.log("");
    console.log("FIX: Run `addSupportedToken()` for both USDC and WMATIC");
  }
}

main().catch(console.error);
