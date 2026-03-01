const { ethers } = require("hardhat");

async function main() {
    // Simulate the exact call that failed
    const routerHub = await ethers.getContractAt("RouterHub", "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd");
    const adapter = await ethers.getContractAt("MockDEXAdapter", "0x86D1AA2228F3ce649d415F19fC71134264D0E84B");
    
    const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    
    console.log("Testing adapter swap function:");
    console.log("Adapter:", await adapter.getAddress());
    
    try {
        // Call adapter's swap function directly (static call)
        const amountOut = await adapter.swap.staticCall(
            WETH,  // tokenIn
            USDC,  // tokenOut
            ethers.parseEther("0.001"),  // amountIn
            3257601,  // minAmountOut (from log)
            "0x5a87A3c738cf99DB95787D51B627217B6dE12F62"  // recipient (user)
        );
        
        console.log(`✅ Adapter swap would return: ${ethers.formatUnits(amountOut, 6)} USDC`);
    } catch (error) {
        console.log(`❌ Adapter swap would FAIL: ${error.message}`);
        
        // Try getQuote to see what it returns
        const quoteResult = await adapter.getQuote(WETH, USDC, ethers.parseEther("0.001"));
        // getQuote returns (uint256 amountOut, address[] path)
        const quote = quoteResult[0];  // First element is amountOut
        console.log(`\nAdapter getQuote returns: ${ethers.formatUnits(quote, 6)} USDC`);
        console.log(`minOut required: 3.257601 USDC`);
        
        if (quote >= 3257601n) {
            console.log("⚠️  Quote is sufficient but swap still fails!\n");
            console.log("Checking adapter USDC balance...");
            
            const usdcContract = await ethers.getContractAt("IERC20", USDC);
            const balance = await usdcContract.balanceOf(await adapter.getAddress());
            console.log(`Adapter USDC balance: ${ethers.formatUnits(balance, 6)} USDC`);
            
            if (balance < quote) {
                console.log("\n❌ ROOT CAUSE: Adapter has insufficient USDC reserves!");
                console.log(`   Needed: ${ethers.formatUnits(quote, 6)} USDC`);
                console.log(`   Has: ${ethers.formatUnits(balance, 6)} USDC`);
                console.log(`   Shortfall: ${ethers.formatUnits(quote - balance, 6)} USDC`);
            } else {
                console.log("✅ Adapter has sufficient USDC");
                console.log("\nChecking user WETH allowance...");
                
                const wethContract = await ethers.getContractAt("IERC20", WETH);
                const routerAddress = await routerHub.getAddress();
                const allowance = await wethContract.allowance(
                    "0x5a87A3c738cf99DB95787D51B627217B6dE12F62",
                    routerAddress
                );
                console.log(`User WETH allowance to RouterHub: ${ethers.formatEther(allowance)} WETH`);
                
                if (allowance < ethers.parseEther("0.001")) {
                    console.log("❌ ROOT CAUSE: Insufficient allowance!");
                }
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
