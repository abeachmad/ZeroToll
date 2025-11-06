const hre = require("hardhat");

async function main() {
  console.log("🏦 Funding Amoy Adapter...\n");

  const USER_KEY = "5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04";
  const signer = new hre.ethers.Wallet(USER_KEY, hre.ethers.provider);
  
  console.log(`User: ${signer.address}`);
  
  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const USDC_ADDR = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const WPOL_ADDR = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  const USDC = await hre.ethers.getContractAt("IERC20", USDC_ADDR, signer);
  const WPOL = await hre.ethers.getContractAt("IERC20", WPOL_ADDR, signer);
  
  // Check user balance
  const userUSDC = await USDC.balanceOf(signer.address);
  const userPOL = await hre.ethers.provider.getBalance(signer.address);
  
  console.log(`\n💰 User Balance:`);
  console.log(`   USDC: ${hre.ethers.formatUnits(userUSDC, 6)}`);
  console.log(`   POL: ${hre.ethers.formatEther(userPOL)}`);
  
  // Transfer 3 USDC to adapter
  console.log(`\n📤 Transferring 3 USDC to adapter...`);
  const tx1 = await USDC.transfer(ADAPTER, hre.ethers.parseUnits("3", 6));
  const receipt1 = await tx1.wait();
  console.log(`✅ USDC sent: ${tx1.hash}`);
  
  // Wrap 3 POL to WPOL
  console.log(`\n🔄 Wrapping 3 POL to WPOL...`);
  const tx2 = await signer.sendTransaction({
    to: WPOL_ADDR,
    value: hre.ethers.parseEther("3")
  });
  const receipt2 = await tx2.wait();
  console.log(`✅ Wrapped: ${tx2.hash}`);
  
  // Transfer 3 WPOL to adapter
  console.log(`\n📤 Transferring 3 WPOL to adapter...`);
  const tx3 = await WPOL.transfer(ADAPTER, hre.ethers.parseEther("3"));
  const receipt3 = await tx3.wait();
  console.log(`✅ WPOL sent: ${tx3.hash}`);
  
  // Check adapter balance
  const adapterUSDC = await USDC.balanceOf(ADAPTER);
  const adapterWPOL = await WPOL.balanceOf(ADAPTER);
  
  console.log(`\n📊 Adapter Balance:`);
  console.log(`   USDC: ${hre.ethers.formatUnits(adapterUSDC, 6)}`);
  console.log(`   WPOL: ${hre.ethers.formatEther(adapterWPOL)}`);
  console.log(`\n✅ Amoy adapter funded!`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
