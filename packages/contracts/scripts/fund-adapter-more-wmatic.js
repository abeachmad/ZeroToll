const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  const ADAPTER = "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec";
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  console.log("\n💰 Funding Adapter with More WMATIC");
  console.log("===================================");
  console.log("Deployer:", deployer.address);
  console.log("Adapter:", ADAPTER);
  
  const wmatic = await hre.ethers.getContractAt("IERC20", WMATIC);
  
  // Check deployer balance
  const deployerBal = await wmatic.balanceOf(deployer.address);
  console.log(`\nDeployer WMATIC: ${hre.ethers.formatEther(deployerBal)}`);
  
  // Transfer 20 WMATIC to adapter
  const amount = hre.ethers.parseEther("20");
  console.log(`\n📤 Transferring 20 WMATIC to adapter...`);
  const tx = await wmatic.transfer(ADAPTER, amount);
  await tx.wait();
  console.log(`✅ Transfer successful!`);
  
  // Check new balance
  const adapterBal = await wmatic.balanceOf(ADAPTER);
  console.log(`\n✅ Adapter new WMATIC balance: ${hre.ethers.formatEther(adapterBal)}\n`);
}

main().catch(console.error);
