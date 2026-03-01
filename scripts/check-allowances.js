const hre = require("hardhat");

async function main() {
  console.log("=== CHECKING TOKEN ALLOWANCES ===\n");
  
  // Test wallet (dari tx yang gagal)
  const USER = "0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A";
  
  if (hre.network.name === "amoy") {
    const ROUTER = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
    const USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";
    const WMATIC = "0x360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9";
    
    console.log("AMOY NETWORK");
    console.log("=".repeat(60));
    console.log(`User: ${USER}`);
    console.log(`RouterHub: ${ROUTER}\n`);
    
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const wmatic = await hre.ethers.getContractAt("IERC20", WMATIC);
    
    // Check allowances
    const usdcAllowance = await usdc.allowance(USER, ROUTER);
    const wmaticAllowance = await wmatic.allowance(USER, ROUTER);
    
    console.log("TOKEN ALLOWANCES:");
    console.log(`  USDC → RouterHub: ${hre.ethers.formatUnits(usdcAllowance, 6)} USDC`);
    console.log(`  WMATIC → RouterHub: ${hre.ethers.formatUnits(wmaticAllowance, 18)} WMATIC`);
    
    // Check if infinite
    const MAX_UINT256 = hre.ethers.MaxUint256;
    console.log("\nIS INFINITE APPROVAL?");
    console.log(`  USDC: ${usdcAllowance >= MAX_UINT256 / 2n ? "YES (infinite)" : "NO"}`);
    console.log(`  WMATIC: ${wmaticAllowance >= MAX_UINT256 / 2n ? "YES (infinite)" : "NO"}`);
    
    // Check balances
    const usdcBal = await usdc.balanceOf(USER);
    const wmaticBal = await wmatic.balanceOf(USER);
    console.log("\nUSER BALANCES:");
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WMATIC: ${hre.ethers.formatUnits(wmaticBal, 18)}`);
    
  } else if (hre.network.name === "sepolia") {
    const ROUTER = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    const WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14";
    
    console.log("SEPOLIA NETWORK");
    console.log("=".repeat(60));
    console.log(`User: ${USER}`);
    console.log(`RouterHub: ${ROUTER}\n`);
    
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const weth = await hre.ethers.getContractAt("IERC20", WETH);
    
    // Check allowances
    const usdcAllowance = await usdc.allowance(USER, ROUTER);
    const wethAllowance = await weth.allowance(USER, ROUTER);
    
    console.log("TOKEN ALLOWANCES:");
    console.log(`  USDC → RouterHub: ${hre.ethers.formatUnits(usdcAllowance, 6)} USDC`);
    console.log(`  WETH → RouterHub: ${hre.ethers.formatUnits(wethAllowance, 18)} WETH`);
    
    // Check if infinite
    const MAX_UINT256 = hre.ethers.MaxUint256;
    console.log("\nIS INFINITE APPROVAL?");
    console.log(`  USDC: ${usdcAllowance >= MAX_UINT256 / 2n ? "YES (infinite)" : "NO"}`);
    console.log(`  WETH: ${wethAllowance >= MAX_UINT256 / 2n ? "YES (infinite)" : "NO"}`);
    
    // Check balances
    const usdcBal = await usdc.balanceOf(USER);
    const wethBal = await weth.balanceOf(USER);
    console.log("\nUSER BALANCES:");
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    console.log(`  WETH: ${hre.ethers.formatUnits(wethBal, 18)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
