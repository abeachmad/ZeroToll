const hre = require("hardhat");

async function main() {
  console.log("🏦 Funding Adapters from Relayer Wallet...\n");

  const RELAYER_KEY = "470e31d6cb154d9c5fe824241d57689665869db3df390278570aeecd2318116c";
  const relayer = new hre.ethers.Wallet(RELAYER_KEY, hre.ethers.provider);
  
  console.log(`Relayer: ${relayer.address}`);
  
  const network = hre.network.name;
  console.log(`Network: ${network}\n`);

  if (network === "amoy") {
    const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
    const USDC_ADDR = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    const WPOL_ADDR = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
    
    const USDC = await hre.ethers.getContractAt("IERC20", USDC_ADDR, relayer);
    
    // Check relayer balance
    const relayerPOL = await hre.ethers.provider.getBalance(relayer.address);
    const relayerUSDC = await USDC.balanceOf(relayer.address);
    
    console.log("💰 Relayer Balance:");
    console.log(`   POL: ${hre.ethers.formatEther(relayerPOL)}`);
    console.log(`   USDC: ${hre.ethers.formatUnits(relayerUSDC, 6)}`);
    
    if (relayerUSDC >= hre.ethers.parseUnits("10", 6)) {
      console.log("\n✅ Relayer has USDC! Sending 10 USDC to adapter...");
      const tx1 = await USDC.transfer(ADAPTER, hre.ethers.parseUnits("10", 6));
      await tx1.wait();
      console.log(`✅ USDC sent: ${tx1.hash}`);
    } else {
      console.log("\n⚠️ Relayer has no USDC");
    }
    
    if (relayerPOL >= hre.ethers.parseEther("5")) {
      console.log("\n✅ Relayer has POL! Wrapping 5 POL...");
      const tx2 = await relayer.sendTransaction({
        to: WPOL_ADDR,
        value: hre.ethers.parseEther("5")
      });
      await tx2.wait();
      console.log(`✅ Wrapped: ${tx2.hash}`);
      
      const WPOL = await hre.ethers.getContractAt("IERC20", WPOL_ADDR, relayer);
      const tx3 = await WPOL.transfer(ADAPTER, hre.ethers.parseEther("5"));
      await tx3.wait();
      console.log(`✅ WPOL sent: ${tx3.hash}`);
    } else {
      console.log("\n⚠️ Relayer has insufficient POL");
    }
    
    // Check adapter balance
    const adapterUSDC = await USDC.balanceOf(ADAPTER);
    const WPOL = await hre.ethers.getContractAt("IERC20", WPOL_ADDR, relayer);
    const adapterWPOL = await WPOL.balanceOf(ADAPTER);
    
    console.log("\n📊 Adapter Balance:");
    console.log(`   USDC: ${hre.ethers.formatUnits(adapterUSDC, 6)}`);
    console.log(`   WPOL: ${hre.ethers.formatEther(adapterWPOL)}`);
    
  } else if (network === "sepolia") {
    const ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
    const USDC_ADDR = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    const WETH_ADDR = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    
    const USDC = await hre.ethers.getContractAt("IERC20", USDC_ADDR, relayer);
    
    const relayerETH = await hre.ethers.provider.getBalance(relayer.address);
    const relayerUSDC = await USDC.balanceOf(relayer.address);
    
    console.log("💰 Relayer Balance:");
    console.log(`   ETH: ${hre.ethers.formatEther(relayerETH)}`);
    console.log(`   USDC: ${hre.ethers.formatUnits(relayerUSDC, 6)}`);
    
    if (relayerUSDC >= hre.ethers.parseUnits("10", 6)) {
      console.log("\n✅ Relayer has USDC! Sending 10 USDC to adapter...");
      const tx1 = await USDC.transfer(ADAPTER, hre.ethers.parseUnits("10", 6));
      await tx1.wait();
      console.log(`✅ USDC sent: ${tx1.hash}`);
    } else {
      console.log("\n⚠️ Relayer has no USDC");
    }
    
    if (relayerETH >= hre.ethers.parseEther("0.1")) {
      console.log("\n✅ Relayer has ETH! Wrapping 0.05 ETH...");
      const tx2 = await relayer.sendTransaction({
        to: WETH_ADDR,
        value: hre.ethers.parseEther("0.05")
      });
      await tx2.wait();
      console.log(`✅ Wrapped: ${tx2.hash}`);
      
      const WETH = await hre.ethers.getContractAt("IERC20", WETH_ADDR, relayer);
      const tx3 = await WETH.transfer(ADAPTER, hre.ethers.parseEther("0.05"));
      await tx3.wait();
      console.log(`✅ WETH sent: ${tx3.hash}`);
    } else {
      console.log("\n⚠️ Relayer has insufficient ETH");
    }
    
    const adapterUSDC = await USDC.balanceOf(ADAPTER);
    const WETH = await hre.ethers.getContractAt("IERC20", WETH_ADDR, relayer);
    const adapterWETH = await WETH.balanceOf(ADAPTER);
    
    console.log("\n📊 Adapter Balance:");
    console.log(`   USDC: ${hre.ethers.formatUnits(adapterUSDC, 6)}`);
    console.log(`   WETH: ${hre.ethers.formatEther(adapterWETH)}`);
  }
  
  console.log("\n✅ Done!");
}

main().catch(console.error);
