// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking Amoy OLD adapter hardcoded prices...\n");

    const AMOY_RPC = "https://rpc-amoy.polygon.technology";
    const provider = new ethers.JsonRpcProvider(AMOY_RPC);

    const OLD_ADAPTER = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301";
    const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

    // Try to call getQuote
    const adapterAbi = [
        "function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut, address[] path)",
        "function priceOracle() external view returns (address)"
    ];

    const adapter = new ethers.Contract(OLD_ADAPTER, adapterAbi, provider);

    try {
        const oracle = await adapter.priceOracle();
        console.log(`Adapter oracle address: ${oracle}`);
    } catch (e) {
        console.log("Could not read oracle address (might be old version)");
    }

    console.log("\n📊 Testing getQuote for: 1 USDC → WMATIC");
    const amountIn = ethers.parseUnits("1", 6); // 1 USDC
    
    try {
        const result = await adapter.getQuote(USDC, WMATIC, amountIn);
        const amountOut = result[0];
        console.log(`Quote returned: ${ethers.formatUnits(amountOut, 18)} WMATIC`);
        console.log(`Raw value: ${amountOut.toString()} wei`);
        
        // Compare with onchain trace
        const onchainValue = "997000000000000000";
        console.log(`\nOnchain trace value: ${ethers.formatUnits(onchainValue, 18)} WMATIC`);
        console.log(`Match: ${amountOut.toString() === onchainValue}`);
        
        // Calculate what hardcoded prices this implies
        // If getQuote(1 USDC) = 0.997 WMATIC
        // Then: priceUSDC / priceWMATIC ≈ 0.997
        // If priceUSDC = $1, then priceWMATIC ≈ $1.003
        
        const impliedWMATICPrice = 1.0 / parseFloat(ethers.formatUnits(amountOut, 18));
        console.log(`\n💡 Implied WMATIC price: $${impliedWMATICPrice.toFixed(4)}`);
        console.log(`   (If USDC = $1.00)`);
        
    } catch (e) {
        console.log(`Error calling getQuote: ${e.message}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎯 CONCLUSION:");
    console.log("Amoy adapter (0x0560672...) is the OLD adapter");
    console.log("It likely has HARDCODED prices around:");
    console.log("  - USDC: $1.00");
    console.log("  - WMATIC: $1.00 (instead of real $0.55!)");
    console.log("\nThis is why quote ≈ 1.0 WMATIC instead of 1.818 WMATIC!");
}

main().catch(console.error);
