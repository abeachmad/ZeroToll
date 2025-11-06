/**
 * Add test tokens to adapter on Amoy
 */

const hre = require("hardhat");

async function main() {
  console.log("⚙️  Adding test tokens to adapter...\n");
  
  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const USDC = "0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB";
  const USDT = "0xe25B671dEabf3D6b107C21Df10bFC39e9a839d98";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);

  console.log("Adding USDC:", USDC);
  const tx1 = await adapter.addSupportedToken(USDC);
  await tx1.wait();
  console.log("✅ Added");

  console.log("\nAdding USDT:", USDT);
  const tx2 = await adapter.addSupportedToken(USDT);
  await tx2.wait();
  console.log("✅ Added");

  console.log("\n✅ All tokens added to adapter!");
  console.log("\n📋 Supported tokens:");
  console.log("  USDC:", USDC);
  console.log("  USDT:", USDT);
  console.log("  WPOL:", WPOL);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
