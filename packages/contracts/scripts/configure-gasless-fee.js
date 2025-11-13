/**
 * Configure gasless fee on RouterHub v1.4
 * Phase 1: Enable fee-on-output for gasless swaps
 * 
 * This is a NON-BREAKING upgrade - just configuration, no redeployment needed
 */

const hre = require("hardhat");
const { ethers } = hre;

// Configuration
const FEE_BPS = 50; // 0.5% (50 basis points)

// Deployed RouterHub addresses (v1.4 with gasless fee)
const ROUTER_HUBS = {
  amoy: "0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881",
  sepolia: "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84",
};

// Paymaster addresses (Phase 2)
const PAYMASTERS = {
  amoy: "0x620138B987C5EE4fb2476a2D409d67979D0AE50F",
  sepolia: "0x2058E1DC26cE80f543157182734aA95DABE70FD7",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  
  // Use env variable or default to Paymaster address for this network
  const FEE_RECIPIENT = process.env.GASLESS_FEE_RECIPIENT || PAYMASTERS[network] || "";
  
  console.log("=== GASLESS FEE CONFIGURATION ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Fee BPS:", FEE_BPS, `(${FEE_BPS / 100}%)`);
  console.log("");

  // Get RouterHub address for current network
  const routerAddress = ROUTER_HUBS[network];
  if (!routerAddress) {
    console.log("❌ No RouterHub address configured for network:", network);
    console.log("   Available networks:", Object.keys(ROUTER_HUBS).join(", "));
    return;
  }

  console.log("RouterHub:", routerAddress);

  // Connect to RouterHub
  const routerHub = await ethers.getContractAt("RouterHub", routerAddress);

  // Check current configuration
  console.log("\n=== CURRENT CONFIGURATION ===");
  try {
    const currentFeeBps = await routerHub.gaslessFeeBps();
    const currentRecipient = await routerHub.gaslessFeeRecipient();
    console.log("Current fee BPS:", currentFeeBps.toString());
    console.log("Current fee recipient:", currentRecipient);
    
    if (currentRecipient === ethers.ZeroAddress) {
      console.log("⚠️  Fee recipient not set - gasless fee currently DISABLED");
    }
  } catch (error) {
    console.log("❌ RouterHub does not have gasless fee functions yet");
    console.log("   You need to redeploy RouterHub with Phase 1 changes");
    console.log("   Error:", error.message);
    return;
  }

  // Validate fee recipient
  if (!FEE_RECIPIENT || FEE_RECIPIENT === ethers.ZeroAddress) {
    console.log("\n⚠️  WARNING: No fee recipient configured");
    console.log("   Set GASLESS_FEE_RECIPIENT environment variable or");
    console.log("   Fee collection will be DISABLED (feeRecipient = 0x0)");
    console.log("");
    console.log("   To enable gasless fee collection:");
    console.log("   1. Deploy Paymaster (Phase 2)");
    console.log("   2. Set GASLESS_FEE_RECIPIENT to Paymaster treasury address");
    console.log("   3. Run this script again");
    console.log("");
    console.log("   For now, configuring with recipient = 0x0 (fee disabled)");
  }

  // Set gasless fee configuration
  console.log("\n=== SETTING GASLESS FEE ===");
  console.log("Setting fee BPS:", FEE_BPS);
  console.log("Setting fee recipient:", FEE_RECIPIENT || ethers.ZeroAddress);

  const tx = await routerHub.setGaslessFeeConfig(
    FEE_BPS,
    FEE_RECIPIENT || ethers.ZeroAddress
  );
  
  console.log("Transaction submitted:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Configuration updated!");
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log("   Block:", receipt.blockNumber);

  // Verify new configuration
  console.log("\n=== VERIFICATION ===");
  const newFeeBps = await routerHub.gaslessFeeBps();
  const newRecipient = await routerHub.gaslessFeeRecipient();
  
  console.log("Verified fee BPS:", newFeeBps.toString(), `(${Number(newFeeBps) / 100}%)`);
  console.log("Verified fee recipient:", newRecipient);
  
  if (newRecipient === ethers.ZeroAddress) {
    console.log("");
    console.log("✅ Configuration set, but fee collection is DISABLED");
    console.log("   (recipient = 0x0)");
    console.log("");
    console.log("   To enable fee collection:");
    console.log("   1. Complete Phase 2 (Deploy Paymaster)");
    console.log("   2. Run: npx hardhat run scripts/configure-gasless-fee.js --network", network);
    console.log("      with GASLESS_FEE_RECIPIENT=<paymaster_treasury>");
  } else {
    console.log("");
    console.log("✅ Gasless fee collection ENABLED");
    console.log("   Fee:", Number(newFeeBps) / 100, "%");
    console.log("   Recipient:", newRecipient);
    console.log("");
    console.log("💡 Next steps:");
    console.log("   1. Test swap to verify fee deduction works");
    console.log("   2. Monitor fee accumulation in recipient address");
    console.log("   3. Setup auto-refill for Paymaster");
  }

  console.log("\n=== SUMMARY ===");
  console.log("Network:", network);
  console.log("RouterHub:", routerAddress);
  console.log("Fee:", Number(newFeeBps) / 100, "%");
  console.log("Status:", newRecipient === ethers.ZeroAddress ? "DISABLED (pending Paymaster)" : "ENABLED");
  console.log("\n✅ Phase 1 configuration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
