const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Deploy MultiTokenPythOracle to Polygon Amoy
 * 
 * This script deploys ONLY the Pyth oracle for existing ZeroToll deployment
 * No hardcoded prices - all prices fetched from Pyth Network on-chain
 */

async function main() {
  console.log('🚀 Deploying Pyth Oracle to Polygon Amoy...\n');
  
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log('📋 Deployment Info:');
  console.log('  Deployer:', deployer.address);
  console.log('  Balance:', hre.ethers.formatEther(balance), 'POL');
  console.log('  Network:', hre.network.name);
  console.log('  Chain ID:', (await hre.ethers.provider.getNetwork()).chainId);
  console.log('');
  
  // Pyth contract on Amoy
  const PYTH_AMOY = '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729';
  
  // Official Pyth Price Feed IDs
  // Source: https://www.pyth.network/developers/price-feed-ids
  const PRICE_FEED_IDS = {
    // Crypto.POL/USD - Polygon Ecosystem Token (formerly MATIC)
    POL_USD: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
    
    // Crypto.USDC/USD - USD Coin
    USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    
    // Crypto.USDT/USD - Tether
    USDT_USD: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
    
    // Crypto.DAI/USD - Dai Stablecoin
    DAI_USD: '0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd',
    
    // Crypto.ETH/USD - Ethereum
    ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    
    // Crypto.WETH/USD - Wrapped Ethereum (same as ETH)
    WETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    
    // Crypto.LINK/USD - Chainlink
    LINK_USD: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
    
    // Crypto.ARB/USD - Arbitrum
    ARB_USD: '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
    
    // Crypto.OP/USD - Optimism
    OP_USD: '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
  };
  
  console.log('📡 Pyth Price Feed IDs:');
  for (const [symbol, feedId] of Object.entries(PRICE_FEED_IDS)) {
    console.log(`  ${symbol.padEnd(12)} ${feedId}`);
  }
  console.log('');
  
  // Get token addresses from existing deployment
  const configPath = path.join(__dirname, '../../../config/asset-registry.amoy.json');
  let tokenAddresses = {};
  
  if (fs.existsSync(configPath)) {
    console.log('📖 Reading token addresses from config...');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Extract token addresses from config
    if (config.tokens) {
      for (const token of config.tokens) {
        if (token.symbol && token.address) {
          tokenAddresses[token.symbol] = token.address;
          console.log(`  ${token.symbol}: ${token.address}`);
        }
      }
    }
    console.log('');
  } else {
    console.log('⚠️  Config file not found, will use manual addresses');
    console.log('');
  }
  
  // Deploy MultiTokenPythOracle
  console.log('📦 Deploying MultiTokenPythOracle...');
  const MultiTokenPythOracle = await hre.ethers.getContractFactory('MultiTokenPythOracle');
  
  const oracle = await MultiTokenPythOracle.deploy(PYTH_AMOY);
  await oracle.waitForDeployment();
  
  const oracleAddress = await oracle.getAddress();
  console.log('✅ MultiTokenPythOracle deployed:', oracleAddress);
  console.log('');
  
  // Configure price feeds for tokens
  console.log('⚙️  Configuring price feeds...');
  
  // Map token addresses to price feed IDs
  const tokenConfigs = [
    { symbol: 'WPOL', feedId: PRICE_FEED_IDS.POL_USD, decimals: 18 },
    { symbol: 'WMATIC', feedId: PRICE_FEED_IDS.POL_USD, decimals: 18 },
    { symbol: 'POL', feedId: PRICE_FEED_IDS.POL_USD, decimals: 18 },
    { symbol: 'USDC', feedId: PRICE_FEED_IDS.USDC_USD, decimals: 6 },
    { symbol: 'USDT', feedId: PRICE_FEED_IDS.USDT_USD, decimals: 6 },
    { symbol: 'DAI', feedId: PRICE_FEED_IDS.DAI_USD, decimals: 18 },
    { symbol: 'WETH', feedId: PRICE_FEED_IDS.WETH_USD, decimals: 18 },
    { symbol: 'ETH', feedId: PRICE_FEED_IDS.ETH_USD, decimals: 18 },
    { symbol: 'LINK', feedId: PRICE_FEED_IDS.LINK_USD, decimals: 18 },
    { symbol: 'ARB', feedId: PRICE_FEED_IDS.ARB_USD, decimals: 18 },
    { symbol: 'OP', feedId: PRICE_FEED_IDS.OP_USD, decimals: 18 },
  ];
  
  for (const config of tokenConfigs) {
    const tokenAddr = tokenAddresses[config.symbol];
    if (tokenAddr) {
      try {
        console.log(`  Setting ${config.symbol} (${tokenAddr})...`);
        const tx = await oracle.setPriceFeed(tokenAddr, config.feedId);
        await tx.wait();
        console.log(`  ✅ ${config.symbol} configured`);
      } catch (error) {
        console.log(`  ⚠️  ${config.symbol} failed: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  ${config.symbol} - no address found in config`);
    }
  }
  console.log('');
  
  // Test oracle with sample token
  console.log('🧪 Testing oracle...');
  if (tokenAddresses['WMATIC'] || tokenAddresses['WPOL']) {
    const testToken = tokenAddresses['WMATIC'] || tokenAddresses['WPOL'];
    const testSymbol = tokenAddresses['WMATIC'] ? 'WMATIC' : 'WPOL';
    
    try {
      console.log(`  Fetching price for ${testSymbol} (${testToken})...`);
      
      // Get price with update data (empty for testnet)
      const updateData = [];
      const updateFee = await oracle.getUpdateFee(updateData);
      
      const price = await oracle.getPrice(testToken, { value: updateFee });
      const priceFormatted = Number(price) / 1e8;
      
      console.log(`  ✅ ${testSymbol} Price: $${priceFormatted.toFixed(4)}`);
      console.log(`  Raw value: ${price.toString()} (8 decimals)`);
    } catch (error) {
      console.log(`  ⚠️  Price fetch failed: ${error.message}`);
      console.log(`  This is normal if Pyth oracle doesn't have recent price updates`);
    }
  }
  console.log('');
  
  // Save deployment info
  const deploymentInfo = {
    network: 'amoy',
    chainId: 80002,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      pythContract: PYTH_AMOY,
      oracle: oracleAddress,
    },
    priceFeedIds: PRICE_FEED_IDS,
    configuredTokens: Object.keys(tokenAddresses),
  };
  
  const deploymentPath = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }
  
  const filename = `amoy-pyth-oracle-${Date.now()}.json`;
  const filepath = path.join(deploymentPath, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('💾 Deployment info saved to:', filename);
  console.log('');
  
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('');
  console.log('📋 Summary:');
  console.log('  Oracle Address:', oracleAddress);
  console.log('  Pyth Contract:', PYTH_AMOY);
  console.log('  Configured Tokens:', Object.keys(tokenAddresses).join(', ') || 'None');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('  1. Update backend .env:');
  console.log(`     AMOY_PYTH_ORACLE=${oracleAddress}`);
  console.log('');
  console.log('  2. Deploy new adapter with this oracle:');
  console.log('     npx hardhat run scripts/deploy-adapter-amoy-pyth.js --network amoy');
  console.log('');
  console.log('  3. Update frontend config with new adapter address');
  console.log('');
  console.log('🚫 NO MORE HARDCODED PRICES! All prices fetched from Pyth Network on-chain.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
