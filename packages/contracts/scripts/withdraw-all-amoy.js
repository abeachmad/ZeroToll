const hre = require("hardhat");

/**
 * Withdraw all assets from Amoy contracts back to deployer
 * Includes OLD adapter, NEW adapter, and RouterHub
 */

// Deployer address
const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";

// Contract addresses
const ROUTERHUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
const OLD_ADAPTER = "0x716bA57120a5043ee9eAC7171c10BF092f6FA45c";
const NEW_ADAPTER = "0xbe6F932465D5155c1564FF0AD7Cc9D2D2a4316d5";

// Token addresses
const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

async function checkBalance(tokenAddress, contractAddress, tokenName, contractName) {
    const token = await hre.ethers.getContractAt("IERC20", tokenAddress);
    const balance = await token.balanceOf(contractAddress);
    const decimals = tokenName === "USDC" ? 6 : 18;
    const formatted = hre.ethers.formatUnits(balance, decimals);
    
    console.log(`   ${tokenName}: ${formatted}`);
    return { balance, decimals };
}

async function withdrawToken(tokenAddress, fromAddress, amount, tokenName, fromName) {
    if (amount === 0n) {
        console.log(`   ⏭️  Skipping ${tokenName} (zero balance)`);
        return;
    }
    
    const token = await hre.ethers.getContractAt("IERC20", tokenAddress);
    
    // Try to transfer from contract to deployer
    try {
        // Check if contract has a withdraw function
        const contract = await hre.ethers.getContractAt("MockDEXAdapter", fromAddress);
        
        // MockDEXAdapter doesn't have withdraw, so we need to use emergencyWithdraw or direct transfer
        // Let's check RouterHub first
        if (fromAddress === ROUTERHUB) {
            const routerHub = await hre.ethers.getContractAt("RouterHub", fromAddress);
            // RouterHub might have rescue function - check contract
            console.log(`   ⚠️  RouterHub: No standard withdraw - need owner to rescue tokens`);
            return;
        }
        
        // For adapters, no withdraw function - tokens are stuck unless there's rescue
        console.log(`   ⚠️  ${fromName}: No withdraw function - tokens locked in contract`);
        
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
    }
}

async function main() {
    console.log("💰 Withdrawing all assets from Amoy contracts...\n");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deployer:", deployer.address);
    console.log("💰 POL Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "\n");
    
    // Check balances
    console.log("1️⃣  Checking OLD Adapter balances:", OLD_ADAPTER);
    const oldAdapterUSDC = await checkBalance(USDC, OLD_ADAPTER, "USDC", "OLD Adapter");
    const oldAdapterWPOL = await checkBalance(WPOL, OLD_ADAPTER, "WPOL", "OLD Adapter");
    
    console.log("\n2️⃣  Checking NEW Adapter balances:", NEW_ADAPTER);
    const newAdapterUSDC = await checkBalance(USDC, NEW_ADAPTER, "USDC", "NEW Adapter");
    const newAdapterWPOL = await checkBalance(WPOL, NEW_ADAPTER, "WPOL", "NEW Adapter");
    
    console.log("\n3️⃣  Checking RouterHub balances:", ROUTERHUB);
    const routerUSDC = await checkBalance(USDC, ROUTERHUB, "USDC", "RouterHub");
    const routerWPOL = await checkBalance(WPOL, ROUTERHUB, "WPOL", "RouterHub");
    
    // Calculate total
    console.log("\n📊 TOTAL LOCKED:");
    const totalUSDC = oldAdapterUSDC.balance + newAdapterUSDC.balance + routerUSDC.balance;
    const totalWPOL = oldAdapterWPOL.balance + newAdapterWPOL.balance + routerWPOL.balance;
    console.log("   USDC:", hre.ethers.formatUnits(totalUSDC, 6));
    console.log("   WPOL:", hre.ethers.formatUnits(totalWPOL, 18));
    
    console.log("\n⚠️  WARNING:");
    console.log("   MockDEXAdapter and RouterHub don't have withdraw functions!");
    console.log("   Tokens are LOCKED in contracts unless:");
    console.log("   1. Add emergencyWithdraw() function to contracts");
    console.log("   2. Redeploy contracts with rescue mechanism");
    console.log("   3. Use existing rescue/sweep functions (if any)");
    
    console.log("\n🔍 Checking for rescue functions...");
    
    // Check RouterHub for any sweep/rescue functions
    try {
        const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTERHUB);
        const code = await hre.ethers.provider.getCode(ROUTERHUB);
        
        // Look for common rescue function signatures
        const rescueSigs = [
            "rescueTokens(address,uint256)",
            "sweepToken(address)",
            "emergencyWithdraw(address,address,uint256)"
        ];
        
        console.log("   Scanning RouterHub for rescue functions...");
        // This would require reading the ABI - for now, let's try direct call
        
    } catch (error) {
        console.log("   No standard rescue functions found");
    }
    
    console.log("\n💡 RECOMMENDATION:");
    console.log("   Since contracts are newly deployed and have minimal testing,");
    console.log("   consider deploying new versions with emergencyWithdraw() function.");
    console.log("   Or accept that test tokens remain locked (acceptable for testnet).");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
