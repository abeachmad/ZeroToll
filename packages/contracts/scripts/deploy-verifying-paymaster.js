/**
 * Deploy VerifyingPaymaster for Phase 2 Self-Hosted Paymaster Stack
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-verifying-paymaster.js --network sepolia
 *   npx hardhat run scripts/deploy-verifying-paymaster.js --network amoy
 * 
 * Required ENV:
 *   PRIVATE_KEY_DEPLOYER - Deployer wallet private key
 *   POLICY_SIGNER_ADDRESS - Address of policy server signer (signs UserOps)
 */

const hre = require('hardhat');

// EntryPoint v0.7 address (same on all chains)
const ENTRYPOINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  
  console.log('\n' + '='.repeat(60));
  console.log('  DEPLOYING VERIFYING PAYMASTER');
  console.log('='.repeat(60));
  console.log(`Network:  ${network}`);
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} ${network === 'amoy' ? 'POL' : 'ETH'}`);
  
  // Get policy signer address from env
  const policySigner = process.env.POLICY_SIGNER_ADDRESS;
  if (!policySigner) {
    throw new Error('POLICY_SIGNER_ADDRESS not set in environment');
  }
  console.log(`Policy Signer: ${policySigner}`);
  console.log(`EntryPoint: ${ENTRYPOINT_V07}`);
  console.log('='.repeat(60) + '\n');

  // Deploy VerifyingPaymaster
  console.log('Deploying VerifyingPaymaster...');
  const VerifyingPaymaster = await hre.ethers.getContractFactory('VerifyingPaymaster');
  const paymaster = await VerifyingPaymaster.deploy(ENTRYPOINT_V07, policySigner);
  await paymaster.waitForDeployment();
  
  const paymasterAddress = await paymaster.getAddress();
  console.log(`✅ VerifyingPaymaster deployed: ${paymasterAddress}`);

  // Check initial deposit
  const deposit = await paymaster.getDeposit();
  console.log(`Initial deposit: ${hre.ethers.formatEther(deposit)} ${network === 'amoy' ? 'POL' : 'ETH'}`);

  // Verify contract on block explorer
  console.log('\nVerifying contract on block explorer...');
  try {
    await hre.run('verify:verify', {
      address: paymasterAddress,
      constructorArguments: [ENTRYPOINT_V07, policySigner],
    });
    console.log('✅ Contract verified!');
  } catch (error) {
    if (error.message.includes('Already Verified')) {
      console.log('✅ Contract already verified');
    } else {
      console.log('⚠️  Verification failed:', error.message);
      console.log('   You can verify manually later with:');
      console.log(`   npx hardhat verify --network ${network} ${paymasterAddress} ${ENTRYPOINT_V07} ${policySigner}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('  DEPLOYMENT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Network:            ${network}`);
  console.log(`VerifyingPaymaster: ${paymasterAddress}`);
  console.log(`EntryPoint:         ${ENTRYPOINT_V07}`);
  console.log(`Policy Signer:      ${policySigner}`);
  console.log('='.repeat(60));
  
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Fund the paymaster with native tokens:');
  console.log(`   Send ${network === 'amoy' ? '10 POL' : '0.5 ETH'} to ${paymasterAddress}`);
  console.log('\n2. Deposit to EntryPoint (call from owner):');
  console.log(`   paymaster.deposit({ value: ethers.parseEther("${network === 'amoy' ? '5' : '0.3'}") })`);
  console.log('\n3. Update docs/CURRENT_CONTRACTS.md with the new address');
  console.log('\n4. Update .env with:');
  console.log(`   ${network.toUpperCase()}_VERIFYING_PAYMASTER=${paymasterAddress}`);
  
  return paymasterAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
