const hre = require("hardhat");

async function main() {
  console.log("=== TESTING CORRECT ADAPTERS (FROM FRONTEND CONFIG) ===\n");
  
  // DARI FRONTEND CONFIG
  const AMOY_ADAPTER = "0xbe6F932465D5155c1564FF0AD7Cc9D2D2a4316d5"; // BENAR!
  const AMOY_USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const AMOY_WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  
  const SEPOLIA_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"; // BENAR!
  const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const SEPOLIA_WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";
  
  if (hre.network.name === "amoy") {
    console.log("AMOY NETWORK");
    console.log("=".repeat(60));
    console.log(`Adapter: ${AMOY_ADAPTER}\n`);
    
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", AMOY_ADAPTER);
    const usdc = await hre.ethers.getContractAt("IERC20", AMOY_USDC);
    const wpol = await hre.ethers.getContractAt("IERC20", AMOY_WPOL);
    
    // Balance
    const usdcBal = await usdc.balanceOf(AMOY_ADAPTER);
    const wpolBal = await wpol.balanceOf(AMOY_ADAPTER);
    console.log(`Balances:`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WPOL: ${hre.ethers.formatUnits(wpolBal, 18)}`);
    console.log("");
    
    // Get oracle address
    const oracleAddr = await adapter.priceOracle();
    console.log(`Oracle: ${oracleAddr}\n`);
    
    // Test quotes
    console.log("Test 1: 1 USDC → WPOL (YANG GAGAL)");
    console.log("-".repeat(60));
    try {
      const [amountOut, path] = await adapter.getQuote(
        AMOY_USDC, 
        AMOY_WPOL, 
        hre.ethers.parseUnits("1", 6)
      );
      console.log(`✅ Quote: ${hre.ethers.formatUnits(amountOut, 18)} WPOL`);
      console.log(`   Path: ${path.join(" → ")}`);
    } catch (error) {
      console.log(`❌ ERROR: ${error.shortMessage || error.message}`);
    }
    console.log("");
    
    console.log("Test 2: 1 WPOL → USDC (YANG BERHASIL)");
    console.log("-".repeat(60));
    try {
      const [amountOut, path] = await adapter.getQuote(
        AMOY_WPOL,
        AMOY_USDC,
        hre.ethers.parseUnits("1", 18)
      );
      console.log(`✅ Quote: ${hre.ethers.formatUnits(amountOut, 6)} USDC`);
      console.log(`   Path: ${path.join(" → ")}`);
    } catch (error) {
      console.log(`❌ ERROR: ${error.shortMessage || error.message}`);
    }
    
  } else if (hre.network.name === "sepolia") {
    console.log("SEPOLIA NETWORK");
    console.log("=".repeat(60));
    console.log(`Adapter: ${SEPOLIA_ADAPTER}\n`);
    
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", SEPOLIA_ADAPTER);
    const usdc = await hre.ethers.getContractAt("IERC20", SEPOLIA_USDC);
    const weth = await hre.ethers.getContractAt("IERC20", SEPOLIA_WETH);
    
    // Balance
    const usdcBal = await usdc.balanceOf(SEPOLIA_ADAPTER);
    const wethBal = await weth.balanceOf(SEPOLIA_ADAPTER);
    console.log(`Balances:`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WETH: ${hre.ethers.formatUnits(wethBal, 18)}`);
    console.log("");
    
    // Get oracle address
    const oracleAddr = await adapter.priceOracle();
    console.log(`Oracle: ${oracleAddr}\n`);
    
    // Test quotes
    console.log("Test 1: 0.001 WETH → USDC (YANG GAGAL)");
    console.log("-".repeat(60));
    try {
      const [amountOut, path] = await adapter.getQuote(
        SEPOLIA_WETH,
        SEPOLIA_USDC,
        hre.ethers.parseUnits("0.001", 18)
      );
      console.log(`✅ Quote: ${hre.ethers.formatUnits(amountOut, 6)} USDC`);
      console.log(`   Path: ${path.join(" → ")}`);
    } catch (error) {
      console.log(`❌ ERROR: ${error.shortMessage || error.message}`);
    }
    console.log("");
    
    console.log("Test 2: 1 USDC → WETH (YANG BERHASIL)");
    console.log("-".repeat(60));
    try {
      const [amountOut, path] = await adapter.getQuote(
        SEPOLIA_USDC,
        SEPOLIA_WETH,
        hre.ethers.parseUnits("1", 6)
      );
      console.log(`✅ Quote: ${hre.ethers.formatUnits(amountOut, 18)} WETH`);
      console.log(`   Path: ${path.join(" → ")}`);
    } catch (error) {
      console.log(`❌ ERROR: ${error.shortMessage || error.message}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
