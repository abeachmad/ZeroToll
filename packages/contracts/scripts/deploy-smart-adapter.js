const hre = require("hardhat");

async function main() {
  const ROUTER = "0xd475255Ae38C92404f9740A19F93B8D2526A684b";
  
  // Test tokens
  const ZTA = "0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf";
  const ZTB = "0x8fb844251af76AF090B005643D966FC52852100a";
  
  // Real tokens on Sepolia
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  console.log("Deploying SmartDexAdapter...\n");

  const SmartDexAdapter = await hre.ethers.getContractFactory("SmartDexAdapter");
  const adapter = await SmartDexAdapter.deploy();
  await adapter.waitForDeployment();
  const adapterAddr = await adapter.getAddress();
  console.log("SmartDexAdapter:", adapterAddr);

  await adapter.deploymentTransaction().wait(2);

  // Add ZTA/ZTB liquidity
  console.log("\nAdding ZTA/ZTB liquidity...");
  const GaslessTestToken = await hre.ethers.getContractFactory("GaslessTestToken");
  const zta = GaslessTestToken.attach(ZTA);
  const ztb = GaslessTestToken.attach(ZTB);
  
  const liquidityAmount = hre.ethers.parseEther("100000"); // 100k tokens
  
  // Mint to deployer first
  await (await zta.mint(await (await hre.ethers.getSigners())[0].getAddress(), liquidityAmount)).wait();
  await (await ztb.mint(await (await hre.ethers.getSigners())[0].getAddress(), liquidityAmount)).wait();
  
  // Approve and add liquidity
  await (await zta.approve(adapterAddr, liquidityAmount)).wait();
  await (await ztb.approve(adapterAddr, liquidityAmount)).wait();
  await (await adapter.addLiquidity(ZTA, liquidityAmount)).wait();
  await (await adapter.addLiquidity(ZTB, liquidityAmount)).wait();
  console.log("✓ Added 100k ZTA and 100k ZTB liquidity");

  // Set adapter on router
  console.log("\nSetting adapter on router...");
  const router = await hre.ethers.getContractAt("ZeroTollRouterV2", ROUTER);
  await (await router.setDexAdapter(adapterAddr)).wait();
  await (await router.setTestMode(false)).wait();
  console.log("✓ Router configured with SmartDexAdapter");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("SmartDexAdapter:", adapterAddr);
  console.log("Router:", ROUTER);
  console.log("\nRouting:");
  console.log("  - WETH/USDC: Uniswap V3");
  console.log("  - ZTA/ZTB: Internal liquidity pool");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
