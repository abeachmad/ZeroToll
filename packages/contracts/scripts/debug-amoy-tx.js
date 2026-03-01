/**
 * Debug the failed transaction on Amoy
 */

const hre = require("hardhat");

async function main() {
  console.log("🔍 Debugging failed TX...\n");
  
  const txHash = "0x29090bd7f26c7fef0232e15338f403cfdc66f7d636242fe7bdd4e0bdb9f184bc";
  
  // Get transaction receipt
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  console.log("Transaction Receipt:");
  console.log("  Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  console.log("  Gas used:", receipt.gasUsed.toString());
  console.log("  Block:", receipt.blockNumber);
  console.log("  Logs:", receipt.logs.length);
  
  // Get transaction
  const tx = await hre.ethers.provider.getTransaction(txHash);
  console.log("\nTransaction Data:");
  console.log("  From:", tx.from);
  console.log("  To:", tx.to);
  console.log("  Data length:", tx.data.length, "bytes");
  console.log("  Value:", hre.ethers.formatEther(tx.value), "POL");
  
  // Try to decode input data
  const routerHub = await hre.ethers.getContractAt("RouterHub", tx.to);
  
  try {
    const decoded = routerHub.interface.parseTransaction({ data: tx.data });
    console.log("\nDecoded Function Call:");
    console.log("  Function:", decoded.name);
    console.log("  Args:", decoded.args);
  } catch (e) {
    console.log("\nCould not decode:", e.message);
  }
  
  // Try to simulate the transaction to get revert reason
  console.log("\n🔄 Simulating transaction to get revert reason...");
  try {
    await hre.ethers.provider.call({
      from: tx.from,
      to: tx.to,
      data: tx.data,
      gasLimit: tx.gasLimit,
      value: tx.value
    }, tx.blockNumber - 1);
    console.log("✅ Simulation succeeded (unexpected!)");
  } catch (error) {
    console.log("❌ Simulation failed:");
    console.log("  Error:", error.message);
    
    if (error.data) {
      console.log("  Error data:", error.data);
      
      // Try to decode error
      try {
        const decoded = routerHub.interface.parseError(error.data);
        console.log("  Decoded error:", decoded);
      } catch (e2) {
        console.log("  Could not decode error data");
      }
    }
  }
}

main().catch(console.error);
