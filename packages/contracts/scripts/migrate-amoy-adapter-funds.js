/**
 * Migrate funds from old Amoy adapter to new adapter
 * 1. Withdraw all tokens from 0x2Ed51974196EC8787a74c00C5847F03664d66Dc5 to deployer
 * 2. Fund new adapter 0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1 with those tokens
 */

const hre = require("hardhat");
const { ethers } = hre;

const OLD_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
const NEW_ADAPTER = "0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1";

const AMOY_TOKENS = {
  WMATIC: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
  USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  LINK: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "POL");

  // Connect to contracts
  const oldAdapter = await ethers.getContractAt("MockDEXAdapter", OLD_ADAPTER);
  const newAdapter = await ethers.getContractAt("MockDEXAdapter", NEW_ADAPTER);

  console.log("\n=== STEP 1: Withdraw from OLD adapter ===");
  console.log("Old adapter:", OLD_ADAPTER);

  // Check old adapter owner
  try {
    const oldOwner = await oldAdapter.owner();
    console.log("Old adapter owner:", oldOwner);
    if (oldOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("❌ ERROR: You are not the owner of old adapter!");
      console.log("   Owner:", oldOwner);
      console.log("   You:", deployer.address);
      return;
    }
  } catch (error) {
    console.log("❌ Failed to get old adapter owner (likely broken):", error.message);
    console.log("   Skipping old adapter withdrawal");
    console.log("\n=== STEP 2: Fund NEW adapter directly ===");
  }

  // Check balances and withdraw
  for (const [symbol, address] of Object.entries(AMOY_TOKENS)) {
    const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", address);
    const decimals = await token.decimals();
    
    try {
      const oldBalance = await token.balanceOf(OLD_ADAPTER);
      console.log(`\n${symbol} in old adapter:`, ethers.formatUnits(oldBalance, decimals));

      if (oldBalance > 0n) {
        console.log(`Withdrawing ${symbol} from old adapter...`);
        const tx = await oldAdapter.withdrawFunds(address, oldBalance);
        await tx.wait();
        console.log(`✅ Withdrawn ${ethers.formatUnits(oldBalance, decimals)} ${symbol}`);
        console.log(`   TX: ${tx.hash}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not withdraw ${symbol}:`, error.message);
    }
  }

  // Check POL balance in old adapter
  try {
    const oldPOL = await ethers.provider.getBalance(OLD_ADAPTER);
    console.log("\nPOL in old adapter:", ethers.formatEther(oldPOL));
    if (oldPOL > 0n) {
      console.log("Withdrawing POL from old adapter...");
      const tx = await oldAdapter.withdrawFunds(ethers.ZeroAddress, oldPOL);
      await tx.wait();
      console.log(`✅ Withdrawn ${ethers.formatEther(oldPOL)} POL`);
      console.log(`   TX: ${tx.hash}`);
    }
  } catch (error) {
    console.log("⚠️  Could not withdraw POL:", error.message);
  }

  console.log("\n=== STEP 2: Fund NEW adapter ===");
  console.log("New adapter:", NEW_ADAPTER);

  // Check new adapter owner
  const newOwner = await newAdapter.owner();
  console.log("New adapter owner:", newOwner);
  if (newOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("❌ ERROR: You are not the owner of new adapter!");
    return;
  }

  // Check deployer balances and fund new adapter
  console.log("\nDeployer token balances:");
  for (const [symbol, address] of Object.entries(AMOY_TOKENS)) {
    const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", address);
    const decimals = await token.decimals();
    const balance = await token.balanceOf(deployer.address);
    console.log(`  ${symbol}:`, ethers.formatUnits(balance, decimals));

    if (balance > 0n) {
      // Fund 80% of deployer's balance to adapter (keep 20% for gas/operations)
      const fundAmount = (balance * 80n) / 100n;
      console.log(`\nFunding new adapter with ${ethers.formatUnits(fundAmount, decimals)} ${symbol}...`);
      
      // Approve first
      const approveTx = await token.approve(NEW_ADAPTER, fundAmount);
      await approveTx.wait();
      console.log(`  Approved: ${approveTx.hash}`);

      // Fund adapter
      const fundTx = await newAdapter.fundAdapter(address, fundAmount);
      await fundTx.wait();
      console.log(`✅ Funded ${ethers.formatUnits(fundAmount, decimals)} ${symbol}`);
      console.log(`   TX: ${fundTx.hash}`);
    }
  }

  // Check final balances
  console.log("\n=== Final Adapter Balances ===");
  for (const [symbol, address] of Object.entries(AMOY_TOKENS)) {
    const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", address);
    const decimals = await token.decimals();
    const newBalance = await token.balanceOf(NEW_ADAPTER);
    console.log(`${symbol}:`, ethers.formatUnits(newBalance, decimals));
  }

  const newPOL = await ethers.provider.getBalance(NEW_ADAPTER);
  console.log("POL:", ethers.formatEther(newPOL));

  console.log("\n✅ Migration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
