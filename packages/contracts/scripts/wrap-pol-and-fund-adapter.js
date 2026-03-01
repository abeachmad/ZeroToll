const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  const ADAPTER = "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  console.log("\n🔄 Wrapping POL and Funding Adapter");
  console.log("===================================");
  console.log("Deployer:", deployer.address);
  console.log("Adapter:", ADAPTER);
  
  // Check deployer native POL balance
  const polBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`\nDeployer POL (native): ${hre.ethers.formatEther(polBalance)}`);
  
  // Wrap 30 POL → WPOL
  const wpol = await hre.ethers.getContractAt(
    ["function deposit() payable", "function balanceOf(address) view returns (uint256)", "function transfer(address to, uint256 amount) returns (bool)"],
    WPOL
  );
  
  console.log(`\n🔄 Wrapping 4 POL → WPOL...`);
  const wrapAmount = hre.ethers.parseEther("4");
  const wrapTx = await wpol.deposit({ value: wrapAmount });
  await wrapTx.wait();
  console.log(`✅ Wrapped successfully!`);
  
  // Check WPOL balance
  const wpolBalance = await wpol.balanceOf(deployer.address);
  console.log(`Deployer WPOL: ${hre.ethers.formatEther(wpolBalance)}`);
  
  // Transfer all WPOL to adapter
  console.log(`\n📤 Transferring ${hre.ethers.formatEther(wpolBalance)} WPOL to adapter...`);
  const transferTx = await wpol.transfer(ADAPTER, wpolBalance);
  await transferTx.wait();
  console.log(`✅ Transfer successful!`);
  
  // Check adapter balance
  const adapterBalance = await wpol.balanceOf(ADAPTER);
  console.log(`\n✅ Adapter WPOL balance: ${hre.ethers.formatEther(adapterBalance)}\n`);
}

main().catch(console.error);
