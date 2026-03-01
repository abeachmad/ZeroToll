// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking SEPOLIA adapter (Pyth-enabled)...\n");

    const SEPOLIA_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";  // NEW Pyth adapter
    const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"; // More reliable RPC
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, 11155111, {
        staticNetwork: true // Skip network detection to avoid 522 errors
    });

    const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Correct checksum
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Correct checksum

    const adapterAbi = [
        "function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut, address[] path)",
        "function priceOracle() external view returns (address)"
    ];

    const adapter = new ethers.Contract(SEPOLIA_ADAPTER, adapterAbi, provider);

    try {
        const oracle = await adapter.priceOracle();
        console.log(`Adapter oracle: ${oracle}`);
        
        if (oracle.toLowerCase() !== "0x0000000000000000000000000000000000000001") {
            console.log("✅ This is a REAL Pyth oracle!\n");
            
            // Try to read prices
            const oracleAbi = ["function getPrice(address token) external view returns (uint256)"];
            const oracleContract = new ethers.Contract(oracle, oracleAbi, provider);
            
            try {
                const wethPrice = await oracleContract.getPrice(WETH);
                const usdcPrice = await oracleContract.getPrice(USDC);
                
                console.log(`Pyth prices:`);
                console.log(`  WETH: ${wethPrice.toString()} = $${Number(wethPrice) / 1e8}`);
                console.log(`  USDC: ${usdcPrice.toString()} = $${Number(usdcPrice) / 1e8}\n`);
                
            } catch (e) {
                console.log(`Could not read prices: ${e.message}\n`);
            }
        } else {
            console.log("⚠️  This is the dummy oracle (hardcoded $1)\n");
        }
        
    } catch (e) {
        console.log(`Error: ${e.message}\n`);
    }

    // Test getQuote for the FAILED transaction
    console.log("📞 Testing: 0.001 WETH → USDC");
    const amountIn = ethers.parseUnits("0.001", 18);  // 0.001 WETH
    
    try {
        const result = await adapter.getQuote(WETH, USDC, amountIn);
        const quote = result[0];
        
        console.log(`✅ Quote: ${ethers.formatUnits(quote, 6)} USDC`);
        console.log(`   Raw: ${quote.toString()}\n`);
        
        // minOut from failed transaction
        const minOut = 3257601;  // 3.257601 USDC
        const quoteLargeEnough = quote >= minOut;
        
        console.log(`MinOut required: ${minOut / 1e6} USDC`);
        console.log(`Quote sufficient: ${quoteLargeEnough ? '✅' : '❌'}\n`);
        
        if (!quoteLargeEnough) {
            console.log(`❌ PROBLEM: Quote (${Number(quote) / 1e6}) < minOut (${minOut / 1e6})`);
            console.log(`   This explains the Sepolia failure!\n`);
        }
        
    } catch (e) {
        console.log(`❌ Error calling getQuote: ${e.message}\n`);
    }

    console.log("=".repeat(70));
    console.log("🎯 ROOT CAUSE:");
    console.log("Both Sepolia and Amoy adapters have the SAME bug:");
    console.log("getQuote() doesn't normalize Pyth prices (8 decimals)");
    console.log("\nThis causes quotes to be ~1e8 times too large or too small");
    console.log("depending on decimal differences between tokens.");
}

main().catch(console.error);
