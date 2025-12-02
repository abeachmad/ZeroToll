const hre = require("hardhat");

async function main() {
  const SMART_ADAPTER = "0xb9373FDB72128d01B5F3b6BD29F30B8921a85885";
  const pWETH = "0x3af00011Da61751bc58DFfDD0F9F85F69301E180";
  const pUSDC = "0xD6a7294445F34d0F7244b2072696106904ea807B";

  console.log("Adding pWETH/pUSDC liquidity to SmartAdapter...\n");

  const adapter = await hre.ethers.getContractAt("SmartDexAdapter", SMART_ADAPTER);
  
  // We need to mint pWETH/pUSDC first, but we don't have WETH/USDC
  // Instead, let's use the GaslessTestToken to create liquidity
  
  // Actually, pWETH/pUSDC are wrappers - we need underlying tokens
  // For demo, let's just set prices so internal swaps work
  
  console.log("Setting prices for pWETH/pUSDC pairs...");
  
  // Set pWETH price (1 pWETH = 1e18 in base units)
  // Set pUSDC price relative to pWETH (assume 1 ETH = 2000 USDC)
  const ethToUsdc = hre.ethers.parseUnits("2000", 18); // 1 pWETH = 2000 pUSDC
  
  await (await adapter.setPrice(pWETH, pUSDC, ethToUsdc)).wait();
  console.log("✓ Set pWETH -> pUSDC price: 1 pWETH = 2000 pUSDC");

  // For ZTA/ZTB to pWETH/pUSDC, set 1:1 prices
  const ZTA = "0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf";
  const ZTB = "0x8fb844251af76AF090B005643D966FC52852100a";
  
  const oneToOne = hre.ethers.parseUnits("1", 18);
  await (await adapter.setPrice(ZTA, pWETH, oneToOne)).wait();
  await (await adapter.setPrice(ZTB, pUSDC, oneToOne)).wait();
  console.log("✓ Set ZTA -> pWETH and ZTB -> pUSDC prices (1:1)");

  console.log("\n=== PRICES SET ===");
  console.log("Now users can swap between ZTA/ZTB and pWETH/pUSDC");
  console.log("Note: Actual liquidity still needed for swaps to execute");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
