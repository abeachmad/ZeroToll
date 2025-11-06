const hre = require("hardhat");

async function main() {
  console.log("🏦 Funding Adapters with Test Tokens...\n");

  // Use user wallet (has test tokens)
  const USER_PRIVATE_KEY = "5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04";
  const provider = hre.ethers.provider;
  const signer = new hre.ethers.Wallet(USER_PRIVATE_KEY, provider);
  
  console.log(`Using signer: ${signer.address}`);
  const balance = await provider.getBalance(signer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

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
    const USDC = await hre.ethers.getContractAt("IERC20", "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", signer);
    const WPOL = await hre.ethers.getContractAt("IERC20", "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", signer);
    
    console.log("\n📍 Amoy Adapter:", adapters.amoy);
    
    // Check user balances
    const userUSDC = await USDC.balanceOf(signer.address);
    const userWPOL = await WPOL.balanceOf(signer.address);
    console.log(`\n�� User Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(userUSDC, 6)}`);
    console.log(`   WPOL: ${hre.ethers.formatEther(userWPOL)}`);
    
    // Fund with 100 USDC and 10 POL (wrapped)
    const usdcAmount = hre.ethers.parseUnits("100", 6);
    const wpolAmount = hre.ethers.parseEther("10");
    
    if (userUSDC >= usdcAmount) {
      console.log("\n💰 Transferring 100 USDC to adapter...");
      const tx1 = await USDC.transfer(adapters.amoy, usdcAmount);
      await tx1.wait();
      console.log(`✅ TX: ${tx1.hash}`);
    } else {
      console.log("\n⚠️ Insufficient USDC balance");
    }
    
    if (userWPOL >= wpolAmount) {
      console.log("\n💰 Transferring 10 WPOL to adapter...");
      const tx2 = await WPOL.transfer(adapters.amoy, wpolAmount);
      await tx2.wait();
      console.log(`✅ TX: ${tx2.hash}`);
    } else {
      console.log("\n⚠️ Insufficient WPOL balance, wrapping POL...");
      // Wrap POL to WPOL
      const tx = await signer.sendTransaction({
        to: WPOL.target,
        value: wpolAmount
      });
      await tx.wait();
      console.log(`✅ Wrapped 10 POL: ${tx.hash}`);
      
      // Transfer to adapter
      const tx2 = await WPOL.transfer(adapters.amoy, wpolAmount);
      await tx2.wait();
      console.log(`✅ Transferred to adapter: ${tx2.hash}`);
    }
    
    // Check adapter balances
    const usdcBal = await USDC.balanceOf(adapters.amoy);
    const wpolBal = await WPOL.balanceOf(adapters.amoy);
    console.log(`\n📊 Adapter Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`   WPOL: ${hre.ethers.formatEther(wpolBal)}`);
    
  } else if (network === "sepolia") {
    // Sepolia tokens
    const USDC = await hre.ethers.getContractAt("IERC20", "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", signer);
    const WETH = await hre.ethers.getContractAt("IERC20", "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", signer);
    
    console.log("\n📍 Sepolia Adapter:", adapters.sepolia);
    
    // Check user balances
    const userUSDC = await USDC.balanceOf(signer.address);
    const userWETH = await WETH.balanceOf(signer.address);
    console.log(`\n👤 User Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(userUSDC, 6)}`);
    console.log(`   WETH: ${hre.ethers.formatEther(userWETH)}`);
    
    // Fund with 100 USDC and 0.1 WETH
    const usdcAmount = hre.ethers.parseUnits("100", 6);
    const wethAmount = hre.ethers.parseEther("0.1");
    
    if (userUSDC >= usdcAmount) {
      console.log("\n💰 Transferring 100 USDC to adapter...");
      const tx1 = await USDC.transfer(adapters.sepolia, usdcAmount);
      await tx1.wait();
      console.log(`✅ TX: ${tx1.hash}`);
    } else {
      console.log("\n⚠️ Insufficient USDC balance");
    }
    
    if (userWETH >= wethAmount) {
      console.log("\n💰 Transferring 0.1 WETH to adapter...");
      const tx2 = await WETH.transfer(adapters.sepolia, wethAmount);
      await tx2.wait();
      console.log(`✅ TX: ${tx2.hash}`);
    } else {
      console.log("\n⚠️ Insufficient WETH balance, wrapping ETH...");
      // Wrap ETH to WETH
      const tx = await signer.sendTransaction({
        to: WETH.target,
        value: wethAmount
      });
      await tx.wait();
      console.log(`✅ Wrapped 0.1 ETH: ${tx.hash}`);
      
      // Transfer to adapter
      const tx2 = await WETH.transfer(adapters.sepolia, wethAmount);
      await tx2.wait();
      console.log(`✅ Transferred to adapter: ${tx2.hash}`);
    }
    
    // Check adapter balances
    const usdcBal = await USDC.balanceOf(adapters.sepolia);
    const wethBal = await WETH.balanceOf(adapters.sepolia);
    console.log(`\n📊 Adapter Balances:`);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`   WETH: ${hre.ethers.formatEther(wethBal)}`);
  }
  
  console.log("\n✅ Adapters funded successfully!");
}

main().catch(console.error);
