const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

// Network configuration
const NETWORK_CONFIG = {
  sepolia: {
    chainId: 11155111,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    pyth: '0xDd24F84d36BF92C65F92307595335bdFab5Bbd21', // Sepolia Pyth
    tokens: {
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Sepolia USDC
    },
    dexRouters: {
      uniswapV2: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008'
    }
  },
  amoy: {
    chainId: 80002,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    pyth: '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729',
    tokens: {
      WPOL: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
      LINK: '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
      USDC: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' // Amoy USDC
    },
    dexRouters: {
      quickswapV2: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
    }
  },
  arbitrumSepolia: {
    chainId: 421614,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    pyth: '0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF', // Arbitrum Sepolia Pyth
    tokens: {
      WETH: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
      LINK: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
      USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' // Arbitrum Sepolia USDC
    },
    dexRouters: {
      uniswapV3: '0x101F443B4d1b059569D643917553c771E1b9663E'
    }
  },
  optimismSepolia: {
    chainId: 11155420,
    entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    pyth: '0x0708325268dF9F66270F1401206434524814508b', // Optimism Sepolia Pyth
    tokens: {
      WETH: '0x4200000000000000000000000000000000000006', // Predeploy
      LINK: '0xE4aB69C077896252FAFBD49EFD26B5D171A32410',
      USDC: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7' // Optimism Sepolia USDC
    },
    dexRouters: {
      uniswapV3: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4'
    }
  }
};

// Pyth Price Feed IDs
const PRICE_FEED_IDS = {
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  POL_USD: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
  LINK_USD: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a'
};

