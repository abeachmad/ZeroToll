/**
 * Unwrap WMATIC/WPOL to native MATIC
 * Usage: PRIVATE_KEY=0x... npx hardhat run scripts/unwrap-wmatic.js --network amoy
 */

const hre = require("hardhat");

const WMATIC_ADDRESSES = {
  amoy: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
  sepolia: "0x..." // Add if needed
};

async function main() {
  const network = hre.network.name;
  
  console.log("\n=== UNWRAP WMATIC TO NATIVE ===");
  console.log("Network:", network);
  
  // Get signer from private key
  let signer;
  if (process.env.PRIVATE_KEY) {
    signer = new hre.ethers.Wallet(process.env.PRIVATE_KEY, hre.ethers.provider);
  } else {
    [signer] = await hre.ethers.getSigners();
  }
  
  console.log("Address:", signer.address);
  console.log("");
  
  const wmaticAddress = WMATIC_ADDRESSES[network];
  if (!wmaticAddress) {
    console.log("❌ WMATIC address not configured for network:", network);
    return;
  }
  
  console.log("WMATIC:", wmaticAddress);
  
  // WMATIC ABI
  const WMATIC_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function withdraw(uint256) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];
  
  const wmatic = new hre.ethers.Contract(wmaticAddress, WMATIC_ABI, signer);
  
  // Check balances BEFORE
  console.log("=== BALANCES BEFORE ===");
  const nativeBalanceBefore = await hre.ethers.provider.getBalance(signer.address);
  const wmaticBalance = await wmatic.balanceOf(signer.address);
  const decimals = await wmatic.decimals();
  const symbol = await wmatic.symbol();
  
  console.log(`Native MATIC: ${hre.ethers.formatEther(nativeBalanceBefore)}`);
  console.log(`${symbol}: ${hre.ethers.formatUnits(wmaticBalance, decimals)}`);
  console.log("");
  
  if (wmaticBalance === 0n) {
    console.log("✅ No WMATIC to unwrap. Balance is 0.");
    return;
  }
  
  // Unwrap all WMATIC
  console.log("=== UNWRAPPING ===");
  console.log(`Amount: ${hre.ethers.formatUnits(wmaticBalance, decimals)} ${symbol}`);
  
  const tx = await wmatic.withdraw(wmaticBalance);
  console.log("Transaction:", tx.hash);
  
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Unwrapped!");
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Block:", receipt.blockNumber);
  console.log("");
  
  // Check balances AFTER
  console.log("=== BALANCES AFTER ===");
  const nativeBalanceAfter = await hre.ethers.provider.getBalance(signer.address);
  const wmaticBalanceAfter = await wmatic.balanceOf(signer.address);
  
  console.log(`Native MATIC: ${hre.ethers.formatEther(nativeBalanceAfter)}`);
  console.log(`${symbol}: ${hre.ethers.formatUnits(wmaticBalanceAfter, decimals)}`);
  console.log("");
  
  // Summary
  const unwrapped = wmaticBalance - wmaticBalanceAfter;
  const nativeGained = nativeBalanceAfter - nativeBalanceBefore;
  
  console.log("=== SUMMARY ===");
  console.log(`Unwrapped: ${hre.ethers.formatUnits(unwrapped, decimals)} ${symbol}`);
  console.log(`Native gained: ${hre.ethers.formatEther(nativeGained)} MATIC (after gas)`);
  console.log("");
  
  console.log("✅ COMPLETE!");
  console.log(`Transaction: https://www.oklink.com/amoy/tx/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
