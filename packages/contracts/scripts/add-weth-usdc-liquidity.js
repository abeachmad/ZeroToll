const hre = require("hardhat");

async function main() {
  const ADAPTER = "0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Check deployer balances
  const wethContract = await hre.ethers.getContractAt("IERC20", WETH);
  const usdcContract = await hre.ethers.getContractAt("IERC20", USDC);
  
  const wethBal = await wethContract.balanceOf(deployer.address);
  const usdcBal = await usdcContract.balanceOf(deployer.address);
  
  console.log("Deployer WETH:", hre.ethers.formatEther(wethBal));
  console.log("Deployer USDC:", hre.ethers.formatUnits(usdcBal, 6));

  const adapter = await hre.ethers.getContractAt("SmartDexAdapter", ADAPTER);

  // Set price for WETH/USDC (1 WETH = 2000 USDC approximately)
  // Price is in 1e18 format, but USDC has 6 decimals
  // So 1 WETH (1e18) = 2000 USDC (2000e6)
  // Price = 2000e6 * 1e18 / 1e18 = 2000e6 (but we need to account for decimals)
  // Actually: amountOut = (amountIn * price) / 1e18
  // For 1e18 WETH -> 2000e6 USDC: price = 2000e6 * 1e18 / 1e18 = 2000e6
  // But that's wrong because amountOut = 1e18 * 2000e6 / 1e18 = 2000e6 ✓
  
  const wethToUsdcPrice = hre.ethers.parseUnits("2000", 6); // 1 WETH = 2000 USDC
  console.log("\nSetting WETH -> USDC price:", wethToUsdcPrice.toString());
  await (await adapter.setPrice(WETH, USDC, wethToUsdcPrice)).wait();
  console.log("✓ Price set");

  // If deployer has WETH/USDC, add as liquidity
  if (wethBal > 0n) {
    const wethToAdd = wethBal / 2n; // Add half
    console.log("\nAdding WETH liquidity:", hre.ethers.formatEther(wethToAdd));
    await (await wethContract.approve(ADAPTER, wethToAdd)).wait();
    await (await adapter.addLiquidity(WETH, wethToAdd)).wait();
    console.log("✓ WETH liquidity added");
  }

  if (usdcBal > 0n) {
    const usdcToAdd = usdcBal / 2n; // Add half
    console.log("\nAdding USDC liquidity:", hre.ethers.formatUnits(usdcToAdd, 6));
    await (await usdcContract.approve(ADAPTER, usdcToAdd)).wait();
    await (await adapter.addLiquidity(USDC, usdcToAdd)).wait();
    console.log("✓ USDC liquidity added");
  }

  // Check final liquidity
  const finalWeth = await adapter.liquidity(WETH);
  const finalUsdc = await adapter.liquidity(USDC);
  console.log("\n=== ADAPTER LIQUIDITY ===");
  console.log("WETH:", hre.ethers.formatEther(finalWeth));
  console.log("USDC:", hre.ethers.formatUnits(finalUsdc, 6));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
