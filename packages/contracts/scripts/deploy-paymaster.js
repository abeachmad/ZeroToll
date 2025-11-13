/**
 * Deploy TestPaymasterAcceptAll for Phase 2 testing
 * 
 * This paymaster accepts ALL user operations without validation.
 * FOR TESTNET USE ONLY!
 * 
 * Network: Amoy or Sepolia (specify with --network flag)
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

// Standard ERC-4337 v0.7 EntryPoint address
const ENTRYPOINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  
  console.log("=== DEPLOYING TESTPAYMASTER (Phase 2) ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH/MATIC/POL");
  console.log("EntryPoint:", ENTRYPOINT_ADDRESS);
  console.log("");

  // Deploy TestPaymasterAcceptAll
  console.log("Deploying TestPaymasterAcceptAll...");
  const TestPaymaster = await ethers.getContractFactory("TestPaymasterAcceptAll");
  const paymaster = await TestPaymaster.deploy(ENTRYPOINT_ADDRESS);
  await paymaster.waitForDeployment();
  
  const paymasterAddress = await paymaster.getAddress();
  console.log("✅ TestPaymasterAcceptAll deployed:", paymasterAddress);
  console.log("");

  // Initial deposit to paymaster (0.5 ETH/MATIC for testnets)
  const depositAmount = ethers.parseEther("0.5");
  console.log("Depositing initial funds:", ethers.formatEther(depositAmount), "ETH/MATIC");
  
  const depositTx = await paymaster.deposit({ value: depositAmount });
  await depositTx.wait();
  console.log("✅ Deposited to Paymaster");
  console.log("");

  // Verify deposit
  const balance = await paymaster.getDeposit();
  console.log("Paymaster balance:", ethers.formatEther(balance), "ETH/MATIC");
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: network,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    paymaster: paymasterAddress,
    entryPoint: ENTRYPOINT_ADDRESS,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    initialDeposit: ethers.formatEther(depositAmount),
    currentBalance: ethers.formatEther(balance),
    phase: "2 - Testnet Paymaster (Accept All)",
  };

  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const filename = `paymaster-${network}-${Date.now()}.json`;
  const filepath = path.join(deploymentDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved:", filepath);
  console.log("");

  // Next steps
  console.log("=== NEXT STEPS ===");
  console.log("");
  console.log("1. ✅ Update RouterHub gasless fee recipient:");
  console.log(`   Paymaster address: ${paymasterAddress}`);
  console.log(`   Run: GASLESS_FEE_RECIPIENT=${paymasterAddress} npx hardhat run scripts/configure-gasless-fee.js --network ${network}`);
  console.log("");
  console.log("2. ⏳ Setup self-hosted bundler:");
  console.log("   - Install Stackup bundler");
  console.log("   - Configure EntryPoint + Paymaster");
  console.log("   - Test UserOperation submission");
  console.log("");
  console.log("3. ⏳ Build policy server (Phase 3):");
  console.log("   - Express.js backend");
  console.log("   - /api/paymaster/sponsor endpoint");
  console.log("   - Rate limiting + validation");
  console.log("");

  console.log("=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", network);
  console.log("Paymaster:", paymasterAddress);
  console.log("EntryPoint:", ENTRYPOINT_ADDRESS);
  console.log("Initial Deposit:", ethers.formatEther(depositAmount), "ETH/MATIC");
  console.log("Status: ✅ DEPLOYED & FUNDED");
  console.log("");
  console.log("⚠️  WARNING: This paymaster accepts ALL requests!");
  console.log("   Use ONLY on testnets for Phase 2 testing.");
  console.log("");
  console.log("🎉 Phase 2 Paymaster deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
