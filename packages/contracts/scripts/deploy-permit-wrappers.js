const hre = require("hardhat");

async function main() {
  // Sepolia token addresses
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const ROUTER = "0xd475255Ae38C92404f9740A19F93B8D2526A684b";
  const SMART_ADAPTER = "0xb9373FDB72128d01B5F3b6BD29F30B8921a85885";

  console.log("Deploying Permit Wrappers...\n");

  // Deploy pWETH
  const PermitWETH = await hre.ethers.getContractFactory("PermitWETH");
  const pWETH = await PermitWETH.deploy(WETH);
  await pWETH.waitForDeployment();
  const pWETHAddr = await pWETH.getAddress();
  console.log("pWETH (Permit WETH):", pWETHAddr);

  // Deploy pUSDC
  const PermitUSDC = await hre.ethers.getContractFactory("PermitUSDC");
  const pUSDC = await PermitUSDC.deploy(USDC);
  await pUSDC.waitForDeployment();
  const pUSDCAddr = await pUSDC.getAddress();
  console.log("pUSDC (Permit USDC):", pUSDCAddr);

  await pWETH.deploymentTransaction().wait(2);
  await pUSDC.deploymentTransaction().wait(2);

  // Add liquidity to SmartAdapter for pWETH/pUSDC
  console.log("\nNote: To enable pWETH/pUSDC swaps, add liquidity to SmartAdapter");
  console.log("Or set prices in SmartAdapter for these pairs");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("pWETH:", pWETHAddr);
  console.log("pUSDC:", pUSDCAddr);
  console.log("\nHow to use:");
  console.log("1. User wraps WETH -> pWETH (one-time gas)");
  console.log("2. User swaps pWETH -> pUSDC (gasless via Permit!)");
  console.log("3. User unwraps pUSDC -> USDC (one-time gas)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
