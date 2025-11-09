const hre = require("hardhat");

/**
 * Deploy TestnetPriceOracle for Amoy
 * NO HARDCODED PRICES - all configured via external script
 */

async function main() {
    console.log("🚀 Deploying TestnetPriceOracle to Amoy...\n");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deployer:", deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "POL\n");
    
    // Deploy oracle
    console.log("1️⃣  Deploying TestnetPriceOracle...");
    const TestnetPriceOracle = await hre.ethers.getContractFactory("TestnetPriceOracle");
    const oracle = await TestnetPriceOracle.deploy();
    await oracle.waitForDeployment();
    const oracleAddress = await oracle.getAddress();
    console.log("✅ Oracle deployed:", oracleAddress);
    
    console.log("\n2️⃣  Verifying deployment...");
    const owner = await oracle.owner();
    console.log("   Owner:", owner);
    console.log("   Is deployer:", owner === deployer.address ? "✅" : "❌");
    
    console.log("\n📋 NEXT STEPS:");
    console.log("   1. Update prices using update-testnet-prices-amoy.js");
    console.log("   2. Deploy new adapter pointing to:", oracleAddress);
    console.log("   3. Update frontend config with new adapter");
    console.log("   4. Update backend .env:");
    console.log(`      AMOY_PYTH_ORACLE=${oracleAddress}`);
    
    console.log("\n💾 Save this address:");
    console.log("   TESTNET_ORACLE_AMOY=" + oracleAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
