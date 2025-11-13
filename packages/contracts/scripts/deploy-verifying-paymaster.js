/**
 * Deploy VerifyingPaymaster to Amoy and Sepolia
 * 
 * This replaces TestPaymasterAcceptAll with a production-ready paymaster
 * that requires signatures from the policy server.
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying VerifyingPaymaster with account:", deployer.address);

  // Configuration
  const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  
  // Use the same signer for all networks (from .env or create new)
  // This ensures policy server can sign for both Amoy and Sepolia
  const EXISTING_SIGNER_KEY = "0xba65e483a87127ba468cec3a151773a7ae84c64b9cae49fffee6db46c90cf314";
  const policyServerWallet = new ethers.Wallet(EXISTING_SIGNER_KEY);
  
  console.log("\n🔑 POLICY SERVER WALLET (CONSISTENT ACROSS NETWORKS):");
  console.log("Address:", policyServerWallet.address);
  console.log("Private Key:", policyServerWallet.privateKey);
  console.log("✅ Using same signer for all networks\n");

  // Get network
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 80002n ? "Amoy" : 
                      network.chainId === 11155111n ? "Sepolia" : "Unknown";
  
  console.log(`Deploying to: ${networkName} (Chain ID: ${network.chainId})`);

  // Deploy VerifyingPaymaster
  console.log("\n📝 Deploying VerifyingPaymaster...");
  const VerifyingPaymaster = await ethers.getContractFactory("VerifyingPaymaster");
  const paymaster = await VerifyingPaymaster.deploy(
    ENTRYPOINT_V07,
    policyServerWallet.address
  );
  
  await paymaster.waitForDeployment();
  const paymasterAddress = await paymaster.getAddress();
  
  console.log("✅ VerifyingPaymaster deployed to:", paymasterAddress);

  console.log("\n⚠️  NOTE: Paymaster needs to be funded manually");
  console.log("   1. Send native tokens to paymaster for gas");
  console.log("   2. Call paymaster.deposit() to stake on EntryPoint");

  const balance = await ethers.provider.getBalance(paymasterAddress);
  console.log(`\n💰 Current balance: ${ethers.formatEther(balance)} ETH/MATIC`);

  // Verification info
  console.log("\n" + "=".repeat(80));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(80));
  console.log(`Network: ${networkName} (${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`VerifyingPaymaster: ${paymasterAddress}`);
  console.log(`Policy Server Signer: ${policyServerWallet.address}`);
  console.log(`EntryPoint: ${ENTRYPOINT_V07}`);
  console.log("=".repeat(80));

  console.log("\n📋 NEXT STEPS:");
  console.log("1. Add policy server private key to backend/policy-server/.env:");
  console.log(`   SIGNER_PRIVATE_KEY=${policyServerWallet.privateKey}`);
  console.log(`2. Update policy server .env with paymaster address:`);
  console.log(`   ${networkName.toUpperCase()}_PAYMASTER=${paymasterAddress}`);
  console.log("3. Start policy server: cd backend/policy-server && npm install && npm start");
  console.log("4. Test signature generation with scripts/test-policy-server.js");

  // Save deployment info
  const fs = require('fs');
  const deploymentInfo = {
    network: networkName,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      VerifyingPaymaster: paymasterAddress,
      EntryPoint: ENTRYPOINT_V07
    },
    policyServer: {
      signer: policyServerWallet.address,
      privateKey: policyServerWallet.privateKey
    }
  };

  const filename = `deployments/verifying-paymaster-${networkName.toLowerCase()}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${filename}`);

  // Verify contract on block explorer (wait a bit first)
  if (network.chainId !== 31337n) { // Skip for local network
    console.log("\n⏳ Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      console.log("🔍 Verifying contract on block explorer...");
      await hre.run("verify:verify", {
        address: paymasterAddress,
        constructorArguments: [ENTRYPOINT_V07, policyServerWallet.address],
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️  Verification failed (may already be verified):", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
