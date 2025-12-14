/**
 * Fund VerifyingPaymaster - deposits native tokens to EntryPoint
 * 
 * Usage:
 *   npx hardhat run scripts/fund-paymaster.js --network sepolia
 *   npx hardhat run scripts/fund-paymaster.js --network amoy
 * 
 * Required ENV:
 *   PRIVATE_KEY_DEPLOYER - Wallet with funds to deposit
 *   SEPOLIA_VERIFYING_PAYMASTER or AMOY_VERIFYING_PAYMASTER - Paymaster address
 */

const hre = require('hardhat');

// Funding amounts per network
const FUNDING = {
  sepolia: {
    amount: '0.3',  // ETH
    symbol: 'ETH',
    minBalance: '0.1'
  },
  amoy: {
    amount: '5',    // POL
    symbol: 'POL',
    minBalance: '2'
  }
};

async function main() {
  const [funder] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const config = FUNDING[network];
  
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Get paymaster address from env
  const envKey = `${network.toUpperCase()}_VERIFYING_PAYMASTER`;
  const paymasterAddress = process.env[envKey];
  if (!paymasterAddress) {
    throw new Error(`${envKey} not set in environment`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('  FUNDING VERIFYING PAYMASTER');
  console.log('='.repeat(60));
  console.log(`Network:   ${network}`);
  console.log(`Funder:    ${funder.address}`);
  console.log(`Paymaster: ${paymasterAddress}`);
  
  const funderBalance = await hre.ethers.provider.getBalance(funder.address);
  console.log(`Funder Balance: ${hre.ethers.formatEther(funderBalance)} ${config.symbol}`);

  // Connect to paymaster
  const paymaster = await hre.ethers.getContractAt('VerifyingPaymaster', paymasterAddress);
  
  // Check current deposit
  const currentDeposit = await paymaster.getDeposit();
  console.log(`Current Deposit: ${hre.ethers.formatEther(currentDeposit)} ${config.symbol}`);
  
  const minBalance = hre.ethers.parseEther(config.minBalance);
  if (currentDeposit >= minBalance) {
    console.log(`\n✅ Paymaster already has sufficient deposit (>= ${config.minBalance} ${config.symbol})`);
    console.log('   No funding needed.');
    return;
  }

  // Fund the paymaster
  const fundAmount = hre.ethers.parseEther(config.amount);
  console.log(`\nDepositing ${config.amount} ${config.symbol} to paymaster...`);
  
  const tx = await paymaster.deposit({ value: fundAmount });
  console.log(`Transaction: ${tx.hash}`);
  await tx.wait();
  console.log('✅ Deposit confirmed!');

  // Verify new deposit
  const newDeposit = await paymaster.getDeposit();
  console.log(`\nNew Deposit: ${hre.ethers.formatEther(newDeposit)} ${config.symbol}`);

  console.log('\n' + '='.repeat(60));
  console.log('  FUNDING COMPLETE');
  console.log('='.repeat(60));
  console.log(`Paymaster: ${paymasterAddress}`);
  console.log(`Deposit:   ${hre.ethers.formatEther(newDeposit)} ${config.symbol}`);
  console.log('='.repeat(60) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
