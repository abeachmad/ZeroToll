const hre = require("hardhat");

async function main() {
  const ROUTER = "0x577560699EF88e99f15d04df57c9552056d2a10D";

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
