const hre = require("hardhat");

async function main() {
    const adapter = await hre.ethers.getContractAt("MockDEXAdapter", "0xbe6F932465D5155c1564FF0AD7Cc9D2D2a4316d5");
    const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
    
    console.log("Testing: 1 USDC → WPOL\n");
    
    const result = await adapter.getQuote(USDC, WPOL, hre.ethers.parseUnits("1", 6));
    // getQuote returns (uint256 amountOut, address[] path) - we want amountOut
    const quote = result[0] || result;
    console.log("Quote:", hre.ethers.formatUnits(quote, 18), "WPOL");
    
    // Get oracle prices
    const oracle = await hre.ethers.getContractAt("TestnetPriceOracle", "0x01520E28693118042a0d9178Be96064E6FB62612");
    const usdcPrice = await oracle.getPrice(USDC);
    const wpolPrice = await oracle.getPrice(WPOL);
    
    console.log("\nOracle prices:");
    console.log("USDC:", Number(usdcPrice) / 1e8);
    console.log("WPOL:", Number(wpolPrice) / 1e8);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
