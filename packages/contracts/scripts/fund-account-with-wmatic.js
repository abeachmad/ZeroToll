/**
 * Wrap MATIC and send WMATIC to Smart Account
 * Two-step process:
 * 1. Wrap deployer's MATIC to WMATIC
 * 2. Transfer WMATIC to smart account
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔄 Wrap MATIC and Send WMATIC to Smart Account\n");

  const SMART_ACCOUNT = "0x5a87a3c738cf99db95787d51b627217b6de12f62";
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const AMOUNT_TO_WRAP = ethers.parseEther("0.5"); // Wrap 0.5 MATIC

  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log("Deployer:", deployer.address);
  console.log("Smart Account:", SMART_ACCOUNT);
  console.log("Amount:", ethers.formatEther(AMOUNT_TO_WRAP), "MATIC/WMATIC");

  // Get WMATIC contract
  const wmatic = await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function deposit() payable",
      "function transfer(address to, uint256 amount) returns (bool)"
    ],
    WMATIC
  );

  // Check deployer balances
  const nativeBalance = await provider.getBalance(deployer.address);
  const wmaticBalance = await wmatic.balanceOf(deployer.address);

  console.log("\n💰 Deployer balances:");
  console.log("  Native MATIC:", ethers.formatEther(nativeBalance));
  console.log("  WMATIC:", ethers.formatEther(wmaticBalance));

  // Check if we need to wrap or can just transfer
  if (wmaticBalance >= AMOUNT_TO_WRAP) {
    console.log("\n✅ Deployer already has enough WMATIC, skipping wrap step");
    
    // Just transfer WMATIC to smart account
    console.log("\n📝 Transferring WMATIC to smart account...");
    const transferTx = await wmatic.transfer(SMART_ACCOUNT, AMOUNT_TO_WRAP);
    console.log("Transfer TX:", transferTx.hash);

    await transferTx.wait();
    console.log("✅ Transferred!");

    // Check smart account balance
    const accountWmaticBalance = await wmatic.balanceOf(SMART_ACCOUNT);
    console.log("\n💰 Smart account WMATIC balance:", ethers.formatEther(accountWmaticBalance));

    console.log("\n✅ Success! Smart account now has WMATIC for swaps.");
    console.log("   Ready to test gasless swaps!");
    return;
  }

  if (nativeBalance < AMOUNT_TO_WRAP) {
    console.error("\n❌ Insufficient native MATIC!");
    process.exit(1);
  }

  // Step 1: Wrap MATIC to WMATIC
  console.log("\n📝 Step 1: Wrapping MATIC to WMATIC...");
  const wrapTx = await wmatic.deposit({ value: AMOUNT_TO_WRAP });
  console.log("Wrap TX:", wrapTx.hash);

  await wrapTx.wait();
  console.log("✅ Wrapped!");

  const newWmaticBalance = await wmatic.balanceOf(deployer.address);
  console.log("New WMATIC balance:", ethers.formatEther(newWmaticBalance));

  // Step 2: Transfer WMATIC to smart account
  console.log("\n📝 Step 2: Transferring WMATIC to smart account...");
  const transferTx = await wmatic.transfer(SMART_ACCOUNT, AMOUNT_TO_WRAP);
  console.log("Transfer TX:", transferTx.hash);

  await transferTx.wait();
  console.log("✅ Transferred!");

  // Check smart account balance
  const accountWmaticBalance = await wmatic.balanceOf(SMART_ACCOUNT);
  console.log("\n💰 Smart account WMATIC balance:", ethers.formatEther(accountWmaticBalance));

  console.log("\n✅ Success! Smart account now has WMATIC for swaps.");
  console.log("   Ready to test gasless swaps!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
