const hre = require("hardhat");

async function main() {
  const NEW_ADAPTER = "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec";
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n💰 Funding New Adapter on Amoy\n`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Adapter: ${NEW_ADAPTER}\n`);
  
  // Transfer WMATIC
  console.log("Sending 5 WMATIC...");
  const wmatic = await hre.ethers.getContractAt("IERC20", WMATIC);
  await wmatic.transfer(NEW_ADAPTER, hre.ethers.parseEther("5"));
  console.log("✅ 5 WMATIC sent\n");
  
  // Transfer USDC
  console.log("Sending 5 USDC...");
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  await usdc.transfer(NEW_ADAPTER, hre.ethers.parseUnits("5", 6));
  console.log("✅ 5 USDC sent\n");
  
  // Check balances
  const wmaticBal = await wmatic.balanceOf(NEW_ADAPTER);
  const usdcBal = await usdc.balanceOf(NEW_ADAPTER);
  
  console.log("📊 New Adapter Balances:");
  console.log(`  WMATIC: ${hre.ethers.formatEther(wmaticBal)}`);
  console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}\n`);
}

main().catch(console.error);
