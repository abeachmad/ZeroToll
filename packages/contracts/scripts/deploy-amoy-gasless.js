/**
 * Deploy ZeroToll Gasless Contracts to Polygon Amoy
 * 
 * Deploys:
 * - ZeroTollRouterV2 (intent-based gasless router)
 * - SmartDexAdapter (DEX routing with internal liquidity)
 * - GaslessTestToken (ZTA - ERC-2612 Permit)
 * - GaslessTestToken (ZTB - ERC-2612 Permit)
 */

const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying to Polygon Amoy with:', deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Balance:', ethers.formatEther(balance), 'POL');
  
  if (balance < ethers.parseEther('0.1')) {
    console.error('❌ Insufficient balance! Need at least 0.1 POL');
    console.log('Get testnet POL from: https://faucet.polygon.technology/');
    process.exit(1);
  }

  console.log('\n📦 Deploying contracts...\n');

  // 1. Deploy ZTA (ZeroToll Token A)
  console.log('1. Deploying ZTA...');
  const GaslessTestToken = await ethers.getContractFactory('GaslessTestToken');
  const zta = await GaslessTestToken.deploy('ZeroToll Token A', 'ZTA');
  await zta.waitForDeployment();
  const ztaAddress = await zta.getAddress();
  console.log('   ZTA deployed:', ztaAddress);

  // 2. Deploy ZTB (ZeroToll Token B)
  console.log('2. Deploying ZTB...');
  const ztb = await GaslessTestToken.deploy('ZeroToll Token B', 'ZTB');
  await ztb.waitForDeployment();
  const ztbAddress = await ztb.getAddress();
  console.log('   ZTB deployed:', ztbAddress);

  // 3. Deploy SmartDexAdapter
  console.log('3. Deploying SmartDexAdapter...');
  const SmartDexAdapter = await ethers.getContractFactory('SmartDexAdapter');
  const adapter = await SmartDexAdapter.deploy();
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log('   SmartDexAdapter deployed:', adapterAddress);

  // 4. Deploy ZeroTollRouterV2
  console.log('4. Deploying ZeroTollRouterV2...');
  const ZeroTollRouterV2 = await ethers.getContractFactory('ZeroTollRouterV2');
  const router = await ZeroTollRouterV2.deploy();
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log('   ZeroTollRouterV2 deployed:', routerAddress);
  
  // Set adapter on router
  await router.setDexAdapter(adapterAddress);
  console.log('   Adapter set on router');

  // 5. Configure SmartDexAdapter
  console.log('\n⚙️  Configuring contracts...\n');
  
  // Add ZTA/ZTB trading pair to adapter
  console.log('5. Adding ZTA/ZTB liquidity pool...');
  const initialLiquidity = ethers.parseEther('100000'); // 100k tokens each
  
  // Mint tokens to adapter for internal liquidity
  await zta.mint(adapterAddress, initialLiquidity);
  await ztb.mint(adapterAddress, initialLiquidity);
  console.log('   Minted 100k ZTA and 100k ZTB to adapter');

  // Set exchange rate (1:1 for simplicity)
  // setPrice(tokenA, tokenB, price) - price is how much tokenB you get for 1 tokenA (in 1e18)
  await adapter.setPrice(ztaAddress, ztbAddress, ethers.parseEther('1'));
  console.log('   Set ZTA/ZTB exchange rate: 1:1');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Deployment Complete - Polygon Amoy (chainId: 80002)');
  console.log('='.repeat(60));
  console.log('\nContract Addresses:');
  console.log(`  ZTA:              ${ztaAddress}`);
  console.log(`  ZTB:              ${ztbAddress}`);
  console.log(`  SmartDexAdapter:  ${adapterAddress}`);
  console.log(`  ZeroTollRouterV2: ${routerAddress}`);
  console.log('\nNext Steps:');
  console.log('1. Add these addresses to frontend/src/config/contracts.json');
  console.log('2. Add ZTA/ZTB to frontend/src/config/tokenlists/zerotoll.tokens.amoy.json');
  console.log('3. Update backend/pimlico-v3-relayer.mjs with Amoy router address');
  console.log('4. Update frontend/src/hooks/useIntentGasless.js with Amoy addresses');
  console.log('\nFaucet:');
  console.log(`  Call faucet() on ZTA: ${ztaAddress}`);
  console.log(`  Call faucet() on ZTB: ${ztbAddress}`);
  console.log('='.repeat(60));

  // Return addresses for programmatic use
  return {
    zta: ztaAddress,
    ztb: ztbAddress,
    adapter: adapterAddress,
    router: routerAddress
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
