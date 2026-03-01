const hre = require("hardhat");

async function main() {
  const ADAPTER = "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec";
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  
  const wmatic = await hre.ethers.getContractAt("IERC20", WMATIC);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  
  const wmaticBal = await wmatic.balanceOf(ADAPTER);
  const usdcBal = await usdc.balanceOf(ADAPTER);
  
  console.log(`\nNew Adapter: ${ADAPTER}`);
  console.log(`WMATIC: ${hre.ethers.formatEther(wmaticBal)}`);
  console.log(`USDC: ${hre.ethers.formatUnits(usdcBal, 6)}\n`);
  
  if (wmaticBal >= hre.ethers.parseEther("5") && usdcBal >= hre.ethers.parseUnits("5", 6)) {
    console.log("✅ Adapter has sufficient balance for testing!\n");
  } else {
    console.log("⚠️  Low balance - may need more tokens\n");
  }
}

main().catch(console.error);
