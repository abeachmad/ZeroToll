const hre = require("hardhat");

async function main() {
  console.log("🏦 Funding Adapters with Test Tokens...\n");

  const [signer] = await hre.ethers.getSigners();
  console.log(`Using signer: ${signer.address}\n`);

  // Adapter addresses
  const adapters = {
    amoy: "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7",
    sepolia: "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
  };

  // Current network
  const network = hre.network.name;
  console.log(`Network: ${network}`);

  if (network === "amoy") {
    // Amoy tokens
    const USDC = await hre.ethers.getContractAt("IERC20", "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582");
    const WPOL = await hre.ethers.getContractAt("IERC20", "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9");
    
    console.log("\n📍 Amoy Adapter:", adapters.amoy);
    
    // Fund with 1000 USDC and 1000 WPOL
    console.log("\n💰 Transferring 1000 USDC to adapter...");
    const tx1 = await USDC.transfer(adapters.amoy, hre.ethers.parseUnits("1000", 6));
    await tx1.wait();
    console.log(`✅ TX: ${tx1.hash}`);
    
    console.log("\n💰 Transferring 1000 WPOL to adapter...");
    const tx2 = await WPOL.transfer(adapters.amoy, hre.ethers.parseEther("1000"));
    await tx2.wait();
    console.log(`✅ TX: ${tx2.hash}`);
    
    // Check balances
    const usdcBal = await USDC.balanceOf(adapters.amoy);
    const wpolBal = await WPOL.balanceOf(adapters.amoy);
    console.log(`\n📊 Adapter Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`   WPOL: ${hre.ethers.formatEther(wpolBal)}`);
    
  } else if (network === "sepolia") {
    // Sepolia tokens
    const USDC = await hre.ethers.getContractAt("IERC20", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
    const WETH = await hre.ethers.getContractAt("IERC20", "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14");
    
    console.log("\n📍 Sepolia Adapter:", adapters.sepolia);
    
    // Fund with 1000 USDC and 1 WETH
    console.log("\n💰 Transferring 1000 USDC to adapter...");
    const tx1 = await USDC.transfer(adapters.sepolia, hre.ethers.parseUnits("1000", 6));
    await tx1.wait();
    console.log(`✅ TX: ${tx1.hash}`);
    
    console.log("\n💰 Transferring 1 WETH to adapter...");
    const tx2 = await WETH.transfer(adapters.sepolia, hre.ethers.parseEther("1"));
    await tx2.wait();
    console.log(`✅ TX: ${tx2.hash}`);
    
    // Check balances
    const usdcBal = await USDC.balanceOf(adapters.sepolia);
    const wethBal = await WETH.balanceOf(adapters.sepolia);
    console.log(`\n📊 Adapter Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`   WETH: ${hre.ethers.formatEther(wethBal)}`);
  }
  
  console.log("\n✅ Adapters funded successfully!");
}

main().catch(console.error);
