/**
 * Verify BatchExecutor deployment
 * 
 * Checks if the contract is deployed and has code
 */

const hre = require("hardhat");

const ADDRESSES = {
  sepolia: '0x8dD08D3369e1c36a03b30587a032b5A8Aaa177F9',
  amoy: '0x8153FA09Be1689D44C343f119C829F6702A8720b'
};

async function checkContract(network, address) {
  console.log(`\n📍 Checking ${network}...`);
  console.log(`Address: ${address}`);
  
  try {
    const code = await hre.ethers.provider.getCode(address);
    
    if (code === '0x') {
      console.log('❌ No contract code found');
      return false;
    }
    
    console.log('✅ Contract deployed!');
    console.log(`   Code length: ${code.length} bytes`);
    console.log(`   Code preview: ${code.substring(0, 66)}...`);
    
    // Try to call the contract
    const batchExecutor = await hre.ethers.getContractAt('BatchExecutor', address);
    console.log('✅ Contract interface loaded');
    
    return true;
  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Verifying BatchExecutor Deployment\n');
  console.log('='.repeat(60));
  
  const network = hre.network.name;
  const address = ADDRESSES[network];
  
  if (!address) {
    console.log(`\n❌ No address configured for network: ${network}`);
    console.log('\nAvailable networks:');
    console.log('  - sepolia:', ADDRESSES.sepolia);
    console.log('  - amoy:', ADDRESSES.amoy);
    process.exit(1);
  }
  
  const success = await checkContract(network, address);
  
  console.log('\n' + '='.repeat(60));
  
  if (success) {
    console.log('✅ Verification successful!');
    console.log('\nNext steps:');
    console.log('1. Update frontend with this address');
    console.log('2. Test swap in frontend UI');
    console.log('3. Verify USDC deduction');
  } else {
    console.log('❌ Verification failed!');
    console.log('\nPlease check:');
    console.log('1. Contract was deployed successfully');
    console.log('2. Network is correct');
    console.log('3. RPC endpoint is working');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
