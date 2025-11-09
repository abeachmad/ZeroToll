const hre = require("hardhat");

const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";
const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function main() {
    console.log("💰 Checking Sepolia balances...\n");
    
    // ETH balance
    const ethBalance = await hre.ethers.provider.getBalance(DEPLOYER);
    console.log("ETH:", hre.ethers.formatEther(ethBalance));
    
    // WETH balance
    const weth = await hre.ethers.getContractAt("IERC20", WETH);
    const wethBalance = await weth.balanceOf(DEPLOYER);
    console.log("WETH:", hre.ethers.formatUnits(wethBalance, 18));
    
    // USDC balance
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const usdcBalance = await usdc.balanceOf(DEPLOYER);
    console.log("USDC:", hre.ethers.formatUnits(usdcBalance, 6));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
