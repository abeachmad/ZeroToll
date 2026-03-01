const hre = require('hardhat');
const pythAddresses = require('./pyth-addresses');

/**
 * UNIVERSAL PYTH ORACLE DEPLOYMENT
 * 
 * Deploy MultiTokenPythOracle to ANY network (Sepolia, Amoy, mainnet)
 * ✅ NO HARDCODE - all prices LIVE from Pyth Network
 * ✅ NO MANUAL INPUT - automatic real-time feeds
 * ✅ SAME BEHAVIOR - testnet = mainnet (same price source)
 */

async function main() {
  const network = hre.network.name;
  console.log(`\n🚀 Deploying MultiTokenPythOracle to ${network.toUpperCase()}`);
  console.log("=" .repeat(70));
  
  // Get Pyth contract address for this network
  const pythAddress = pythAddresses[network];
  if (!pythAddress) {
    console.error(`\n❌ ERROR: Pyth not available on ${network}!`);
    console.log("\nSupported networks:");
    Object.keys(pythAddresses).forEach(net => {
      if (net !== 'priceIds') console.log(`  - ${net}`);
    });
    process.exit(1);
  }
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`\n📝 Deployer: ${deployer.address}`);
  console.log(`🔮 Pyth Address: ${pythAddress}`);
  
  // 1. Deploy MultiTokenPythOracle
  console.log(`\n1️⃣  Deploying MultiTokenPythOracle...`);
  const MultiTokenPythOracle = await hre.ethers.getContractFactory("MultiTokenPythOracle");
  const oracle = await MultiTokenPythOracle.deploy(pythAddress);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log(`✅ Oracle deployed: ${oracleAddress}`);
  
  // 2. Configure price feeds based on network
  console.log(`\n2️⃣  Configuring price feeds...`);
  
  let tokens, priceIds, tokenNames;
  
  if (network === 'sepolia') {
    // Sepolia - ETH ecosystem
    const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
    const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
    
    tokens = [WETH, USDC];
    priceIds = [
      pythAddresses.priceIds['ETH/USD'],
      pythAddresses.priceIds['USDC/USD']
    ];
    tokenNames = ['WETH', 'USDC'];
    
  } else if (network === 'amoy') {
    // Amoy - Polygon ecosystem
    const WPOL = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
    const USDC = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582';
    
    tokens = [WPOL, USDC];
    priceIds = [
      pythAddresses.priceIds['POL/USD'],
      pythAddresses.priceIds['USDC/USD']
    ];
    tokenNames = ['WPOL', 'USDC'];
    
  } else {
    console.error(`\n❌ ERROR: Token configuration not defined for ${network}`);
    console.log("Please add token addresses for this network in the script.");
    process.exit(1);
  }
  
  // Set price IDs
  console.log(`\nSetting price feeds:`);
  const tx = await oracle.setPriceIds(tokens, priceIds);
  await tx.wait();
  
  tokenNames.forEach((name, i) => {
    console.log(`  ✅ ${name} → Pyth feed configured`);
  });
  
  // 3. Test price fetching
  console.log(`\n3️⃣  Testing LIVE price fetch from Pyth...`);
  
  for (let i = 0; i < tokens.length; i++) {
    try {
      const price = await oracle.getPrice(tokens[i]);
      const priceUSD = Number(price) / 1e8;
      console.log(`  ${tokenNames[i]}: $${priceUSD.toFixed(2)} ✅ (LIVE from Pyth)`);
    } catch (error) {
      console.log(`  ${tokenNames[i]}: ⚠️  Price not available yet (Pyth may need price update)`);
      console.log(`     Error: ${error.shortMessage || error.message}`);
    }
  }
  
  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log(`✅ DEPLOYMENT COMPLETE!`);
  console.log(`${"=".repeat(70)}`);
  console.log(`\n📊 Oracle Details:`);
  console.log(`  Network: ${network}`);
  console.log(`  Oracle: ${oracleAddress}`);
  console.log(`  Pyth: ${pythAddress}`);
  console.log(`\n🎯 Features:`);
  console.log(`  ✅ NO HARDCODE - prices 100% live from Pyth Network`);
  console.log(`  ✅ NO MANUAL INPUT - automatic real-time updates`);
  console.log(`  ✅ MAINNET-READY - same code works on testnet & mainnet`);
  console.log(`  ✅ MULTI-TOKEN - add more tokens via setPriceIds()`);
  
  console.log(`\n⚙️  NEXT STEPS:`);
  console.log(`  1. Update backend/.env:`);
  console.log(`     ${network.toUpperCase()}_PYTH_ORACLE=${oracleAddress}`);
  console.log(`\n  2. Deploy MockDEXAdapter with this oracle:`);
  console.log(`     npx hardhat run scripts/deploy-adapter-with-pyth.js --network ${network}`);
  console.log(`\n  3. Update frontend config with new adapter address`);
  console.log(`\n  4. Test swaps - prices will be LIVE! 🚀`);
  
  // Save deployment
  const deployment = {
    network,
    timestamp: Date.now(),
    oracle: oracleAddress,
    pyth: pythAddress,
    tokens: tokens.reduce((acc, addr, i) => {
      acc[tokenNames[i]] = {
        address: addr,
        priceId: priceIds[i]
      };
      return acc;
    }, {})
  };
  
  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `${network}-pyth-oracle-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deployment, null, 2)
  );
  console.log(`\n💾 Deployment saved: deployments/${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
