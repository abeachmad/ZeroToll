const hre = require('hardhat');
const pythAddresses = require('./pyth-addresses');

async function main() {
  console.log('Deploying MultiTokenPythOracle to Sepolia...');
  console.log('=============================================');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // Pyth contract on Sepolia
  const pythAddress = pythAddresses.sepolia;
  console.log('Pyth address:', pythAddress);
  
  // Deploy MultiTokenPythOracle
  const MultiTokenPythOracle = await hre.ethers.getContractFactory('MultiTokenPythOracle');
  const oracle = await MultiTokenPythOracle.deploy(pythAddress);
  await oracle.waitForDeployment();
  
  const oracleAddress = await oracle.getAddress();
  console.log('✅ MultiTokenPythOracle deployed:', oracleAddress);
  
  // Token addresses on Sepolia
  const tokens = {
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    // Add more as needed
  };
  
  // Set price IDs for tokens
  console.log('\nSetting price feeds...');
  
  const tokenAddresses = [
    tokens.WETH,
    tokens.USDC,
    tokens.LINK,
  ];
  
  const priceIds = [
    pythAddresses.priceIds['ETH/USD'],
    pythAddresses.priceIds['USDC/USD'],
    pythAddresses.priceIds['LINK/USD'],
  ];
  
  const tx = await oracle.setPriceIds(tokenAddresses, priceIds);
  await tx.wait();
  
  console.log('✅ Price feeds configured:');
  console.log('  WETH  -> ETH/USD');
  console.log('  USDC  -> USDC/USD');
  console.log('  LINK  -> LINK/USD');
  
  // Verify by getting a price
  console.log('\n📊 Testing price fetch...');
  try {
    const wethPrice = await oracle.getPrice(tokens.WETH);
    console.log(`  WETH price: $${(Number(wethPrice) / 1e8).toFixed(2)}`);
    
    const usdcPrice = await oracle.getPrice(tokens.USDC);
    console.log(`  USDC price: $${(Number(usdcPrice) / 1e8).toFixed(4)}`);
    
    const linkPrice = await oracle.getPrice(tokens.LINK);
    console.log(`  LINK price: $${(Number(linkPrice) / 1e8).toFixed(2)}`);
  } catch (error) {
    console.log('  ⚠️  Could not fetch prices (may need Pyth price updates)');
    console.log('  Error:', error.message);
  }
  
  console.log('\n✅ Deployment complete!');
  console.log('=============================================');
  console.log('MultiTokenPythOracle:', oracleAddress);
  console.log('\nNext steps:');
  console.log('1. Deploy MockDEXAdapter with this oracle address');
  console.log('2. Update backend to query Pyth oracle');
  console.log('3. Test swap with real-time prices!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
