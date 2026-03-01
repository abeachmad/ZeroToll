const hre = require("hardhat");

async function main() {
  console.log("=== DEBUGGING ORACLE & ADAPTER ===\n");
  
  // Addresses
  const AMOY_ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const AMOY_ORACLE = "0x01520E28693118042a0d9178Be96064E6FB62612";
  const AMOY_USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const AMOY_WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  const SEPOLIA_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
  const SEPOLIA_ORACLE = "0x729fBc26977F8df79B45c1c5789A483640E89b4A";
  const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const SEPOLIA_WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";
  
  // 1. CEK BALANCE ADAPTER
  console.log("1. ADAPTER BALANCES");
  console.log("=".repeat(60));
  
  if (hre.network.name === "amoy") {
    const usdc = await hre.ethers.getContractAt("IERC20", AMOY_USDC);
    const wpol = await hre.ethers.getContractAt("IERC20", AMOY_WPOL);
    
    const usdcBal = await usdc.balanceOf(AMOY_ADAPTER);
    const wpolBal = await wpol.balanceOf(AMOY_ADAPTER);
    
    console.log(`Amoy Adapter (${AMOY_ADAPTER}):`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WPOL: ${hre.ethers.formatUnits(wpolBal, 18)}`);
    console.log("");
    
    // 2. CEK ORACLE PRICE
    console.log("2. ORACLE PRICES (AMOY)");
    console.log("=".repeat(60));
    
    const oracle = await hre.ethers.getContractAt("TestnetPriceOracle", AMOY_ORACLE);
    
    const usdcPrice = await oracle.getPrice(AMOY_USDC);
    const wpolPrice = await oracle.getPrice(AMOY_WPOL);
    
    console.log(`USDC Price: ${hre.ethers.formatUnits(usdcPrice, 8)} (raw: ${usdcPrice})`);
    console.log(`WPOL Price: ${hre.ethers.formatUnits(wpolPrice, 8)} (raw: ${wpolPrice})`);
    console.log("");
    
    // 3. TEST QUOTE
    console.log("3. TEST ADAPTER QUOTE");
    console.log("=".repeat(60));
    
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", AMOY_ADAPTER);
    
    // Test 1: 1 USDC → WPOL (YANG GAGAL)
    console.log("Test A: 1 USDC → WPOL (direction yang GAGAL)");
    try {
      const quote1 = await adapter.getQuote(AMOY_USDC, AMOY_WPOL, hre.ethers.parseUnits("1", 6));
      console.log(`  Quote: ${hre.ethers.formatUnits(quote1[0], 18)} WPOL`);
      console.log(`  Path: ${quote1[1]}`);
      
      // Hitung manual
      const expectedWpol = (1.0 * parseFloat(hre.ethers.formatUnits(usdcPrice, 8))) / parseFloat(hre.ethers.formatUnits(wpolPrice, 8));
      console.log(`  Expected (manual): ${expectedWpol.toFixed(4)} WPOL`);
      console.log(`  With 0.3% fee: ${(expectedWpol * 0.997).toFixed(4)} WPOL`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
    console.log("");
    
    // Test 2: 1 WPOL → USDC (YANG BERHASIL)
    console.log("Test B: 1 WPOL → USDC (direction yang BERHASIL)");
    try {
      const quote2 = await adapter.getQuote(AMOY_WPOL, AMOY_USDC, hre.ethers.parseUnits("1", 18));
      console.log(`  Quote: ${hre.ethers.formatUnits(quote2[0], 6)} USDC`);
      console.log(`  Path: ${quote2[1]}`);
      
      // Hitung manual
      const expectedUsdc = (1.0 * parseFloat(hre.ethers.formatUnits(wpolPrice, 8))) / parseFloat(hre.ethers.formatUnits(usdcPrice, 8));
      console.log(`  Expected (manual): ${expectedUsdc.toFixed(4)} USDC`);
      console.log(`  With 0.3% fee: ${(expectedUsdc * 0.997).toFixed(4)} USDC`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
    
  } else if (hre.network.name === "sepolia") {
    const usdc = await hre.ethers.getContractAt("IERC20", SEPOLIA_USDC);
    const weth = await hre.ethers.getContractAt("IERC20", SEPOLIA_WETH);
    
    const usdcBal = await usdc.balanceOf(SEPOLIA_ADAPTER);
    const wethBal = await weth.balanceOf(SEPOLIA_ADAPTER);
    
    console.log(`Sepolia Adapter (${SEPOLIA_ADAPTER}):`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WETH: ${hre.ethers.formatUnits(wethBal, 18)}`);
    console.log("");
    
    // 2. CEK ORACLE PRICE
    console.log("2. ORACLE PRICES (SEPOLIA - PYTH)");
    console.log("=".repeat(60));
    
    const oracle = await hre.ethers.getContractAt("MultiTokenPythOracle", SEPOLIA_ORACLE);
    
    try {
      const wethPrice = await oracle.getPrice(SEPOLIA_WETH);
      console.log(`WETH Price: $${hre.ethers.formatUnits(wethPrice, 8)} (raw: ${wethPrice})`);
    } catch (error) {
      console.log(`WETH Price ERROR: ${error.message}`);
    }
    
    try {
      const usdcPrice = await oracle.getPrice(SEPOLIA_USDC);
      console.log(`USDC Price: $${hre.ethers.formatUnits(usdcPrice, 8)} (raw: ${usdcPrice})`);
    } catch (error) {
      console.log(`USDC Price ERROR: ${error.message}`);
    }
    console.log("");
    
    // 3. TEST QUOTE
    console.log("3. TEST ADAPTER QUOTE");
    console.log("=".repeat(60));
    
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", SEPOLIA_ADAPTER);
    
    // Test 1: 0.001 WETH → USDC (YANG GAGAL)
    console.log("Test A: 0.001 WETH → USDC (direction yang GAGAL)");
    try {
      const quote1 = await adapter.getQuote(SEPOLIA_WETH, SEPOLIA_USDC, hre.ethers.parseUnits("0.001", 18));
      console.log(`  Quote: ${hre.ethers.formatUnits(quote1[0], 6)} USDC`);
      console.log(`  Path: ${quote1[1]}`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      console.log(`  Short: ${error.shortMessage || 'N/A'}`);
    }
    console.log("");
    
    // Test 2: 1 USDC → WETH (YANG BERHASIL)
    console.log("Test B: 1 USDC → WETH (direction yang BERHASIL)");
    try {
      const quote2 = await adapter.getQuote(SEPOLIA_USDC, SEPOLIA_WETH, hre.ethers.parseUnits("1", 6));
      console.log(`  Quote: ${hre.ethers.formatUnits(quote2[0], 18)} WETH`);
      console.log(`  Path: ${quote2[1]}`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
