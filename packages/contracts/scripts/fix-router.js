const hre = require("hardhat");

async function main() {
  const ROUTER = "0xd475255Ae38C92404f9740A19F93B8D2526A684b";

  console.log("Checking router state...");
  
  const router = await hre.ethers.getContractAt("ZeroTollRouterV2", ROUTER);
  
  const testMode = await router.testMode();
  const dexAdapter = await router.dexAdapter();
  
  console.log("Current state:");
  console.log("  testMode:", testMode);
  console.log("  dexAdapter:", dexAdapter);

  // For ZTA/ZTB to work, we need testMode=true AND dexAdapter=0x0
  // OR we need to clear the adapter so it falls through to test mode
  
  if (dexAdapter !== "0x0000000000000000000000000000000000000000") {
    console.log("\nClearing DEX adapter to use test mode...");
    const tx1 = await router.setDexAdapter("0x0000000000000000000000000000000000000000");
    await tx1.wait();
    console.log("✓ DEX adapter cleared");
  }

  if (!testMode) {
    console.log("\nEnabling test mode...");
    const tx2 = await router.setTestMode(true);
    await tx2.wait();
    console.log("✓ Test mode enabled");
  }

  console.log("\nRouter is now configured for ZTA/ZTB test swaps!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
