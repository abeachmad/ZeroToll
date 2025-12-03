/**
 * Test zToken faucet functionality
 * 
 * Usage:
 *   npx hardhat run scripts/test-faucet.js --network amoy
 *   npx hardhat run scripts/test-faucet.js --network sepolia
 */

const hre = require("hardhat");

const ZTOKEN_ADDRESSES = {
  amoy: {
    zUSDC: "0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD",
    zETH: "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9",
    zPOL: "0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d",
    zLINK: "0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1"
  },
  sepolia: {
    zUSDC: "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C",
    zETH: "0x8153FA09Be1689D44C343f119C829F6702A8720b",
    zPOL: "0x63c31C4247f6AA40B676478226d6FEB5707649D6",
    zLINK: "0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C"
  }
};

async function main() {
  const network = hre.network.name;
  console.log(`\n🧪 Testing zToken faucet on ${network}...\n`);

  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH/POL\n`);

  const addresses = ZTOKEN_ADDRESSES[network];
  if (!addresses) {
    throw new Error(`No addresses configured for ${network}`);
  }

  // Test zUSDC faucet
  const tokenAddress = addresses.zUSDC;
  console.log(`Testing zUSDC faucet at ${tokenAddress}...`);

  const token = await hre.ethers.getContractAt("ZeroTollToken", tokenAddress);
  
  // Check current balance
  const balanceBefore = await token.balanceOf(signer.address);
  const decimals = await token.decimals();
  console.log(`  Balance before: ${hre.ethers.formatUnits(balanceBefore, decimals)} zUSDC`);

  // Call faucet
  console.log(`  Calling faucet()...`);
  try {
    const tx = await token.faucet();
    console.log(`  Transaction: ${tx.hash}`);
    await tx.wait();
    console.log(`  ✅ Faucet successful!`);
  } catch (error) {
    console.error(`  ❌ Faucet failed:`, error.message);
    
    // Try to get more details
    if (error.data) {
      console.error(`  Error data:`, error.data);
    }
    return;
  }

  // Check new balance
  const balanceAfter = await token.balanceOf(signer.address);
  console.log(`  Balance after: ${hre.ethers.formatUnits(balanceAfter, decimals)} zUSDC`);
  
  const received = balanceAfter - balanceBefore;
  console.log(`  Received: ${hre.ethers.formatUnits(received, decimals)} zUSDC`);

  console.log(`\n✅ Faucet test complete!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
