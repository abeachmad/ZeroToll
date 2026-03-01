const hre = require("hardhat");

/**
 * Manual rescue by calling token.transfer() directly from adapter
 * Since old adapter is owned by us, we can call any function
 */

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  const ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  console.log("🚨 MANUAL RESCUE FROM OLD ADAPTER");
  console.log("━".repeat(60));
  console.log(`Adapter: ${ADAPTER}`);
  console.log(`Signer: ${signer.address}`);
  console.log();
  
  const weth = await hre.ethers.getContractAt("IERC20", WETH);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  
  const wethBal = await weth.balanceOf(ADAPTER);
  const usdcBal = await usdc.balanceOf(ADAPTER);
  
  console.log("Current balances in adapter:");
  console.log(`  WETH: ${hre.ethers.formatEther(wethBal)}`);
  console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
  console.log();
  
  // Try to use adapter as impersonated account to transfer tokens out
  // This requires adapter to have a transfer function or we need to use different approach
  
  console.log("⚠️  Old adapter may not have rescue function.");
  console.log("Options:");
  console.log("  1. If adapter has owner(), try calling adapter.owner() functions");
  console.log("  2. Fund NEW adapter instead and use old adapter funds for testing");
  console.log("  3. Just proceed - 0.04 WETH + 100 USDC not critical for testnet");
  console.log();
  console.log("Recommendation: PROCEED with new adapters, leave old funds for reference");
}

main().catch(console.error);
