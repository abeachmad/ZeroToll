const hre = require("hardhat");

/**
 * Deploy MockDEXAdapter with TestnetPriceOracle for Amoy
 */

const TESTNET_ORACLE = "0x01520E28693118042a0d9178Be96064E6FB62612";
const ROUTERHUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";

// Token addresses
const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";

async function main() {
    console.log("🚀 Deploying MockDEXAdapter with TestnetPriceOracle on Amoy...\n");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deployer:", deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "POL");
    console.log("🔧 Oracle:", TESTNET_ORACLE);
    console.log("🔧 RouterHub:", ROUTERHUB, "\n");
    
    // Deploy adapter
    console.log("1️⃣  Deploying MockDEXAdapter...");
    const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
    const adapter = await MockDEXAdapter.deploy(TESTNET_ORACLE);
    await adapter.waitForDeployment();
    const adapterAddress = await adapter.getAddress();
    console.log("✅ Adapter deployed:", adapterAddress);
    
    // Verify
    console.log("\n2️⃣  Verifying deployment...");
    const oracle = await adapter.priceOracle();
    console.log("   Oracle:", oracle);
    console.log("   Match:", oracle === TESTNET_ORACLE ? "✅" : "❌");
    
    // Whitelist
    console.log("\n3️⃣  Whitelisting adapter in RouterHub...");
    const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTERHUB);
    const whitelistTx = await routerHub.whitelistAdapter(adapterAddress, true);
    console.log("   Transaction:", whitelistTx.hash);
    await whitelistTx.wait();
    console.log("✅ Adapter whitelisted!");
    
    // Fund with USDC
    console.log("\n4️⃣  Funding adapter with USDC...");
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const usdcAmount = hre.ethers.parseUnits("50", 6);  // 50 USDC (have 60)
    const fundUSDCTx = await usdc.transfer(adapterAddress, usdcAmount);
    console.log("   Transaction:", fundUSDCTx.hash);
    await fundUSDCTx.wait();
    console.log("✅ Funded 50 USDC");
    
    // Wrap POL to WPOL
    console.log("\n5️⃣  Wrapping POL to WPOL...");
    const wpol = await hre.ethers.getContractAt("contracts/interfaces/IWETH.sol:IWETH", WPOL);
    const wrapAmount = hre.ethers.parseUnits("10", 18);  // Wrap 10 POL
    const wrapTx = await wpol.deposit({ value: wrapAmount });
    console.log("   Transaction:", wrapTx.hash);
    await wrapTx.wait();
    console.log("✅ Wrapped 10 POL → WPOL");
    
    // Fund with WPOL
    console.log("\n6️⃣  Funding adapter with WPOL...");
    const wpolAmount = hre.ethers.parseUnits("10", 18);  // 10 WPOL
    const fundWPOLTx = await wpol.transfer(adapterAddress, wpolAmount);
    console.log("   Transaction:", fundWPOLTx.hash);
    await fundWPOLTx.wait();
    console.log("✅ Funded 10 WPOL");
    
    // Test quote
    console.log("\n7️⃣  Testing quote: 1 USDC → WPOL...");
    const amountIn = hre.ethers.parseUnits("1", 6);
    const quote = await adapter.getQuote(USDC, WPOL, amountIn);
    console.log("   Quote:", hre.ethers.formatUnits(quote, 18), "WPOL");
    
    // Calculate expected
    const usdcPrice = await hre.ethers.getContractAt("TestnetPriceOracle", TESTNET_ORACLE).then(o => o.getPrice(USDC));
    const wpolPrice = await hre.ethers.getContractAt("TestnetPriceOracle", TESTNET_ORACLE).then(o => o.getPrice(WPOL));
    
    console.log("   USDC price:", Number(usdcPrice) / 1e8, "USD");
    console.log("   WPOL price:", Number(wpolPrice) / 1e8, "USD");
    
    const expectedWPOL = (Number(usdcPrice) / Number(wpolPrice)) * 0.997;  // With slippage
    console.log("   Expected:", expectedWPOL.toFixed(6), "WPOL (with 0.3% slippage)");
    
    console.log("\n✅ DEPLOYMENT COMPLETE!");
    console.log("\n📋 SUMMARY:");
    console.log("   TestnetOracle:", TESTNET_ORACLE);
    console.log("   MockDEXAdapter:", adapterAddress);
    console.log("   RouterHub:", ROUTERHUB);
    console.log("\n📝 NEXT STEPS:");
    console.log("   1. Update frontend/src/config/contracts.json:");
    console.log(`      "mockDex": "${adapterAddress}"`);
    console.log("   2. Update backend .env:");
    console.log(`      AMOY_PYTH_ORACLE=${TESTNET_ORACLE}`);
    console.log("   3. Restart backend server");
    console.log("   4. Test swap via frontend");
    
    console.log("\n💾 Save these addresses:");
    console.log(`   TESTNET_ORACLE_AMOY=${TESTNET_ORACLE}`);
    console.log(`   MOCKDEX_ADAPTER_AMOY=${adapterAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
