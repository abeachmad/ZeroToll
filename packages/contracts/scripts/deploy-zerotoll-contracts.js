/**
 * Deploy Wave-3 Enhanced Contracts (DEX & Bridge Adapters, FeeVault, FeeRebalancer)
 * 
 * Usage:
 * npx hardhat run scripts/deploy-wave3-enhancements.js --network sepolia
 * npx hardhat run scripts/deploy-wave3-enhancements.js --network amoy
 * npx hardhat run scripts/deploy-wave3-enhancements.js --network arbitrumSepolia
 * npx hardhat run scripts/deploy-wave3-enhancements.js --network optimismSepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Network-specific configurations
const NETWORK_CONFIG = {
  sepolia: {
    chainId: 11155111,
    wrapped: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // WETH
    usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    uniswapV2Router: "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008",
    uniswapV3Router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
    uniswapV3Factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    uniswapV3Quoter: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",
  },
  amoy: {
    chainId: 80002,
    wrapped: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", // WPOL
    usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    quickswapRouter: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap V2
  },
  arbitrumSepolia: {
    chainId: 421614,
    wrapped: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    uniswapV3Router: "0x101F443B4d1b059569D643917553c771E1b9663E",
    uniswapV3Factory: "0x248AB79Bbb9bC29bB72f7Cd42F17e054Fc40188e",
    uniswapV3Quoter: "0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0B",
  },
  optimismSepolia: {
    chainId: 11155420,
    wrapped: "0x4200000000000000000000000000000000000006", // WETH
    usdc: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    uniswapV3Router: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    uniswapV3Factory: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    uniswapV3Quoter: "0xC5290058841028F1614F3A6F0F5816cAd0df5E27",
  },
};

async function main() {
  const networkName = hre.network.name;
  console.log(`\n🚀 Deploying Wave-3 Enhancements to ${networkName}...\n`);

  const config = NETWORK_CONFIG[networkName];
  if (!config) {
    throw new Error(`Network ${networkName} not configured`);
  }

  // Load existing deployment
  const latestFile = path.join(__dirname, "../deployments", `${networkName}-latest.json`);
  if (!fs.existsSync(latestFile)) {
    throw new Error(`No existing deployment found for ${networkName}. Run deploy-all-testnets.js first.`);
  }
  const existingDeployment = JSON.parse(fs.readFileSync(latestFile, "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH\n`);

  const deployments = {};

  // 1. Deploy DEX Adapters
  console.log("📦 1. Deploying DEX Adapters...");

  // Uniswap V2 Adapter (Sepolia, Amoy via QuickSwap)
  if (config.uniswapV2Router || config.quickswapRouter) {
    const UniswapV2Adapter = await hre.ethers.getContractFactory("UniswapV2Adapter");
    const routerAddr = config.uniswapV2Router || config.quickswapRouter;
    const protocolName = config.quickswapRouter ? "QuickSwap V2" : "Uniswap V2";
    
    console.log(`  Deploying ${protocolName} Adapter...`);
    const uniV2Adapter = await UniswapV2Adapter.deploy(routerAddr, protocolName);
    await uniV2Adapter.waitForDeployment();
    deployments.uniswapV2Adapter = await uniV2Adapter.getAddress();
    console.log(`  ✅ ${protocolName} Adapter: ${deployments.uniswapV2Adapter}`);
  }

  // Uniswap V3 Adapter
  if (config.uniswapV3Router) {
    console.log(`  Deploying Uniswap V3 Adapter...`);
    const UniswapV3Adapter = await hre.ethers.getContractFactory("UniswapV3Adapter");
    const uniV3Adapter = await UniswapV3Adapter.deploy(
      config.uniswapV3Router,
      config.uniswapV3Quoter,
      config.uniswapV3Factory
    );
    await uniV3Adapter.waitForDeployment();
    deployments.uniswapV3Adapter = await uniV3Adapter.getAddress();
    console.log(`  ✅ Uniswap V3 Adapter: ${deployments.uniswapV3Adapter}`);
  }

  // Mock DEX Adapter (uses existing TokenValuer as price oracle)
  console.log(`  Deploying MockDEX Adapter...`);
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const mockDexAdapter = await MockDEXAdapter.deploy(existingDeployment.contracts.TokenValuer);
  await mockDexAdapter.waitForDeployment();
  deployments.mockDEXAdapter = await mockDexAdapter.getAddress();
  console.log(`  ✅ MockDEX Adapter: ${deployments.mockDEXAdapter}\n`);

  // 2. Deploy Bridge Adapters
  console.log("📦 2. Deploying Bridge Adapters...");

  console.log(`  Deploying MockBridge Adapter...`);
  const MockBridgeAdapter = await hre.ethers.getContractFactory("MockBridgeAdapter");
  const mockBridgeAdapter = await MockBridgeAdapter.deploy();
  await mockBridgeAdapter.waitForDeployment();
  deployments.mockBridgeAdapter = await mockBridgeAdapter.getAddress();
  console.log(`  ✅ MockBridge Adapter: ${deployments.mockBridgeAdapter}\n`);

  // 3. Deploy FeeVault4626
  console.log("📦 3. Deploying FeeVault4626...");

  const treasury = existingDeployment.contracts.VaultStableFloat || deployer.address; // Reuse existing vault or deployer

  const FeeVault4626 = await hre.ethers.getContractFactory("FeeVault4626");
  const feeVault = await FeeVault4626.deploy(
    config.usdc,
    `ZeroToll Vault USDC`,
    `ztUSDC`,
    treasury
  );
  await feeVault.waitForDeployment();
  deployments.feeVault = await feeVault.getAddress();
  console.log(`  ✅ FeeVault4626: ${deployments.feeVault}`);
  console.log(`    ↳ Asset: ${config.usdc}`);
  console.log(`    ↳ Treasury: ${treasury}\n`);

  // 4. Deploy FeeRebalancer
  console.log("📦 4. Deploying FeeRebalancer...");

  const FeeRebalancer = await hre.ethers.getContractFactory("FeeRebalancer");
  const feeRebalancer = await FeeRebalancer.deploy(
    existingDeployment.contracts.FeeSink,
    deployments.feeVault,
    config.usdc
  );
  await feeRebalancer.waitForDeployment();
  deployments.feeRebalancer = await feeRebalancer.getAddress();
  console.log(`  ✅ FeeRebalancer: ${deployments.feeRebalancer}\n`);

  // 5. Configure FeeVault
  console.log("⚙️  5. Configuring FeeVault...");
  await feeVault.setFeeCollector(deployments.feeRebalancer);
  console.log(`  ✅ Set FeeRebalancer as fee collector\n`);

  // 6. Configure RouterHub with new adapters
  console.log("⚙️  6. Configuring RouterHub...");

  const routerHub = await hre.ethers.getContractAt("RouterHub", existingDeployment.contracts.RouterHub);

  if (deployments.uniswapV2Adapter) {
    await routerHub.whitelistAdapter(deployments.uniswapV2Adapter, true);
    console.log(`  ✅ Whitelisted UniswapV2 Adapter`);
  }

  if (deployments.uniswapV3Adapter) {
    await routerHub.whitelistAdapter(deployments.uniswapV3Adapter, true);
    console.log(`  ✅ Whitelisted UniswapV3 Adapter`);
  }

  await routerHub.whitelistAdapter(deployments.mockDEXAdapter, true);
  console.log(`  ✅ Whitelisted MockDEX Adapter`);

  await routerHub.whitelistAdapter(deployments.mockBridgeAdapter, true);
  console.log(`  ✅ Whitelisted MockBridge Adapter\n`);

  // 7. Save deployment
  console.log("📝 7. Saving deployment artifacts...");

  const wave3Deployment = {
    network: networkName,
    chainId: config.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ...existingDeployment.contracts,
      ...deployments,
    },
    config: config,
  };

  const deploymentFile = path.join(__dirname, "../deployments", `${networkName}-wave3-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(wave3Deployment, null, 2));

  // Update latest
  fs.writeFileSync(latestFile, JSON.stringify(wave3Deployment, null, 2));

  console.log(`  ✅ Saved to: ${deploymentFile}\n`);

  // 8. Summary
  console.log("=".repeat(70));
  console.log("🎉 WAVE-3 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(70));
  console.log(`Network: ${networkName} (Chain ID: ${config.chainId})`);
  console.log(`\n📊 NEW Contracts:`);
  console.log(`  FeeVault4626:     ${deployments.feeVault}`);
  console.log(`  FeeRebalancer:    ${deployments.feeRebalancer}`);
  if (deployments.uniswapV2Adapter) {
    console.log(`  Uniswap V2 Adapter: ${deployments.uniswapV2Adapter}`);
  }
  if (deployments.uniswapV3Adapter) {
    console.log(`  Uniswap V3 Adapter: ${deployments.uniswapV3Adapter}`);
  }
  console.log(`  MockDEX Adapter:  ${deployments.mockDEXAdapter}`);
  console.log(`  MockBridge Adapter: ${deployments.mockBridgeAdapter}`);

  console.log(`\n⚠️  Next Steps:`);
  console.log(`  1. Verify contracts: npx hardhat verify --network ${networkName} <address>`);
  console.log(`  2. Configure FeeRebalancer adapters (setAdapter for each token)`);
  console.log(`  3. Fund MockDEX adapter with test tokens (if using)`);
  console.log(`  4. Update frontend config with FeeVault address`);
  console.log(`  5. Deploy AI route service`);
  console.log(`  6. Update subgraph with new contract addresses`);
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
