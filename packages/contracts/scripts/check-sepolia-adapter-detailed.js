// Check Sepolia adapter balances and simulate swap
const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 DETAILED Sepolia Adapter Analysis\n");

    const SEPOLIA_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";
    const ROUTER_HUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
    const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
    
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, 11155111, {
        staticNetwork: true
    });

    const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    const USER = "0x5a87A3c738Cf99dB95787D51B627217b6De12f62"; // from failed TX

    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ];

    const weth = new ethers.Contract(WETH, erc20Abi, provider);
    const usdc = new ethers.Contract(USDC, erc20Abi, provider);

    console.log("📊 Token Balances:");
    console.log("==================");
    
    // Check adapter balances
    const adapterWeth = await weth.balanceOf(SEPOLIA_ADAPTER);
    const adapterUsdc = await usdc.balanceOf(SEPOLIA_ADAPTER);
    const wethDecimals = await weth.decimals();
    const usdcDecimals = await usdc.decimals();
    
    console.log(`\nAdapter (${SEPOLIA_ADAPTER}):`);
    console.log(`  WETH: ${ethers.formatUnits(adapterWeth, wethDecimals)} WETH`);
    console.log(`  USDC: ${ethers.formatUnits(adapterUsdc, usdcDecimals)} USDC`);
    
    // Check RouterHub balances
    const hubWeth = await weth.balanceOf(ROUTER_HUB);
    const hubUsdc = await usdc.balanceOf(ROUTER_HUB);
    
    console.log(`\nRouterHub (${ROUTER_HUB}):`);
    console.log(`  WETH: ${ethers.formatUnits(hubWeth, wethDecimals)} WETH`);
    console.log(`  USDC: ${ethers.formatUnits(hubUsdc, usdcDecimals)} USDC`);
    
    // Check user balances
    const userWeth = await weth.balanceOf(USER);
    const userUsdc = await usdc.balanceOf(USER);
    
    console.log(`\nUser (${USER}):`);
    console.log(`  WETH: ${ethers.formatUnits(userWeth, wethDecimals)} WETH`);
    console.log(`  USDC: ${ethers.formatUnits(userUsdc, usdcDecimals)} USDC`);

    // Simulate the swap
    console.log("\n📞 Simulating Swap:");
    console.log("===================");
    
    const adapterAbi = [
        "function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut, address[] path)"
    ];
    const adapter = new ethers.Contract(SEPOLIA_ADAPTER, adapterAbi, provider);
    
    const amountIn = ethers.parseEther("0.001"); // 0.001 WETH
    const [quote] = await adapter.getQuote(WETH, USDC, amountIn);
    
    console.log(`Input: 0.001 WETH`);
    console.log(`Quote: ${ethers.formatUnits(quote, usdcDecimals)} USDC`);
    console.log(`MinOut: 3.257601 USDC (from failed TX)`);
    
    // Check if adapter has enough USDC
    if (adapterUsdc >= quote) {
        console.log(`\n✅ Adapter has enough USDC (${ethers.formatUnits(adapterUsdc, usdcDecimals)} >= ${ethers.formatUnits(quote, usdcDecimals)})`);
    } else {
        console.log(`\n❌ Adapter INSUFFICIENT USDC!`);
        console.log(`   Has: ${ethers.formatUnits(adapterUsdc, usdcDecimals)} USDC`);
        console.log(`   Needs: ${ethers.formatUnits(quote, usdcDecimals)} USDC`);
        console.log(`   Shortfall: ${ethers.formatUnits(quote - adapterUsdc, usdcDecimals)} USDC`);
    }
}

main().catch(console.error);
