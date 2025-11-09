const hre = require('hardhat');
require('dotenv').config({ path: '../../backend/.env' });

async function main() {
  console.log('💸 Funding Relayer with POL for gas...\n');
  
  const [deployer] = await hre.ethers.getSigners();
  const relayerKey = process.env.RELAYER_PRIVATE_KEY;
  
  if (!relayerKey) {
    console.log('❌ RELAYER_PRIVATE_KEY not found');
    return;
  }
  
  const relayer = new hre.ethers.Wallet(relayerKey, hre.ethers.provider);
  
  console.log('From (Deployer):', deployer.address);
  console.log('To (Relayer):', relayer.address);
  console.log('');
  
  // Check balances
  const deployerBal = await hre.ethers.provider.getBalance(deployer.address);
  const relayerBal = await hre.ethers.provider.getBalance(relayer.address);
  
  console.log('Deployer balance:', hre.ethers.formatEther(deployerBal), 'POL');
  console.log('Relayer balance:', hre.ethers.formatEther(relayerBal), 'POL');
  console.log('');
  
  // Transfer 2 POL to relayer
  const amount = hre.ethers.parseEther('2.0');
  
  if (deployerBal < amount + hre.ethers.parseEther('0.5')) {
    console.log('❌ Deployer insufficient balance');
    return;
  }
  
  console.log('💰 Transferring 2 POL to relayer...');
  const tx = await deployer.sendTransaction({
    to: relayer.address,
    value: amount
  });
  
  console.log('📤 Tx:', tx.hash);
  await tx.wait();
  console.log('✅ Transfer successful!');
  console.log('');
  
  // Check new balance
  const newBal = await hre.ethers.provider.getBalance(relayer.address);
  console.log('Relayer new balance:', hre.ethers.formatEther(newBal), 'POL');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
