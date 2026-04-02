const hre = require("hardhat");

async function main() {
  if (hre.network.name !== "sepolia") {
    throw new Error("This script is intended for Sepolia only.");
  }

  const SMART_DEX_ADAPTER = "0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const ZUSDC = "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C";

  const [deployer] = await hre.ethers.getSigners();
  console.log("Configuring SmartDexAdapter zUSDC route on Sepolia");
  console.log("Deployer:", deployer.address);
  console.log("Adapter:", SMART_DEX_ADAPTER);

  const adapter = await hre.ethers.getContractAt("SmartDexAdapter", SMART_DEX_ADAPTER, deployer);
  const weth = await hre.ethers.getContractAt("IERC20", WETH, deployer);
  const zusdc = await hre.ethers.getContractAt("IERC20", ZUSDC, deployer);

  const [existingWethToUsdc, existingWethToZusdc, existingZusdcToWeth, wethLiquidity, zusdcLiquidity] =
    await Promise.all([
      adapter.getPrice(WETH, USDC),
      adapter.getPrice(WETH, ZUSDC),
      adapter.getPrice(ZUSDC, WETH),
      adapter.liquidity(WETH),
      adapter.liquidity(ZUSDC),
    ]);

  const wethToZusdcPrice =
    existingWethToUsdc > 0n
      ? existingWethToUsdc
      : hre.ethers.parseUnits("2000", 6); // 1 WETH ~= 2000 zUSDC

  console.log("Current state:");
  console.log("  WETH -> USDC price:", existingWethToUsdc.toString());
  console.log("  WETH -> zUSDC price:", existingWethToZusdc.toString());
  console.log("  zUSDC -> WETH price:", existingZusdcToWeth.toString());
  console.log("  WETH liquidity:", hre.ethers.formatEther(wethLiquidity));
  console.log("  zUSDC liquidity:", hre.ethers.formatUnits(zusdcLiquidity, 6));
  console.log("Target WETH -> zUSDC price:", wethToZusdcPrice.toString());

  if (existingWethToZusdc === wethToZusdcPrice) {
    console.log("zUSDC route already configured. Nothing to change.");
    return;
  }

  const tx = await adapter.setPrice(WETH, ZUSDC, wethToZusdcPrice);
  console.log("Submitting setPrice tx:", tx.hash);
  await tx.wait();

  const [updatedWethToZusdc, updatedZusdcToWeth, adapterWethBalance, adapterZusdcBalance] =
    await Promise.all([
      adapter.getPrice(WETH, ZUSDC),
      adapter.getPrice(ZUSDC, WETH),
      weth.balanceOf(SMART_DEX_ADAPTER),
      zusdc.balanceOf(SMART_DEX_ADAPTER),
    ]);

  console.log("Updated state:");
  console.log("  WETH -> zUSDC price:", updatedWethToZusdc.toString());
  console.log("  zUSDC -> WETH price:", updatedZusdcToWeth.toString());
  console.log("  Adapter WETH balance:", hre.ethers.formatEther(adapterWethBalance));
  console.log("  Adapter zUSDC balance:", hre.ethers.formatUnits(adapterZusdcBalance, 6));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
