const hre = require("hardhat");

async function main() {
  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const USDC = "0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB";
  
  const wpol = await hre.ethers.getContractAt("IERC20", WPOL);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  
  const wpolBal = await wpol.balanceOf(ADAPTER);
  const usdcBal = await usdc.balanceOf(ADAPTER);
  
  console.log("Adapter balances:");
  console.log("  WPOL:", hre.ethers.formatEther(wpolBal));
  console.log("  USDC:", hre.ethers.formatUnits(usdcBal, 6));
}

main().catch(console.error);
