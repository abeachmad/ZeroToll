/**
 * Fund VerifyingPaymaster - Deposit to EntryPoint
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("FUND VERIFYINGPAYMASTER - DEPOSIT TO ENTRYPOINT");
  console.log("=".repeat(80));

  const [deployer] = await ethers.getSigners();
  console.log("\nDeployer:", deployer.address);

  // Get network
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 80002n ? "Amoy" : 
                      network.chainId === 11155111n ? "Sepolia" : "Unknown";
  
  console.log("Network:", networkName, `(${network.chainId})`);

  // Paymaster addresses
  const PAYMASTER_ADDRESSES = {
    amoy: "0xC721582d25895956491436459df34cd817C6AB74",
    sepolia: "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9"
  };

  const paymasterAddress = network.chainId === 80002n ? 
    PAYMASTER_ADDRESSES.amoy : PAYMASTER_ADDRESSES.sepolia;

  console.log("Paymaster:", paymasterAddress);

  // Check paymaster balance
  const balance = await ethers.provider.getBalance(paymasterAddress);
  console.log("\n💰 Current paymaster balance:", ethers.formatEther(balance), "ETH/MATIC");

  if (balance === 0n) {
    console.error("❌ Paymaster has no balance! Please send native tokens first.");
    process.exit(1);
  }

  // Get paymaster contract
  const VerifyingPaymaster = await ethers.getContractFactory("VerifyingPaymaster");
  const paymaster = VerifyingPaymaster.attach(paymasterAddress);

  // Check current EntryPoint deposit
  const currentDeposit = await paymaster.getDeposit();
  console.log("📊 Current EntryPoint deposit:", ethers.formatEther(currentDeposit), "ETH/MATIC");

  // Deposit amount (use 0.5 of the balance, keep some for contract operations)
  const depositAmount = balance / 2n;
  console.log("\n💸 Depositing:", ethers.formatEther(depositAmount), "ETH/MATIC to EntryPoint");

  // Deposit to EntryPoint
  const tx = await paymaster.deposit({ value: depositAmount });
  console.log("TX:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("✅ Deposited in block:", receipt.blockNumber);

  // Check new deposit
  const newDeposit = await paymaster.getDeposit();
  console.log("\n📊 New EntryPoint deposit:", ethers.formatEther(newDeposit), "ETH/MATIC");

  const newBalance = await ethers.provider.getBalance(paymasterAddress);
  console.log("💰 Remaining paymaster balance:", ethers.formatEther(newBalance), "ETH/MATIC");

  console.log("\n" + "=".repeat(80));
  console.log("✅ SUCCESS - Paymaster funded and ready to sponsor UserOps!");
  console.log("=".repeat(80));
  console.log("\nSummary:");
  console.log("  Paymaster:", paymasterAddress);
  console.log("  EntryPoint Deposit:", ethers.formatEther(newDeposit), "ETH/MATIC");
  console.log("  Available for sponsorship: ~", Math.floor(Number(ethers.formatEther(newDeposit)) / 0.01), "UserOps");
  console.log("  (assuming ~0.01 ETH/MATIC per UserOp)");
  console.log("=".repeat(80) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
