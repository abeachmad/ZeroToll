const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Deploy MockDEXAdapter with Pyth Oracle to Polygon Amoy
 * 
 * This deploys a new adapter pointing to the Pyth oracle
 * Replaces old adapter with 0x0000...0001 mock oracle
 */

async function main() {
  console.log('🚀 Deploying MockDEXAdapter with Pyth Oracle to Amoy...\n');
  
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  
  console.log('📋 Deployment Info:');
  console.log('  Deployer:', deployer.address);
  console.log('  Balance:', hre.ethers.formatEther(balance), 'POL');
  console.log('');
  
  // Get deployed Pyth oracle address
  const PYTH_ORACLE = '0x88eb5eEACEF27C3B824fC891b4C37C819332d0b1'; // From previous deployment
  const ROUTER_HUB = '0x5335f887E69F4B920bb037062382B9C17aA52ec6'; // Existing RouterHub
  
  console.log('📡 Using Contracts:');
  console.log('  Pyth Oracle:', PYTH_ORACLE);
  console.log('  RouterHub:', ROUTER_HUB);
  console.log('');
  
  // Get WMATIC/WPOL address from native wrapper or use known testnet address
  // Polygon Amoy WPOL (native wrapper): 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9
  const WPOL = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
  
  // Deploy mock USDC if needed (or use existing)
  let USDC;
  const configPath = path.join(__dirname, '../../../config/asset-registry.amoy.json');
  
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const usdcToken = config.tokens?.find(t => t.symbol === 'USDC');
    if (usdcToken) {
      USDC = usdcToken.address;
      console.log('📖 Found USDC from config:', USDC);
    }
  }
  
  if (!USDC) {
    console.log('📦 Deploying mock USDC...');
    const MockERC20 = await hre.ethers.getContractFactory('MockERC20Permit');
    const usdc = await MockERC20.deploy('USD Coin', 'USDC', 6);
    await usdc.waitForDeployment();
    USDC = await usdc.getAddress();
    console.log('✅ Mock USDC deployed:', USDC);
  }
  console.log('');
  
  // Configure price feeds in oracle FIRST
  console.log('⚙️  Configuring price feeds in oracle...');
  const oracle = await hre.ethers.getContractAt('MultiTokenPythOracle', PYTH_ORACLE);
  
  // Official Pyth Price Feed IDs
  const PRICE_FEED_IDS = {
    POL_USD: '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
    USDC_USD: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  };
  
  // Set WPOL price feed
  try {
    console.log('  Setting WPOL price feed...');
    const tx1 = await oracle.setPriceId(WPOL, PRICE_FEED_IDS.POL_USD);
    await tx1.wait();
    console.log('  ✅ WPOL configured');
  } catch (error) {
    console.log('  ⚠️  WPOL configuration error:', error.message);
  }
  
  // Set USDC price feed
  try {
    console.log('  Setting USDC price feed...');
    const tx2 = await oracle.setPriceId(USDC, PRICE_FEED_IDS.USDC_USD);
    await tx2.wait();
    console.log('  ✅ USDC configured');
  } catch (error) {
    console.log('  ⚠️  USDC configuration error:', error.message);
  }
  console.log('');
  
  // Test oracle prices
  console.log('🧪 Testing oracle prices...');
  try {
    const wpolPrice = await oracle.getPrice(WPOL);
    console.log(`  WPOL Price: $${(Number(wpolPrice) / 1e8).toFixed(4)}`);
    
    const usdcPrice = await oracle.getPrice(USDC);
    console.log(`  USDC Price: $${(Number(usdcPrice) / 1e8).toFixed(4)}`);
  } catch (error) {
    console.log('  ⚠️  Price fetch failed:', error.message);
    console.log('  Continuing anyway - prices may need Pyth update');
  }
  console.log('');
  
  // Deploy MockDEXAdapter
  console.log('📦 Deploying MockDEXAdapter...');
  const MockDEXAdapter = await hre.ethers.getContractFactory('MockDEXAdapter');
  
  // Constructor only takes oracle address
  const adapter = await MockDEXAdapter.deploy(PYTH_ORACLE);
  await adapter.waitForDeployment();
  
  const adapterAddress = await adapter.getAddress();
  console.log('✅ MockDEXAdapter deployed:', adapterAddress);
  
  // Add supported tokens
  console.log('⚙️  Adding supported tokens...');
  const tx1 = await adapter.addSupportedToken(WPOL);
  await tx1.wait();
  console.log('  ✅ WPOL added');
  
  const tx2 = await adapter.addSupportedToken(USDC);
  await tx2.wait();
  console.log('  ✅ USDC added');
  console.log('');
  
  // Verify configuration
  console.log('🔍 Verifying adapter configuration...');
  const configuredOracle = await adapter.priceOracle();
  
  console.log('  Oracle:', configuredOracle);
  console.log('  Owner:', await adapter.owner());
  
  if (configuredOracle === PYTH_ORACLE) {
    console.log('  ✅ Oracle correctly configured (NOT 0x0000...0001!)');
  } else {
    console.log('  ❌ Oracle mismatch!');
  }
  console.log('');
  
  // Test getQuote
  console.log('🧪 Testing adapter.getQuote()...');
  try {
    const amountIn = hre.ethers.parseUnits('1', 6); // 1 USDC
    const quote = await adapter.getQuote(USDC, WPOL, amountIn);
    console.log(`  Quote: 1 USDC → ${hre.ethers.formatEther(quote)} WPOL`);
    console.log('  ✅ Adapter functional');
  } catch (error) {
    console.log('  ⚠️  Quote failed:', error.message);
    console.log('  This may be normal if Pyth prices need update');
  }
  console.log('');
  
  // Save deployment info
  const deploymentInfo = {
    network: 'amoy',
    chainId: 80002,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      adapter: adapterAddress,
      oracle: PYTH_ORACLE,
      routerHub: ROUTER_HUB,
      wpol: WPOL,
      usdc: USDC,
    },
    oldAdapter: '0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7', // For reference
  };
  
  const deploymentPath = path.join(__dirname, '../deployments');
  const filename = `amoy-adapter-pyth-${Date.now()}.json`;
  const filepath = path.join(deploymentPath, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('💾 Deployment info saved to:', filename);
  console.log('');
  
  console.log('✅ DEPLOYMENT COMPLETE!');
  console.log('');
  console.log('📋 Summary:');
  console.log('  New Adapter:', adapterAddress);
  console.log('  Old Adapter:', '0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7');
  console.log('  Oracle:', PYTH_ORACLE, '(Pyth - NO hardcoded prices!)');
  console.log('  Old Oracle:', '0x0000000000000000000000000000000000000001', '(Mock $1)');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('  1. Whitelist adapter in RouterHub:');
  console.log(`     cast send ${ROUTER_HUB} "addAdapter(address)" ${adapterAddress} --rpc-url amoy --private-key $PRIVATE_KEY`);
  console.log('');
  console.log('  2. Fund adapter with reserves:');
  console.log(`     # Send WPOL: cast send ${WPOL} "transfer(address,uint256)" ${adapterAddress} <amount> --rpc-url amoy --private-key $PRIVATE_KEY`);
  console.log(`     # Send USDC: cast send ${USDC} "transfer(address,uint256)" ${adapterAddress} <amount> --rpc-url amoy --private-key $PRIVATE_KEY`);
  console.log('');
  console.log('  3. Update frontend/src/config/contracts.json:');
  console.log('     {');
  console.log('       "80002": {');
  console.log('         "adapters": {');
  console.log(`           "mockDex": "${adapterAddress}"`);
  console.log('         }');
  console.log('       }');
  console.log('     }');
  console.log('');
  console.log('🎉 NO MORE HARDCODED PRICES! All prices from Pyth Network on-chain!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
