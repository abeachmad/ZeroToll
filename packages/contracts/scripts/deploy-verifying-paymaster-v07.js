/**
 * Deploy VerifyingPaymasterV07 for ERC-4337 v0.7
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-verifying-paymaster-v07.js --network sepolia
 *   npx hardhat run scripts/deploy-verifying-paymaster-v07.js --network amoy
 */

const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying VerifyingPaymasterV07 to ${network}...`);

  // EntryPoint v0.7 (same on all chains)
  const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  // Policy signer address (from env or default)
  const POLICY_SIGNER = process.env.POLICY_SIGNER_ADDRESS || "0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A";

  console.log("EntryPoint:", ENTRYPOINT_V07);
  console.log("Policy Signer:", POLICY_SIGNER);

  // Deploy
  const VerifyingPaymasterV07 = await hre.ethers.getContractFactory("VerifyingPaymasterV07");
  const paymaster = await VerifyingPaymasterV07.deploy(ENTRYPOINT_V07, POLICY_SIGNER);
  await paymaster.waitForDeployment();

  const address = await paymaster.getAddress();
  console.log(`\n✅ VerifyingPaymasterV07 deployed to: ${address}`);

  // Verify deployment
  const entryPoint = await paymaster.entryPoint();
  const signer = await paymaster.verifySigner();
  console.log("  EntryPoint:", entryPoint);
  console.log("  Verify Signer:", signer);

  // Output env variable
  const envVar = network === "sepolia" ? "SEPOLIA_VERIFYING_PAYMASTER_V07" : "AMOY_VERIFYING_PAYMASTER_V07";
  console.log(`\nAdd to .env:`);
  console.log(`${envVar}=${address}`);

  // Remind to fund
  console.log(`\n⚠️  Don't forget to fund the paymaster!`);
  console.log(`   Run: npx hardhat run scripts/fund-paymaster.js --network ${network}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
