const hre = require('hardhat');

async function main() {
  console.log('Deploying MockDEXAdapter with Pyth Oracle (Sepolia)...');
  console.log('======================================================');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  
  // MultiTokenPythOracle address (just deployed)
  const oracleAddress = '0x729fBc26977F8df79B45c1c5789A483640E89b4A';
  console.log('Oracle address:', oracleAddress);
  
  // Deploy MockDEXAdapter
  const MockDEXAdapter = await hre.ethers.getContractFactory('MockDEXAdapter');
  const adapter = await MockDEXAdapter.deploy(oracleAddress);
  await adapter.waitForDeployment();
  
  const adapterAddress = await adapter.getAddress();
  console.log('✅ MockDEXAdapter deployed:', adapterAddress);
  
  // Add supported tokens
  const WETH = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
  const USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  const LINK = '0x779877A7B0D9E8603169DdbD7836e478b4624789';
  
  console.log('\nAdding supported tokens...');
  
  await adapter.addSupportedToken(WETH);
  console.log('✅ WETH supported');
  await new Promise(r => setTimeout(r, 3000));
  
  await adapter.addSupportedToken(USDC);
  console.log('✅ USDC supported');
  await new Promise(r => setTimeout(r, 3000));
  
  await adapter.addSupportedToken(LINK);
  console.log('✅ LINK supported');
  
  // Test quote
  console.log('\n📊 Testing getQuote (0.001 WETH -> USDC)...');
  try {
    const quote = await adapter.getQuote(WETH, USDC, '1000000000000000'); // 0.001 WETH
    const amountOut = Number(quote[0]) / 1e6; // USDC has 6 decimals
    console.log(`  Output: ${amountOut.toFixed(6)} USDC`);
    console.log(`  ✅ Real-time price from Pyth!`);
  } catch (error) {
    console.log('  ⚠️  Quote failed:', error.message);
  }
  
  console.log('\n✅ Deployment complete!');
  console.log('======================================================');
  console.log('MockDEXAdapter:', adapterAddress);
  console.log('Uses Pyth Oracle:', oracleAddress);
  console.log('\nNext steps:');
  console.log('1. Whitelist adapter in RouterHub');
  console.log('2. Fund adapter with USDC');
  console.log('3. Update backend route_client.py');
  console.log('4. Update backend server.py to use Pyth');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
