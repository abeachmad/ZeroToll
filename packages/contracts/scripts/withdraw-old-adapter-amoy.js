const hre = require("hardhat");

/**
 * Withdraw funds from OLD Amoy adapter using withdrawFunds()
 */

const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";
const OLD_ADAPTER = "0x716bA57120a5043ee9eAC7171c10BF092f6FA45c";
const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

async function main() {
    console.log("💰 Withdrawing 10 WPOL from OLD Adapter...\n");
    
    const [signer] = await hre.ethers.getSigners();
    console.log("📝 Signer:", signer.address);
    
    // Connect to adapter
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", OLD_ADAPTER);
    
    // Check owner
    const owner = await adapter.owner();
    console.log("🔧 Adapter Owner:", owner);
    console.log("   Match deployer:", owner === DEPLOYER ? "✅" : "❌");
    
    if (owner !== signer.address) {
        console.error(`\n❌ ERROR: Signer is not owner!`);
        console.error(`   Owner: ${owner}`);
        console.error(`   Signer: ${signer.address}`);
        process.exit(1);
    }
    
    // Check balance
    const wpol = await hre.ethers.getContractAt("IERC20", WPOL);
    const balance = await wpol.balanceOf(OLD_ADAPTER);
    console.log("\n💰 Current balance:", hre.ethers.formatUnits(balance, 18), "WPOL");
    
    if (balance === 0n) {
        console.log("✅ Nothing to withdraw!");
        return;
    }
    
    // Withdraw
    console.log("\n📤 Withdrawing to owner...");
    const tx = await adapter.withdrawFunds(WPOL, balance);
    console.log("   Transaction:", tx.hash);
    
    await tx.wait();
    console.log("✅ Withdrawal successful!");
    
    // Verify
    const newBalance = await wpol.balanceOf(OLD_ADAPTER);
    const ownerBalance = await wpol.balanceOf(owner);
    
    console.log("\n📊 Final balances:");
    console.log("   Adapter:", hre.ethers.formatUnits(newBalance, 18), "WPOL");
    console.log("   Owner:", hre.ethers.formatUnits(ownerBalance, 18), "WPOL");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
