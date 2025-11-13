/**
 * Send WMATIC to Smart Account
 * Simple transfer of WMATIC tokens to the smart account for testing
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("\n💸 Sending WMATIC to Smart Account\n");

  const SMART_ACCOUNT = "0x5a87a3c738cf99db95787d51b627217b6de12f62";
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const AMOUNT = ethers.parseEther("0.5"); // Send 0.5 WMATIC

  const [deployer] = await ethers.getSigners();
  console.log("From (deployer):", deployer.address);
  console.log("To (smart account):", SMART_ACCOUNT);
  console.log("Amount:", ethers.formatEther(AMOUNT), "WMATIC");

  // Get WMATIC contract
  const wmaticContract = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)", "function transfer(address to, uint256 amount) returns (bool)"],
    WMATIC
  );

  // Check deployer balance
  const deployerBalance = await wmaticContract.balanceOf(deployer.address);
  console.log("\nDeployer WMATIC balance:", ethers.formatEther(deployerBalance));

  if (deployerBalance < AMOUNT) {
    console.error("❌ Insufficient WMATIC! Deployer needs to wrap MATIC first.");
    console.log("\n   Run: npx hardhat run scripts/unwrap-wmatic.js --network amoy");
    console.log("   But use deposit() instead of withdraw()");
    process.exit(1);
  }

  // Transfer WMATIC
  console.log("\nTransferring WMATIC...");
  const tx = await wmaticContract.transfer(SMART_ACCOUNT, AMOUNT);
  console.log("TX:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Check new balance
  const accountBalance = await wmaticContract.balanceOf(SMART_ACCOUNT);
  console.log("\n💰 Smart account WMATIC balance:", ethers.formatEther(accountBalance));
  console.log("\n✅ Done! Smart account now has WMATIC for swaps.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
