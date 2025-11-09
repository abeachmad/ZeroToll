const hre = require("hardhat");

/**
 * Check and withdraw all assets from Sepolia contracts
 */

// Deployer address
const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";

// Contract addresses
const ROUTERHUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
const ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";

// Token addresses
const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function checkBalance(tokenAddress, contractAddress, tokenName, contractName) {
    const token = await hre.ethers.getContractAt("IERC20", tokenAddress);
    const balance = await token.balanceOf(contractAddress);
    const decimals = tokenName === "USDC" ? 6 : 18;
    const formatted = hre.ethers.formatUnits(balance, decimals);
    
    console.log(`   ${tokenName}: ${formatted}`);
    return balance;
}

async function main() {
    console.log("💰 Checking Sepolia contract balances...\n");
    
    const [signer] = await hre.ethers.getSigners();
    console.log("📝 Signer:", signer.address);
    console.log("💰 ETH Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), "\n");
    
    // Check adapter balances
    console.log("1️⃣  Checking Adapter balances:", ADAPTER);
    const adapterWETH = await checkBalance(WETH, ADAPTER, "WETH", "Adapter");
    const adapterUSDC = await checkBalance(USDC, ADAPTER, "USDC", "Adapter");
    
    // Check RouterHub balances
    console.log("\n2️⃣  Checking RouterHub balances:", ROUTERHUB);
    const routerWETH = await checkBalance(WETH, ROUTERHUB, "WETH", "RouterHub");
    const routerUSDC = await checkBalance(USDC, ROUTERHUB, "USDC", "RouterHub");
    
    // Calculate total
    const totalWETH = adapterWETH + routerWETH;
    const totalUSDC = adapterUSDC + routerUSDC;
    
    console.log("\n📊 TOTAL LOCKED:");
    console.log("   WETH:", hre.ethers.formatUnits(totalWETH, 18));
    console.log("   USDC:", hre.ethers.formatUnits(totalUSDC, 6));
    
    // Withdraw from adapter if any
    if (adapterWETH > 0n || adapterUSDC > 0n) {
        console.log("\n3️⃣  Withdrawing from Adapter...");
        
        const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
        const owner = await adapter.owner();
        
        console.log("   Owner:", owner);
        console.log("   Match:", owner === signer.address ? "✅" : "❌");
        
        if (owner !== signer.address) {
            console.error("   ❌ Not owner! Cannot withdraw.");
        } else {
            // Withdraw WETH
            if (adapterWETH > 0n) {
                console.log("\n   📤 Withdrawing WETH...");
                const tx1 = await adapter.withdrawFunds(WETH, adapterWETH);
                console.log("      Transaction:", tx1.hash);
                await tx1.wait();
                console.log("      ✅ WETH withdrawn!");
            }
            
            // Withdraw USDC
            if (adapterUSDC > 0n) {
                console.log("\n   📤 Withdrawing USDC...");
                const tx2 = await adapter.withdrawFunds(USDC, adapterUSDC);
                console.log("      Transaction:", tx2.hash);
                await tx2.wait();
                console.log("      ✅ USDC withdrawn!");
            }
        }
    } else {
        console.log("\n✅ Adapter has no funds to withdraw");
    }
    
    // RouterHub note
    if (routerWETH > 0n || routerUSDC > 0n) {
        console.log("\n⚠️  RouterHub has funds but no standard withdraw function");
        console.log("   Funds will remain locked unless rescue function exists");
    } else {
        console.log("\n✅ RouterHub has no funds");
    }
    
    console.log("\n🎉 Sepolia check complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
