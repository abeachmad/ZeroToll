/**
 * Deploy BatchExecutor for EIP-7702
 * 
 * This contract enables EOAs to execute batch transactions via EIP-7702 delegation
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-batch-executor.js --network sepolia
 *   npx hardhat run scripts/deploy-batch-executor.js --network amoy
 */

const hre = require("hardhat");

async function main() {
  console.log('=== Deploying BatchExecutor ===\n');

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId;
  const networkName = hre.network.name;

  console.log('Network:', networkName);
  console.log('Chain ID:', chainId.toString());

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Balance:', hre.ethers.formatEther(balance), chainId === 80002n ? 'POL' : 'ETH');

  // Deploy BatchExecutor
  console.log('\nDeploying BatchExecutor...');
  
  const BatchExecutor = await hre.ethers.getContractFactory("BatchExecutor");
  const batchExecutor = await BatchExecutor.deploy();
  
  await batchExecutor.waitForDeployment();
  const address = await batchExecutor.getAddress();

  console.log('✅ BatchExecutor deployed!');
  console.log('   Address:', address);

  // Verify on block explorer
  if (networkName !== 'hardhat' && networkName !== 'localhost') {
    console.log('\n⏳ Waiting for block confirmations...');
    await batchExecutor.deploymentTransaction().wait(5);

    console.log('\n📝 Verifying contract on block explorer...');
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: []
      });
      console.log('✅ Contract verified!');
    } catch (error) {
      if (error.message.includes('Already Verified')) {
        console.log('✅ Contract already verified!');
      } else {
        console.log('⚠️ Verification failed:', error.message);
      }
    }
  }

  // Print summary
  console.log('\n=== Deployment Summary ===');
  console.log('Network:', networkName);
  console.log('Chain ID:', chainId.toString());
  console.log('BatchExecutor:', address);
  
  // Print explorer URL
  let explorerUrl;
  if (chainId === 11155111n) {
    explorerUrl = `https://sepolia.etherscan.io/address/${address}`;
  } else if (chainId === 80002n) {
    explorerUrl = `https://amoy.polygonscan.com/address/${address}`;
  }
  
  if (explorerUrl) {
    console.log('Explorer:', explorerUrl);
  }

  // Print usage instructions
  console.log('\n=== Usage Instructions ===');
  console.log('1. Update frontend/src/hooks/useEIP7702Swap.FIXED.js');
  console.log('   Set BATCH_EXECUTOR_ADDRESS for chain', chainId.toString(), 'to:', address);
  console.log('\n2. Users can now execute batch swaps via EIP-7702:');
  console.log('   - Sign authorization to delegate to BatchExecutor');
  console.log('   - Execute approve + swap in single transaction');
  console.log('   - USDC will be deducted from user wallet');
  console.log('\n3. Test with:');
  console.log('   - Connect wallet to', networkName);
  console.log('   - Execute swap in frontend');
  console.log('   - Check transaction on explorer');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
