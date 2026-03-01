const hre = require("hardhat");

async function main() {
  console.log("🏦 Funding Adapters with Test Tokens...\n");

  const USER_PRIVATE_KEY = "5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04";
  const provider = hre.ethers.provider;
  const signer = new hre.ethers.Wallet(USER_PRIVATE_KEY, provider);
  
  console.log(`Using signer: ${signer.address}`);

  const adapters = {
    amoy: "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7",
    sepolia: "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
  };

  const network = hre.network.name;
  console.log(`Network: ${network}\n`);

  if (network === "amoy") {
    const USDC = await hre.ethers.getContractAt("IERC20", "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", signer);
    const WPOL = await hre.ethers.getContractAt("IERC20", "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", signer);
    
    console.log("📍 Amoy Adapter:", adapters.amoy);
    
    // Fund with 5 USDC and 5 POL
    const usdcAmount = hre.ethers.parseUnits("5", 6);
    const polAmount = hre.ethers.parseEther("0.05"); // Just 0.05 POL for wrapping
    
    console.log("\n💰 Wrapping 0.05 POL to WPOL...");
    const txWrap = await signer.sendTransaction({
      to: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
      value: polAmount
    });
    await txWrap.wait();
    console.log(`✅ Wrapped: ${txWrap.hash}`);
    
    console.log("\n💰 Transferring 5 USDC to adapter...");
    const tx1 = await USDC.transfer(adapters.amoy, usdcAmount);
    await tx1.wait();
    console.log(`✅ TX: ${tx1.hash}`);
    
    console.log("\n💰 Transferring 0.05 WPOL to adapter...");
    const tx2 = await WPOL.transfer(adapters.amoy, polAmount);
    await tx2.wait();
    console.log(`✅ TX: ${tx2.hash}`);
    
    const usdcBal = await USDC.balanceOf(adapters.amoy);
    const wpolBal = await WPOL.balanceOf(adapters.amoy);
    console.log(`\n📊 Adapter Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`   WPOL: ${hre.ethers.formatEther(wpolBal)}`);
    
  } else if (network === "sepolia") {
    const USDC = await hre.ethers.getContractAt("IERC20", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", signer);
    const WETH = await hre.ethers.getContractAt("IERC20", "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", signer);
    
    console.log("📍 Sepolia Adapter:", adapters.sepolia);
    
    // Fund with 5 USDC and 0.005 ETH
    const usdcAmount = hre.ethers.parseUnits("5", 6);
    const ethAmount = hre.ethers.parseEther("0.005");
    
    console.log("\n💰 Wrapping 0.005 ETH to WETH...");
    const txWrap = await signer.sendTransaction({
      to: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
      value: ethAmount
    });
    await txWrap.wait();
    console.log(`✅ Wrapped: ${txWrap.hash}`);
    
    console.log("\n💰 Transferring 5 USDC to adapter...");
    const tx1 = await USDC.transfer(adapters.sepolia, usdcAmount);
    await tx1.wait();
    console.log(`✅ TX: ${tx1.hash}`);
    
    console.log("\n💰 Transferring 0.005 WETH to adapter...");
    const tx2 = await WETH.transfer(adapters.sepolia, ethAmount);
    await tx2.wait();
    console.log(`✅ TX: ${tx2.hash}`);
    
    const usdcBal = await USDC.balanceOf(adapters.sepolia);
    const wethBal = await WETH.balanceOf(adapters.sepolia);
    console.log(`\n📊 Adapter Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`   WETH: ${hre.ethers.formatEther(wethBal)}`);
  }
  
  console.log("\n✅ Done!");
}

main().catch(console.error);
