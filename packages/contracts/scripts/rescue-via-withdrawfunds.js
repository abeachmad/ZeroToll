const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\n🔧 Rescuing funds from OLD adapters on ${network}\n`);
  
  const [signer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${signer.address}\n`);

  if (network === "sepolia") {
    // Sepolia OLD adapter with funds
    const OLD_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";
    const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Old adapter: ${OLD_ADAPTER}`);
    
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", OLD_ADAPTER);
    const weth = await hre.ethers.getContractAt("IERC20", WETH);
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    
    const wethBal = await weth.balanceOf(OLD_ADAPTER);
    const usdcBal = await usdc.balanceOf(OLD_ADAPTER);
    
    console.log(`\n💰 Current balances:`);
    console.log(`  WETH: ${hre.ethers.formatEther(wethBal)}`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    
    // Rescue WETH
    if (wethBal > 0n) {
      console.log(`\n🚀 Withdrawing WETH...`);
      const tx1 = await adapter.withdrawFunds(WETH, wethBal);
      console.log(`  TX: ${tx1.hash}`);
      await tx1.wait();
      console.log(`  ✅ WETH rescued!`);
    } else {
      console.log(`\n⚠️  No WETH to rescue`);
    }
    
    // Rescue USDC
    if (usdcBal > 0n) {
      console.log(`\n🚀 Withdrawing USDC...`);
      const tx2 = await adapter.withdrawFunds(USDC, usdcBal);
      console.log(`  TX: ${tx2.hash}`);
      await tx2.wait();
      console.log(`  ✅ USDC rescued!`);
    } else {
      console.log(`\n⚠️  No USDC to rescue`);
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Sepolia rescue complete!`);
    
  } else if (network === "amoy") {
    // Amoy OLD adapters with funds
    const OLD_ADAPTERS = [
      "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7", // v2 - confirmed has funds
      "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec"  // recent - status unknown
    ];
    const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
    const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    
    for (const adapterAddr of OLD_ADAPTERS) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`Old adapter: ${adapterAddr}`);
      
      const adapter = await hre.ethers.getContractAt("MockDEXAdapter", adapterAddr);
      const wpol = await hre.ethers.getContractAt("IERC20", WPOL);
      const usdc = await hre.ethers.getContractAt("IERC20", USDC);
      
      const wpolBal = await wpol.balanceOf(adapterAddr);
      const usdcBal = await usdc.balanceOf(adapterAddr);
      
      console.log(`\n💰 Current balances:`);
      console.log(`  WPOL: ${hre.ethers.formatEther(wpolBal)}`);
      console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
      
      if (wpolBal === 0n && usdcBal === 0n) {
        console.log(`\n⚠️  Empty - skipping`);
        continue;
      }
      
      // Rescue WPOL
      if (wpolBal > 0n) {
        console.log(`\n🚀 Withdrawing WPOL...`);
        const tx1 = await adapter.withdrawFunds(WPOL, wpolBal);
        console.log(`  TX: ${tx1.hash}`);
        await tx1.wait();
        console.log(`  ✅ WPOL rescued!`);
      }
      
      // Rescue USDC
      if (usdcBal > 0n) {
        console.log(`\n🚀 Withdrawing USDC...`);
        const tx2 = await adapter.withdrawFunds(USDC, usdcBal);
        console.log(`  TX: ${tx2.hash}`);
        await tx2.wait();
        console.log(`  ✅ USDC rescued!`);
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Amoy rescue complete!`);
  }
  
  console.log(`\n📦 All rescued funds now in deployer wallet: ${signer.address}\n`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
