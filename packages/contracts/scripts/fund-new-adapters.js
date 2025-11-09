const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\n💰 Funding NEW adapters on ${network}\n`);
  
  const [signer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${signer.address}\n`);

  if (network === "sepolia") {
    const NEW_ADAPTER = "0x23e2B44bC22F9940F9eb00C6C674039ed291821F";
    const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`NEW MockDEXAdapter (with Pyth): ${NEW_ADAPTER}`);
    
    const weth = await hre.ethers.getContractAt("IERC20", WETH);
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    
    // Check current deployer balance
    const wethBal = await weth.balanceOf(signer.address);
    const usdcBal = await usdc.balanceOf(signer.address);
    
    console.log(`\n💼 Your wallet balances:`);
    console.log(`  WETH: ${hre.ethers.formatEther(wethBal)}`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    
    // Transfer rescued funds to NEW adapter
    if (wethBal > 0n) {
      console.log(`\n🚀 Transferring WETH to NEW adapter...`);
      const tx1 = await weth.transfer(NEW_ADAPTER, wethBal);
      console.log(`  TX: ${tx1.hash}`);
      await tx1.wait();
      console.log(`  ✅ ${hre.ethers.formatEther(wethBal)} WETH transferred`);
    }
    
    if (usdcBal > 0n) {
      console.log(`\n🚀 Transferring USDC to NEW adapter...`);
      const tx2 = await usdc.transfer(NEW_ADAPTER, usdcBal);
      console.log(`  TX: ${tx2.hash}`);
      await tx2.wait();
      console.log(`  ✅ ${hre.ethers.formatUnits(usdcBal, 6)} USDC transferred`);
    }
    
    // Verify final balances
    const finalWeth = await weth.balanceOf(NEW_ADAPTER);
    const finalUsdc = await usdc.balanceOf(NEW_ADAPTER);
    
    console.log(`\n📊 NEW adapter funded:`);
    console.log(`  WETH: ${hre.ethers.formatEther(finalWeth)}`);
    console.log(`  USDC: ${hre.ethers.formatUnits(finalUsdc, 6)}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
  } else if (network === "amoy") {
    const NEW_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
    const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
    const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`NEW MockDEXAdapter (with Pyth): ${NEW_ADAPTER}`);
    
    const wpol = await hre.ethers.getContractAt("IERC20", WPOL);
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    
    // Check current deployer balance
    const wpolBal = await wpol.balanceOf(signer.address);
    const usdcBal = await usdc.balanceOf(signer.address);
    
    console.log(`\n💼 Your wallet balances:`);
    console.log(`  WPOL: ${hre.ethers.formatEther(wpolBal)}`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    
    // Transfer rescued funds to NEW adapter
    if (wpolBal > 0n) {
      console.log(`\n🚀 Transferring WPOL to NEW adapter...`);
      const tx1 = await wpol.transfer(NEW_ADAPTER, wpolBal);
      console.log(`  TX: ${tx1.hash}`);
      await tx1.wait();
      console.log(`  ✅ ${hre.ethers.formatEther(wpolBal)} WPOL transferred`);
    }
    
    if (usdcBal > 0n) {
      console.log(`\n🚀 Transferring USDC to NEW adapter...`);
      const tx2 = await usdc.transfer(NEW_ADAPTER, usdcBal);
      console.log(`  TX: ${tx2.hash}`);
      await tx2.wait();
      console.log(`  ✅ ${hre.ethers.formatUnits(usdcBal, 6)} USDC transferred`);
    }
    
    // Verify final balances
    const finalWpol = await wpol.balanceOf(NEW_ADAPTER);
    const finalUsdc = await usdc.balanceOf(NEW_ADAPTER);
    
    console.log(`\n📊 NEW adapter funded:`);
    console.log(`  WPOL: ${hre.ethers.formatEther(finalWpol)}`);
    console.log(`  USDC: ${hre.ethers.formatUnits(finalUsdc, 6)}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
  
  console.log(`\n✅ Funding complete!\n`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
