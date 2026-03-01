/**
 * Fund VerifyingPaymasterV07 - deposits native tokens to EntryPoint
 * 
 * Usage:
 *   PAYMASTER=0x... npx hardhat run scripts/fund-paymaster-v07.js --network sepolia
 */

const hre = require('hardhat');

async function main() {
  const [funder] = await hre.ethers.getSigners();
  const network = hre.network.name;
  
  // Get paymaster address from env or command line
  const paymasterAddress = process.env.PAYMASTER || process.env.SEPOLIA_VERIFYING_PAYMASTER_V07;
  if (!paymasterAddress) {
    throw new Error('Set PAYMASTER env variable');
  }

  const symbol = network === 'amoy' ? 'POL' : 'ETH';
  const fundAmount = network === 'amoy' ? '5' : '0.3';

  console.log('\n' + '='.repeat(60));
  console.log('  FUNDING VERIFYING PAYMASTER V07');
  console.log('='.repeat(60));
  console.log(`Network:   ${network}`);
  console.log(`Funder:    ${funder.address}`);
  console.log(`Paymaster: ${paymasterAddress}`);
  
  const funderBalance = await hre.ethers.provider.getBalance(funder.address);
  console.log(`Funder Balance: ${hre.ethers.formatEther(funderBalance)} ${symbol}`);

  // Connect to paymaster
  const paymaster = await hre.ethers.getContractAt('VerifyingPaymasterV07', paymasterAddress);
  
  // Check current deposit
  const currentDeposit = await paymaster.getDeposit();
  console.log(`Current Deposit: ${hre.ethers.formatEther(currentDeposit)} ${symbol}`);

  // Fund the paymaster
  const amount = hre.ethers.parseEther(fundAmount);
  console.log(`\nDepositing ${fundAmount} ${symbol} to paymaster...`);
  
  const tx = await paymaster.deposit({ value: amount });
  console.log(`Transaction: ${tx.hash}`);
  await tx.wait();
  console.log('✅ Deposit confirmed!');

  // Verify new deposit
  const newDeposit = await paymaster.getDeposit();
  console.log(`\nNew Deposit: ${hre.ethers.formatEther(newDeposit)} ${symbol}`);
  console.log('='.repeat(60) + '\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
