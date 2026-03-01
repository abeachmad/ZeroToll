const hre = require("hardhat");

async function main() {
  console.log("=== DEBUGGING APPROVAL MECHANISM ===\n");
  
  const AMOY_WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const AMOY_USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  const SEPOLIA_WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  const USER = "0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A";
  const ROUTER_AMOY = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
  const ROUTER_SEPOLIA = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
  
  if (hre.network.name === "amoy") {
    console.log("AMOY NETWORK\n");
    console.log("=".repeat(60));
    
    const wmatic = await hre.ethers.getContractAt("IERC20", AMOY_WMATIC);
    const usdc = await hre.ethers.getContractAt("IERC20", AMOY_USDC);
    
    // Check allowances
    const wmaticAllowance = await wmatic.allowance(USER, ROUTER_AMOY);
    const usdcAllowance = await usdc.allowance(USER, ROUTER_AMOY);
    
    console.log("User Allowances to RouterHub:");
    console.log(`  WMATIC: ${hre.ethers.formatEther(wmaticAllowance)}`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcAllowance, 6)}`);
    console.log("");
    
    // Check if tokens support permit
    try {
      const wmaticContract = await hre.ethers.getContractAt("IERC20Permit", AMOY_WMATIC);
      const domain = await wmaticContract.DOMAIN_SEPARATOR();
      console.log("✅ WMATIC supports ERC20Permit!");
      console.log(`   Domain: ${domain}`);
    } catch (e) {
      console.log("❌ WMATIC does NOT support ERC20Permit");
    }
    console.log("");
    
    try {
      const usdcContract = await hre.ethers.getContractAt("IERC20Permit", AMOY_USDC);
      const domain = await usdcContract.DOMAIN_SEPARATOR();
      console.log("✅ USDC supports ERC20Permit!");
      console.log(`   Domain: ${domain}`);
    } catch (e) {
      console.log("❌ USDC does NOT support ERC20Permit");
    }
    
  } else if (hre.network.name === "sepolia") {
    console.log("SEPOLIA NETWORK\n");
    console.log("=".repeat(60));
    
    const weth = await hre.ethers.getContractAt("IERC20", SEPOLIA_WETH);
    const usdc = await hre.ethers.getContractAt("IERC20", SEPOLIA_USDC);
    
    // Check allowances
    const wethAllowance = await weth.allowance(USER, ROUTER_SEPOLIA);
    const usdcAllowance = await usdc.allowance(USER, ROUTER_SEPOLIA);
    
    console.log("User Allowances to RouterHub:");
    console.log(`  WETH: ${hre.ethers.formatEther(wethAllowance)}`);
    console.log(`  USDC: ${hre.ethers.formatUnits(usdcAllowance, 6)}`);
    console.log("");
    
    // Check if tokens support permit
    try {
      const wethContract = await hre.ethers.getContractAt("IERC20Permit", SEPOLIA_WETH);
      const domain = await wethContract.DOMAIN_SEPARATOR();
      console.log("✅ WETH supports ERC20Permit!");
      console.log(`   Domain: ${domain}`);
    } catch (e) {
      console.log("❌ WETH does NOT support ERC20Permit");
    }
    console.log("");
    
    try {
      const usdcContract = await hre.ethers.getContractAt("IERC20Permit", SEPOLIA_USDC);
      const domain = await usdcContract.DOMAIN_SEPARATOR();
      console.log("✅ USDC supports ERC20Permit!");
      console.log(`   Domain: ${domain}`);
    } catch (e) {
      console.log("❌ USDC does NOT support ERC20Permit");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
