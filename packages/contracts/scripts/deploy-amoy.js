const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('Deploying ZeroToll to Polygon Amoy with Any-Token Fee Mode...');
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  const entryPoint = process.env.ENTRYPOINT_AMOY || '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  
  // Deploy mock tokens
  const MockERC20 = await hre.ethers.getContractFactory('MockERC20Permit');
  
  console.log('Deploying mock tokens...');
  const usdc = await MockERC20.deploy('Mock USDC', 'USDC', 6);
  await usdc.waitForDeployment();
  console.log('USDC:', await usdc.getAddress());
  
  const wbtc = await MockERC20.deploy('Wrapped Bitcoin', 'WBTC', 8);
  await wbtc.waitForDeployment();
  console.log('WBTC:', await wbtc.getAddress());
  
  const wavax = await MockERC20.deploy('Wrapped AVAX', 'WAVAX', 18);
  await wavax.waitForDeployment();
  console.log('WAVAX:', await wavax.getAddress());
  
  const wdoge = await MockERC20.deploy('Wrapped DOGE', 'wDOGE', 18);
  await wdoge.waitForDeployment();
  console.log('wDOGE:', await wdoge.getAddress());
  
  const watom = await MockERC20.deploy('Wrapped ATOM', 'WATOM', 6);
  await watom.waitForDeployment();
  console.log('WATOM:', await watom.getAddress());
  
  const wpepe = await MockERC20.deploy('Wrapped PEPE', 'WPEPE', 18);
  await wpepe.waitForDeployment();
  console.log('WPEPE:', await wpepe.getAddress());
  
  const wton = await MockERC20.deploy('Wrapped TON', 'WTON', 9);
  await wton.waitForDeployment();
  console.log('WTON:', await wton.getAddress());
  
  const wbnb = await MockERC20.deploy('Wrapped BNB', 'WBNB', 18);
  await wbnb.waitForDeployment();
  console.log('WBNB:', await wbnb.getAddress());
  
  // Deploy oracles
  const MockOracle = await hre.ethers.getContractFactory('MockPriceOracle');
  const usdcOracle = await MockOracle.deploy(hre.ethers.parseEther('1.0')); // 1 POL = 1 USDC
  await usdcOracle.waitForDeployment();
  
  const wbtcOracle = await MockOracle.deploy(hre.ethers.parseEther('50000')); // 1 WBTC = 50k USDC
  await wbtcOracle.waitForDeployment();
  
  const wavaxOracle = await MockOracle.deploy(hre.ethers.parseEther('30')); // 1 WAVAX = 30 USDC
  await wavaxOracle.waitForDeployment();
  
  console.log('Oracles deployed');
  
  // Deploy AssetRegistry
  const AssetRegistry = await hre.ethers.getContractFactory('AssetRegistry');
  const assetRegistry = await AssetRegistry.deploy();
  await assetRegistry.waitForDeployment();
  console.log('AssetRegistry:', await assetRegistry.getAddress());
  
  // Deploy TokenValuer
  const TokenValuer = await hre.ethers.getContractFactory('TokenValuer');
  const tokenValuer = await TokenValuer.deploy();
  await tokenValuer.waitForDeployment();
  console.log('TokenValuer:', await tokenValuer.getAddress());
  
  // Deploy FeeEscrow
  const FeeEscrow = await hre.ethers.getContractFactory('FeeEscrow');
  const feeEscrow = await FeeEscrow.deploy();
  await feeEscrow.waitForDeployment();
  console.log('FeeEscrow:', await feeEscrow.getAddress());
  
  // Deploy VaultStableFloat
  const Vault = await hre.ethers.getContractFactory('VaultStableFloat');
  const vault = await Vault.deploy(await usdc.getAddress(), treasury);
  await vault.waitForDeployment();
  console.log('VaultStableFloat:', await vault.getAddress());
  
  // Deploy FeeSink
  const FeeSink = await hre.ethers.getContractFactory('FeeSink');
  const feeSink = await FeeSink.deploy(await vault.getAddress(), treasury);
  await feeSink.waitForDeployment();
  console.log('FeeSink:', await feeSink.getAddress());
  
  // Deploy RelayerRegistry
  const Registry = await hre.ethers.getContractFactory('RelayerRegistry');
  const registry = await Registry.deploy(await usdc.getAddress());
  await registry.waitForDeployment();
  console.log('RelayerRegistry:', await registry.getAddress());
  
  // Deploy RouterHub
  const Router = await hre.ethers.getContractFactory('RouterHub');
  const router = await Router.deploy();
  await router.waitForDeployment();
  console.log('RouterHub:', await router.getAddress());
  
  // Deploy SettlementHub
  const Settlement = await hre.ethers.getContractFactory('SettlementHub');
  const settlement = await Settlement.deploy(await vault.getAddress());
  await settlement.waitForDeployment();
  console.log('SettlementHub:', await settlement.getAddress());
  
  // Deploy Paymaster
  const Paymaster = await hre.ethers.getContractFactory('ZeroTollPaymaster');
  const paymaster = await Paymaster.deploy(
    entryPoint,
    await assetRegistry.getAddress(),
    await tokenValuer.getAddress(),
    await feeEscrow.getAddress(),
    treasury
  );
  await paymaster.waitForDeployment();
  console.log('ZeroTollPaymaster:', await paymaster.getAddress());
  
  // Deploy MockBridgeAdapter
  const Bridge = await hre.ethers.getContractFactory('MockBridgeAdapter');
  const bridge = await Bridge.deploy();
  await bridge.waitForDeployment();
  console.log('MockBridgeAdapter:', await bridge.getAddress());
  
  // Configure AssetRegistry
  console.log('Configuring AssetRegistry...');
  await assetRegistry.registerAsset(
    'USDC', await usdc.getAddress(), 6, true, true, false, false,
    'chainlink', 50000, true, true, true, true
  );
  await assetRegistry.registerAsset(
    'WBTC', await wbtc.getAddress(), 8, true, true, false, false,
    'chainlink', 50000, false, true, true, false
  );
  await assetRegistry.registerAsset(
    'WAVAX', await wavax.getAddress(), 18, true, true, false, false,
    'twap', 30000, false, true, true, false
  );
  await assetRegistry.registerAsset(
    'wDOGE', await wdoge.getAddress(), 18, true, false, false, false,
    'twap', 30000, false, true, true, false
  );
  await assetRegistry.registerAsset(
    'WATOM', await watom.getAddress(), 6, true, true, false, false,
    'twap', 30000, false, true, true, false
  );
  await assetRegistry.registerAsset(
    'WPEPE', await wpepe.getAddress(), 18, true, false, false, false,
    'twap', 20000, false, true, true, false
  );
  await assetRegistry.registerAsset(
    'WTON', await wton.getAddress(), 9, true, false, false, false,
    'twap', 30000, false, true, true, false
  );
  await assetRegistry.registerAsset(
    'WBNB', await wbnb.getAddress(), 18, true, true, false, false,
    'twap', 30000, false, true, true, false
  );
  
  // Configure TokenValuer oracles
  console.log('Configuring TokenValuer...');
  await tokenValuer.setOracle(await usdc.getAddress(), await usdcOracle.getAddress(), await usdcOracle.getAddress());
  await tokenValuer.setOracle(await wbtc.getAddress(), await wbtcOracle.getAddress(), await wbtcOracle.getAddress());
  await tokenValuer.setOracle(await wavax.getAddress(), await wavaxOracle.getAddress(), await wavaxOracle.getAddress());
  
  // Transfer ownership to paymaster
  await feeEscrow.transferOwnership(await paymaster.getAddress());
  await feeSink.transferOwnership(await router.getAddress());
  
  // Whitelist bridge adapter
  await router.whitelistAdapter(await bridge.getAddress(), true);
  console.log('Bridge adapter whitelisted');
  
  const deployments = {
    chainId: 80002,
    network: 'amoy',
    entryPoint,
    treasury,
    tokens: {
      USDC: await usdc.getAddress(),
      WBTC: await wbtc.getAddress(),
      WAVAX: await wavax.getAddress(),
      wDOGE: await wdoge.getAddress(),
      WATOM: await watom.getAddress(),
      WPEPE: await wpepe.getAddress(),
      WTON: await wton.getAddress(),
      WBNB: await wbnb.getAddress()
    },
    oracles: {
      USDC: await usdcOracle.getAddress(),
      WBTC: await wbtcOracle.getAddress(),
      WAVAX: await wavaxOracle.getAddress()
    },
    contracts: {
      assetRegistry: await assetRegistry.getAddress(),
      tokenValuer: await tokenValuer.getAddress(),
      feeEscrow: await feeEscrow.getAddress(),
      feeSink: await feeSink.getAddress(),
      vault: await vault.getAddress(),
      registry: await registry.getAddress(),
      router: await router.getAddress(),
      settlement: await settlement.getAddress(),
      paymaster: await paymaster.getAddress(),
      bridge: await bridge.getAddress()
    }
  };
  
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'amoy.json'),
    JSON.stringify(deployments, null, 2)
  );
  
  console.log('\n✅ Deployment complete! Addresses saved to deployments/amoy.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