async function main() {
  const networkName = hre.network.name;
  console.log(`\n🚀 Deploying ZeroToll to ${networkName.toUpperCase()}...\n`);
  
  const config = NETWORK_CONFIG[networkName];
  if (!config) {
    throw new Error(`Network ${networkName} not configured!`);
  }
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer address:', deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Deployer balance:', hre.ethers.formatEther(balance), 'ETH\n');
  
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  
  // Deployment storage
  const deployment = {
    network: networkName,
    chainId: config.chainId,
    timestamp: Date.now(),
    deployer: deployer.address,
    contracts: {},
    tokens: config.tokens,
    dexRouters: config.dexRouters
  };
  
  // Deploy AssetRegistry
  console.log('📋 Deploying AssetRegistry...');
  const AssetRegistry = await hre.ethers.getContractFactory('AssetRegistry');
  const assetRegistry = await AssetRegistry.deploy();
  await assetRegistry.waitForDeployment();
  deployment.contracts.AssetRegistry = await assetRegistry.getAddress();
  console.log('✅ AssetRegistry:', deployment.contracts.AssetRegistry);
  
  // Deploy TokenValuer
  console.log('\n💰 Deploying TokenValuer...');
  const TokenValuer = await hre.ethers.getContractFactory('TokenValuer');
  const tokenValuer = await TokenValuer.deploy();
  await tokenValuer.waitForDeployment();
  deployment.contracts.TokenValuer = await tokenValuer.getAddress();
  console.log('✅ TokenValuer:', deployment.contracts.TokenValuer);
  
  // Deploy FeeEscrow
  console.log('\n🔒 Deploying FeeEscrow...');
  const FeeEscrow = await hre.ethers.getContractFactory('FeeEscrow');
  const feeEscrow = await FeeEscrow.deploy();
  await feeEscrow.waitForDeployment();
  deployment.contracts.FeeEscrow = await feeEscrow.getAddress();
  console.log('✅ FeeEscrow:', deployment.contracts.FeeEscrow);
  
  // Deploy VaultStableFloat (using USDC as stable asset)
  console.log('\n🏦 Deploying VaultStableFloat...');
  const Vault = await hre.ethers.getContractFactory('VaultStableFloat');
  const vault = await Vault.deploy(config.tokens.USDC, treasury);
  await vault.waitForDeployment();
  deployment.contracts.VaultStableFloat = await vault.getAddress();
  console.log('✅ VaultStableFloat:', deployment.contracts.VaultStableFloat);
  
  // Deploy FeeSink
  console.log('\n💸 Deploying FeeSink...');
  const FeeSink = await hre.ethers.getContractFactory('FeeSink');
  const feeSink = await FeeSink.deploy(deployment.contracts.VaultStableFloat, treasury);
  await feeSink.waitForDeployment();
  deployment.contracts.FeeSink = await feeSink.getAddress();
  console.log('✅ FeeSink:', deployment.contracts.FeeSink);
  
  // Deploy RelayerRegistry
  console.log('\n📡 Deploying RelayerRegistry...');
  const Registry = await hre.ethers.getContractFactory('RelayerRegistry');
  const registry = await Registry.deploy(config.tokens.USDC);
  await registry.waitForDeployment();
  deployment.contracts.RelayerRegistry = await registry.getAddress();
  console.log('✅ RelayerRegistry:', deployment.contracts.RelayerRegistry);
  
  // Deploy RouterHub
  console.log('\n🔀 Deploying RouterHub...');
  const Router = await hre.ethers.getContractFactory('RouterHub');
  const router = await Router.deploy();
  await router.waitForDeployment();
  deployment.contracts.RouterHub = await router.getAddress();
  console.log('✅ RouterHub:', deployment.contracts.RouterHub);
  
  // Deploy SettlementHub
  console.log('\n⚖️ Deploying SettlementHub...');
  const Settlement = await hre.ethers.getContractFactory('SettlementHub');
  const settlement = await Settlement.deploy(deployment.contracts.VaultStableFloat);
  await settlement.waitForDeployment();
  deployment.contracts.SettlementHub = await settlement.getAddress();
  console.log('✅ SettlementHub:', deployment.contracts.SettlementHub);
  
  // Deploy ZeroTollPaymaster
  console.log('\n💳 Deploying ZeroTollPaymaster...');
  const Paymaster = await hre.ethers.getContractFactory('ZeroTollPaymaster');
  const paymaster = await Paymaster.deploy(
    config.entryPoint,
    deployment.contracts.AssetRegistry,
    deployment.contracts.TokenValuer,
    deployment.contracts.FeeEscrow,
    treasury
  );
  await paymaster.waitForDeployment();
  deployment.contracts.ZeroTollPaymaster = await paymaster.getAddress();
  console.log('✅ ZeroTollPaymaster:', deployment.contracts.ZeroTollPaymaster);
  
  // Configure AssetRegistry with native tokens
  console.log('\n⚙️ Configuring AssetRegistry...');
  
  // Register USDC
  console.log('Registering USDC...');
  await assetRegistry.registerAsset(
    'USDC', 
    config.tokens.USDC, 
    6, // decimals
    true, // isActive
    true, // isAcceptedFeeToken
    false, // requiresPermit
    false, // supportsEIP2612
    'chainlink', // oracleType
    50000, // maxSlippage (5%)
    true, // canBridgeToL1
    true, // canBridgeToL2
    true, // canSwap
    true  // isStable
  );
  
  // Register LINK
  console.log('Registering LINK...');
  await assetRegistry.registerAsset(
    'LINK',
    config.tokens.LINK,
    18,
    true,
    true,
    false,
    false,
    'chainlink',
    50000,
    true,
    true,
    true,
    false
  );
  
  // Register wrapped native token (WETH/WPOL)
  const nativeSymbol = networkName === 'amoy' ? 'WPOL' : 'WETH';
  const nativeAddress = networkName === 'amoy' ? config.tokens.WPOL : config.tokens.WETH;
  console.log(`Registering ${nativeSymbol}...`);
  await assetRegistry.registerAsset(
    nativeSymbol,
    nativeAddress,
    18,
    true,
    true,
    false,
    false,
    'chainlink',
    50000,
    true,
    true,
    true,
    false
  );
  
  // Set oracles for tokens (using Pyth)
  console.log('\n🔮 Deploying Pyth Price Oracles...');
  const PythOracle = await hre.ethers.getContractFactory('PythPriceOracle');
  
  // USDC Oracle
  const usdcOracle = await PythOracle.deploy(config.pyth, PRICE_FEED_IDS.USDC_USD, 18);
  await usdcOracle.waitForDeployment();
  deployment.contracts.USDCOracle = await usdcOracle.getAddress();
  console.log('USDC Oracle:', deployment.contracts.USDCOracle);
  await tokenValuer.setOracle(config.tokens.USDC, deployment.contracts.USDCOracle);
  
  // Native token Oracle (ETH or POL)
  const nativeFeedId = networkName === 'amoy' ? PRICE_FEED_IDS.POL_USD : PRICE_FEED_IDS.ETH_USD;
  const nativeOracle = await PythOracle.deploy(config.pyth, nativeFeedId, 18);
  await nativeOracle.waitForDeployment();
  deployment.contracts[`${nativeSymbol}Oracle`] = await nativeOracle.getAddress();
  console.log(`${nativeSymbol} Oracle:`, deployment.contracts[`${nativeSymbol}Oracle`]);
  await tokenValuer.setOracle(nativeAddress, deployment.contracts[`${nativeSymbol}Oracle`]);
  
  // LINK Oracle
  const linkOracle = await PythOracle.deploy(config.pyth, PRICE_FEED_IDS.LINK_USD, 18);
  await linkOracle.waitForDeployment();
  deployment.contracts.LINKOracle = await linkOracle.getAddress();
  console.log('LINK Oracle:', deployment.contracts.LINKOracle);
  await tokenValuer.setOracle(config.tokens.LINK, deployment.contracts.LINKOracle);
  
  // Set native wrapped token in RouterHub
  console.log('\n🔧 Configuring RouterHub...');
  await router.setNativeWrapped(nativeAddress);
  console.log(`Set native wrapped token to ${nativeSymbol}`);
  
  // Save deployment info
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentsDir, `${networkName}-${deployment.timestamp}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
  console.log('\n📄 Deployment info saved to:', deploymentFile);
  
  // Also save as latest
  const latestFile = path.join(deploymentsDir, `${networkName}-latest.json`);
  fs.writeFileSync(latestFile, JSON.stringify(deployment, null, 2));
  
  console.log('\n✨ Deployment complete!\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('DEPLOYED CONTRACTS:');
  console.log('═══════════════════════════════════════════════════════');
  Object.entries(deployment.contracts).forEach(([name, address]) => {
    console.log(`${name.padEnd(25)} ${address}`);
  });
  console.log('═══════════════════════════════════════════════════════');
  
  console.log('\n📝 Next steps:');
  console.log('1. Verify contracts on block explorer');
  console.log('2. Update frontend config with new addresses');
  console.log('3. Update backend config with new addresses');
  console.log('4. Fund VaultStableFloat with USDC');
  console.log('5. Test swap functionality\n');
  
  return deployment;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
