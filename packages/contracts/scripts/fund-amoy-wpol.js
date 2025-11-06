const hre = require("hardhat");

async function main() {
  console.log("🏦 Wrapping POL and sending to Amoy Adapter...\n");

  const USER_KEY = "5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04";
  const signer = new hre.ethers.Wallet(USER_KEY, hre.ethers.provider);
  
  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const WPOL_ADDR = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  const WPOL = await hre.ethers.getContractAt("IERC20", WPOL_ADDR, signer);
  
  const userPOL = await hre.ethers.provider.getBalance(signer.address);
  console.log(`💰 User POL: ${hre.ethers.formatEther(userPOL)}`);
  
  // Wrap 0.02 POL (leave 0.02 for gas)
  const wrapAmount = hre.ethers.parseEther("0.02");
  
  console.log(`\n🔄 Wrapping 0.02 POL to WPOL...`);
  const tx1 = await signer.sendTransaction({
    to: WPOL_ADDR,
    value: wrapAmount
  });
  await tx1.wait();
  console.log(`✅ Wrapped: ${tx1.hash}`);
  
  console.log(`\n📤 Transferring 0.02 WPOL to adapter...`);
  const tx2 = await WPOL.transfer(ADAPTER, wrapAmount);
  await tx2.wait();
  console.log(`✅ Sent: ${tx2.hash}`);
  
  const adapterWPOL = await WPOL.balanceOf(ADAPTER);
  console.log(`\n📊 Adapter WPOL: ${hre.ethers.formatEther(adapterWPOL)}`);
  console.log(`✅ Done!`);
}

main().catch(console.error);
