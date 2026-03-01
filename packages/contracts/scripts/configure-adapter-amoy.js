const hre = require('hardhat');

/**
 * Whitelist and fund new adapter on Amoy
 */

async function main() {
  console.log('🔧 Configuring new adapter on Amoy...\n');
  
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('');
  
  const ROUTER_HUB = '0x5335f887E69F4B920bb037062382B9C17aA52ec6';
  const NEW_ADAPTER = '0x716bA57120a5043ee9eAC7171c10BF092f6FA45c';
  const WPOL = '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9';
  const USDC = '0x642Ec30B4a41169770246d594621332eE60a28f0';
  
  // Step 1: Whitelist adapter
  console.log('1️⃣  Whitelisting adapter in RouterHub...');
  const routerHub = await hre.ethers.getContractAt('RouterHub', ROUTER_HUB);
  
  try {
    const tx1 = await routerHub.whitelistAdapter(NEW_ADAPTER, true);
    console.log('  Tx:', tx1.hash);
    await tx1.wait();
    console.log('  ✅ Adapter whitelisted');
  } catch (error) {
    console.log('  ⚠️  Error:', error.message);
  }
  console.log('');
  
  // Step 2: Fund adapter with WPOL
  console.log('2️⃣  Funding adapter with WPOL...');
  
  // WPOL interface (WETH-like)
  const WPOL_ABI = [
    'function deposit() external payable',
    'function balanceOf(address) external view returns (uint256)',
    'function transfer(address,uint256) external returns (bool)',
  ];
  const wpol = await hre.ethers.getContractAt(WPOL_ABI, WPOL);
  
  try {
    const balance = await wpol.balanceOf(deployer.address);
    console.log('  Deployer WPOL balance:', hre.ethers.formatEther(balance));
    
    // If balance is low, wrap some POL
    const minRequired = hre.ethers.parseEther('10');
    if (balance < minRequired) {
      console.log('  Wrapping 10 POL to WPOL...');
      const wrapTx = await wpol.deposit({ value: minRequired });
      await wrapTx.wait();
      console.log('  ✅ Wrapped 10 POL');
    }
    
    // Transfer to adapter
    const amount = hre.ethers.parseEther('10'); // 10 WPOL
    const tx2 = await wpol.transfer(NEW_ADAPTER, amount);
    console.log('  Tx:', tx2.hash);
    await tx2.wait();
    console.log('  ✅ Sent 10 WPOL to adapter');
  } catch (error) {
    console.log('  ⚠️  Error:', error.message);
  }
  console.log('');
  
  // Step 3: Fund adapter with USDC
  console.log('3️⃣  Funding adapter with USDC...');
  const usdc = await hre.ethers.getContractAt('IERC20', USDC);
  
  try {
    const balance = await usdc.balanceOf(deployer.address);
    console.log('  Deployer USDC balance:', hre.ethers.formatUnits(balance, 6));
    
    if (balance > 0) {
      const amount = hre.ethers.parseUnits('100', 6); // 100 USDC
      const tx3 = await usdc.transfer(NEW_ADAPTER, amount);
      console.log('  Tx:', tx3.hash);
      await tx3.wait();
      console.log('  ✅ Sent 100 USDC to adapter');
    } else {
      console.log('  ⚠️  No USDC - minting...');
      const tx = await usdc.mint(deployer.address, hre.ethers.parseUnits('1000', 6));
      await tx.wait();
      console.log('  ✅ Minted 1000 USDC');
      
      const tx3 = await usdc.transfer(NEW_ADAPTER, hre.ethers.parseUnits('100', 6));
      await tx3.wait();
      console.log('  ✅ Sent 100 USDC to adapter');
    }
  } catch (error) {
    console.log('  ⚠️  Error:', error.message);
  }
  console.log('');
  
  // Verify balances
  console.log('4️⃣  Verifying adapter balances...');
  const wpolBalance = await wpol.balanceOf(NEW_ADAPTER);
  const usdcBalance = await usdc.balanceOf(NEW_ADAPTER);
  
  console.log(`  WPOL: ${hre.ethers.formatEther(wpolBalance)}`);
  console.log(`  USDC: ${hre.ethers.formatUnits(usdcBalance, 6)}`);
  console.log('');
  
  console.log('✅ Configuration complete!');
  console.log('');
  console.log('📝 Next: Update frontend/src/config/contracts.json:');
  console.log(`  "mockDex": "${NEW_ADAPTER}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
