const hre = require("hardhat");

async function checkAdapterFunctions(addr, desc, network) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${desc}: ${addr}`);
  console.log(`Network: ${network}`);
  
  try {
    // Try to get adapter as MockDEXAdapter
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", addr);
    
    // Check owner
    const owner = await adapter.owner();
    console.log(`Owner: ${owner}`);
    
    const [signer] = await hre.ethers.getSigners();
    const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
    console.log(`You are owner: ${isOwner ? '✅ YES' : '❌ NO'}`);
    
    // Check if withdrawFunds exists
    try {
      const code = await hre.ethers.provider.getCode(addr);
      const hasWithdrawFunds = code.includes('withdrawFunds');
      console.log(`Has withdrawFunds(): ${hasWithdrawFunds ? '✅ YES' : '❓ UNKNOWN (checking...)'}`);
      
      // Try to call it (will fail if doesn't exist)
      if (isOwner) {
        console.log(`\n💡 Attempting to check withdrawFunds() function...`);
        // Don't actually call it, just check if function exists
        const iface = adapter.interface;
        const hasFunc = iface.fragments.some(f => f.name === 'withdrawFunds');
        console.log(`Function exists in ABI: ${hasFunc ? '✅ YES' : '❌ NO'}`);
      }
    } catch (e) {
      console.log(`Error checking function: ${e.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function main() {
  const network = hre.network.name;
  console.log(`🔍 Checking OLD adapter functions on ${network}\n`);
  
  if (network === 'sepolia') {
    await checkAdapterFunctions(
      "0x86D1AA2228F3ce649d415F19fC71134264D0E84B",
      "Old MockDEX v1 (has 0.04 WETH + 100 USDC)",
      network
    );
  } else if (network === 'amoy') {
    await checkAdapterFunctions(
      "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7",
      "Old adapter v2 (has 8.74 WPOL + 29 USDC)",
      network
    );
  }
}

main().catch(console.error);
