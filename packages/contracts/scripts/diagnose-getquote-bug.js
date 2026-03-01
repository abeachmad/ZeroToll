// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Investigating Amoy adapter getQuote bug...\n");

    const AMOY_RPC = "https://rpc-amoy.polygon.technology";
    const provider = new ethers.JsonRpcProvider(AMOY_RPC);

    const ADAPTER = "0x7cafe27c7367fa0e929d4e83578cec838e3ceec7";
    const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

    const adapterAbi = [
        "function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut, address[] path)",
        "function priceOracle() external view returns (address)",
        "function SIMULATED_SLIPPAGE_BPS() external view returns (uint256)"
    ];

    const adapter = new ethers.Contract(ADAPTER, adapterAbi, provider);

    // Check oracle
    try {
        const oracle = await adapter.priceOracle();
        console.log(`✅ Adapter uses oracle: ${oracle}\n`);
        
        // Check if it's the Pyth oracle or hardcoded
        const oracleAbi = ["function getPrice(address token) external view returns (uint256)"];
        const oracleContract = new ethers.Contract(oracle, oracleAbi, provider);
        
        try {
            const usdcPrice = await oracleContract.getPrice(USDC);
            const wmaticPrice = await oracleContract.getPrice(WMATIC);
            
            console.log(`Oracle prices (8-decimal format):`);
            console.log(`  USDC: ${usdcPrice.toString()} = $${Number(usdcPrice) / 1e8}`);
            console.log(`  WMATIC: ${wmaticPrice.toString()} = $${Number(wmaticPrice) / 1e8}\n`);
            
            // Calculate expected quote
            const amountIn = ethers.parseUnits("1", 6);  // 1 USDC
            const decimalsIn = 6;
            const decimalsOut = 18;
            
            // Current (BUGGY) formula:
            // amountOut = (amountIn * priceIn * 10^(18-6)) / priceOut
            const buggyQuote = (amountIn * usdcPrice * (10n ** BigInt(decimalsOut - decimalsIn))) / wmaticPrice;
            
            // After slippage (30 bps)
            const slippageBps = 30n;
            const buggyWithSlippage = (buggyQuote * (10000n - slippageBps)) / 10000n;
            
            console.log(`📐 CALCULATED (using BUGGY formula):`);
            console.log(`  Quote: ${ethers.formatUnits(buggyQuote, 18)} WMATIC`);
            console.log(`  With slippage: ${ethers.formatUnits(buggyWithSlippage, 18)} WMATIC\n`);
            
            // CORRECT formula:
            // amountOut = (amountIn * priceIn * 10^(18-6)) / (priceOut * 10^8)
            const priceDecimals = 8n;
            const correctQuote = (amountIn * usdcPrice * (10n ** BigInt(decimalsOut - decimalsIn))) / (wmaticPrice * (10n ** priceDecimals));
            const correctWithSlippage = (correctQuote * (10000n - slippageBps)) / 10000n;
            
            console.log(`📐 CORRECTED (with price normalization):`);
            console.log(`  Quote: ${ethers.formatUnits(correctQuote, 18)} WMATIC`);
            console.log(`  With slippage: ${ethers.formatUnits(correctWithSlippage, 18)} WMATIC\n`);
            
        } catch (e) {
            console.log(`Could not read oracle prices: ${e.message}\n`);
        }
        
    } catch (e) {
        console.log(`Error reading oracle: ${e.message}\n`);
    }

    // Test getQuote directly
    console.log(`📞 Calling adapter.getQuote(1 USDC → WMATIC)...`);
    const amountIn = ethers.parseUnits("1", 6);
    
    try {
        const result = await adapter.getQuote(USDC, WMATIC, amountIn);
        const amountOut = result[0];
        
        console.log(`✅ Result: ${ethers.formatUnits(amountOut, 18)} WMATIC`);
        console.log(`   Raw: ${amountOut.toString()} wei\n`);
        
        // Compare with internal trace
        const traceValue = "997000000000000000";
        const matches = amountOut.toString() === traceValue;
        console.log(`Internal trace value: ${ethers.formatUnits(traceValue, 18)} WMATIC`);
        console.log(`Match: ${matches ? '✅' : '❌'}\n`);
        
    } catch (e) {
        console.log(`❌ Error: ${e.message}\n`);
        if (e.data) {
            console.log(`Error data: ${e.data}`);
        }
    }

    console.log("=".repeat(70));
    console.log("🎯 CONCLUSION:");
    console.log("MockDEXAdapter.getQuote() formula is BUGGY!");
    console.log("It doesn't divide by 10^8 to normalize Pyth prices.");
    console.log("\nFIX: Change line ~169 in MockDEXAdapter.sol:");
    console.log("FROM: amountOut = (amountIn * priceIn * ...) / priceOut");
    console.log("TO:   amountOut = (amountIn * priceIn * ...) / (priceOut * 10^8)");
}

main().catch(console.error);
