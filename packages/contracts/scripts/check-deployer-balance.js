const hre = require("hardhat");

async function main() {
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  
  const [deployer] = await hre.ethers.getSigners();
  
  const wmatic = await hre.ethers.getContractAt("IERC20", WMATIC);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  
  const wmaticBal = await wmatic.balanceOf(deployer.address);
  const usdcBal = await usdc.balanceOf(deployer.address);
  const nativeBal = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`POL: ${hre.ethers.formatEther(nativeBal)}`);
  console.log(`WMATIC: ${hre.ethers.formatEther(wmaticBal)}`);
  console.log(`USDC: ${hre.ethers.formatUnits(usdcBal, 6)}\n`);
}

main().catch(console.error);
