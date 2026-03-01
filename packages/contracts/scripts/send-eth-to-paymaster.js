/**
 * Send ETH to Sepolia Paymaster
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 Sending ETH to Sepolia Paymaster");
  
  const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
  const BUNDLER_KEY = "0x2dbb884d4769fc4870e28a9d21f4a424943a08f62064356618e6db34c877aaea";
  const PAYMASTER_ADDRESS = "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9";
  
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const bundlerWallet = new ethers.Wallet(BUNDLER_KEY, provider);
  
  console.log("From (bundler):", bundlerWallet.address);
  console.log("To (paymaster):", PAYMASTER_ADDRESS);
  
  const balance = await provider.getBalance(bundlerWallet.address);
  console.log("\nBundler balance:", ethers.formatEther(balance), "ETH");
  
  const amount = ethers.parseEther("0.1");
  console.log("Sending:", ethers.formatEther(amount), "ETH");
  
  const tx = await bundlerWallet.sendTransaction({
    to: PAYMASTER_ADDRESS,
    value: amount
  });
  
  console.log("\nTX:", tx.hash);
  console.log("Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);
  
  const paymasterBalance = await provider.getBalance(PAYMASTER_ADDRESS);
  console.log("\n💰 Paymaster balance:", ethers.formatEther(paymasterBalance), "ETH");
  
  console.log("\n✅ Done! Now deposit to EntryPoint with:");
  console.log("npx hardhat run scripts/fund-paymaster.js --network sepolia");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
