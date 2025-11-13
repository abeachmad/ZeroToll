/**
 * Deploy RouterHub v1.4 with Gasless Fee Support (Phase 1)
 * 
 * This deploys the RouterHub with fee-on-output logic for gasless swaps
 * Network: Amoy or Sepolia (specify with --network flag)
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

// Existing RouterHub addresses (for reference/upgrade)
const EXISTING_ROUTERS = {
  amoy: "0x5335f887E69F4B920bb037062382B9C17aA52ec6",
  sepolia: "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  
  console.log("=== DEPLOYING ROUTERHUB v1.4 (Phase 1: Gasless) ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH/MATIC/POL");
  console.log("");

  // Check if there's an existing RouterHub
  const existingRouter = EXISTING_ROUTERS[network];
  if (existingRouter) {
    console.log("⚠️  EXISTING RouterHub found:", existingRouter);
    console.log("   This will deploy a NEW RouterHub (not upgrade existing)");
    console.log("   You'll need to:");
    console.log("   1. Whitelist adapters on new RouterHub");
    console.log("   2. Update frontend to use new address");
    console.log("   3. (Optional) Migrate any stuck funds from old RouterHub");
    console.log("");
  }

  // Deploy RouterHub
  console.log("Deploying RouterHub...");
  const RouterHub = await ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy();
  await routerHub.waitForDeployment();
  
  const routerAddress = await routerHub.getAddress();
  console.log("✅ RouterHub deployed:", routerAddress);
  console.log("");

  // Initial configuration
  console.log("=== INITIAL CONFIGURATION ===");
  
  // Set gasless fee (initially disabled - recipient = 0x0)
  console.log("Setting gasless fee config...");
  console.log("  Fee BPS: 50 (0.5%)");
  console.log("  Fee Recipient: 0x0 (DISABLED until Paymaster deployed)");
  
  const setFeeTx = await routerHub.setGaslessFeeConfig(50, ethers.ZeroAddress);
  await setFeeTx.wait();
  console.log("✅ Gasless fee configured (disabled)");
  console.log("");

  // Verify configuration
  console.log("=== VERIFICATION ===");
  const owner = await routerHub.owner();
  const feeBps = await routerHub.gaslessFeeBps();
  const feeRecipient = await routerHub.gaslessFeeRecipient();
  
  console.log("Owner:", owner);
  console.log("Gasless Fee BPS:", feeBps.toString(), `(${Number(feeBps) / 100}%)`);
  console.log("Gasless Fee Recipient:", feeRecipient, "(DISABLED)");
  console.log("");

  // Save deployment info
  const deploymentInfo = {
    network: network,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    routerHub: routerAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    gaslessFeeBps: Number(feeBps),
    gaslessFeeRecipient: feeRecipient,
    phase: "1 - Gasless Fee Support",
    existingRouter: existingRouter || null,
  };

  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const filename = `routerhub-v1.4-${network}-${Date.now()}.json`;
  const filepath = path.join(deploymentDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("📄 Deployment info saved:", filepath);
  console.log("");

  // Next steps
  console.log("=== NEXT STEPS ===");
  console.log("");
  console.log("1. ✅ Whitelist adapters:");
  console.log(`   npx hardhat run scripts/whitelist-adapter-${network}.js --network ${network}`);
  console.log("");
  console.log("2. ✅ Update frontend config:");
  console.log("   - Old RouterHub:", existingRouter || "N/A");
  console.log("   - New RouterHub:", routerAddress);
  console.log("");
  console.log("3. ⏳ After Phase 2 (Paymaster deployed):");
  console.log("   Run: npx hardhat run scripts/configure-gasless-fee.js --network", network);
  console.log("   With: GASLESS_FEE_RECIPIENT=<paymaster_treasury_address>");
  console.log("");
  console.log("4. 🧪 Test swap with new RouterHub:");
  console.log("   npx hardhat run scripts/test-amoy-adapter-swaps.js --network", network);
  console.log("");

  console.log("=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", network);
  console.log("New RouterHub:", routerAddress);
  console.log("Status: ✅ DEPLOYED & CONFIGURED");
  console.log("Gasless Fee: DISABLED (pending Paymaster)");
  console.log("");
  console.log("🎉 Phase 1 deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
