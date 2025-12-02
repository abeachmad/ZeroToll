const hre = require("hardhat");

async function main() {
  const ROUTER = "0xd475255Ae38C92404f9740A19F93B8D2526A684b";

  console.log("Enabling test mode on router...");
  
  const router = await hre.ethers.getContractAt("ZeroTollRouterV2", ROUTER);
  
  const tx = await router.setTestMode(true);
  await tx.wait();
  
  console.log("✓ Test mode enabled!");
  console.log("Router will now simulate swaps for ZTA/ZTB tokens.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
