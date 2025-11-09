const hre = require("hardhat");

const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";
const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

async function main() {
    console.log("💰 Checking balances...\n");
    
    // POL balance
    const polBalance = await hre.ethers.provider.getBalance(DEPLOYER);
    console.log("POL:", hre.ethers.formatEther(polBalance));
    
    // USDC balance
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const usdcBalance = await usdc.balanceOf(DEPLOYER);
    console.log("USDC:", hre.ethers.formatUnits(usdcBalance, 6));
    
    // WPOL balance
    const wpol = await hre.ethers.getContractAt("IERC20", WPOL);
    const wpolBalance = await wpol.balanceOf(DEPLOYER);
    console.log("WPOL:", hre.ethers.formatUnits(wpolBalance, 18));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
