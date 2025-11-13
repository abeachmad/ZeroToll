/**
 * Wrap MATIC to WMATIC for Smart Account
 * 
 * This wraps native MATIC held by the smart account into WMATIC
 * so it can be used for swaps
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("\n🔄 Wrapping MATIC to WMATIC for Smart Account\n");

  const SMART_ACCOUNT = "0x5a87a3c738cf99db95787d51b627217b6de12f62";
  const ACCOUNT_OWNER_KEY = "0x5e80527e137f6704c8096b025a1b75bfe8b73b206745b47bf724c39ce1883a04";
  const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const AMOUNT_TO_WRAP = ethers.parseEther("0.05"); // Wrap 0.05 MATIC

  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  
  console.log("Smart Account:", SMART_ACCOUNT);
  console.log("Amount to wrap:", ethers.formatEther(AMOUNT_TO_WRAP), "MATIC");

  // Check balances
  const nativeBalance = await provider.getBalance(SMART_ACCOUNT);
  console.log("\n💰 Current balances:");
  console.log("  Native MATIC:", ethers.formatEther(nativeBalance));

  const wmaticContract = new ethers.Contract(
    WMATIC,
    ["function balanceOf(address) view returns (uint256)", "function deposit() payable"],
    provider
  );

  const wmaticBalance = await wmaticContract.balanceOf(SMART_ACCOUNT);
  console.log("  WMATIC:", ethers.formatEther(wmaticBalance));

  if (nativeBalance < AMOUNT_TO_WRAP) {
    console.error("\n❌ Insufficient native MATIC balance!");
    process.exit(1);
  }

  // Build callData for WMATIC.deposit()
  const depositCallData = wmaticContract.interface.encodeFunctionData("deposit");

  // Build smart account execute call
  const accountInterface = new ethers.Interface([
    "function execute(address dest, uint256 value, bytes calldata func) external"
  ]);

  const executeCallData = accountInterface.encodeFunctionData("execute", [
    WMATIC,
    AMOUNT_TO_WRAP,
    depositCallData
  ]);

  console.log("\n📝 Building UserOp to wrap MATIC...");

  // For simplicity, we'll execute this directly (not through bundler)
  // In production, this would also be a gasless UserOp
  
  const accountOwner = new ethers.Wallet(ACCOUNT_OWNER_KEY, provider);
  const accountContract = new ethers.Contract(
    SMART_ACCOUNT,
    ["function execute(address dest, uint256 value, bytes calldata func) external"],
    accountOwner
  );

  console.log("Executing wrap transaction...");
  
  const tx = await accountContract.execute(WMATIC, AMOUNT_TO_WRAP, depositCallData, {
    gasLimit: 200000
  });

  console.log("TX:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Check new balances
  const newNativeBalance = await provider.getBalance(SMART_ACCOUNT);
  const newWmaticBalance = await wmaticContract.balanceOf(SMART_ACCOUNT);

  console.log("\n💰 New balances:");
  console.log("  Native MATIC:", ethers.formatEther(newNativeBalance));
  console.log("  WMATIC:", ethers.formatEther(newWmaticBalance));
  console.log("\n✅ Successfully wrapped", ethers.formatEther(AMOUNT_TO_WRAP), "MATIC!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
