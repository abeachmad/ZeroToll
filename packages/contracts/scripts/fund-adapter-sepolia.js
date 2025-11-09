const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    const ADAPTER_ADDRESS = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";

    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    
    // Check deployer balance
    const balance = await usdc.balanceOf(deployer.address);
    console.log(`Deployer USDC balance: ${ethers.formatUnits(balance, 6)} USDC`);

    if (balance < ethers.parseUnits("5", 6)) {
        console.log("❌ Insufficient USDC. Get some from faucet: https://faucet.circle.com/");
        return;
    }

    // Transfer 10 USDC to adapter (keep some for gas)
    const amount = ethers.parseUnits("10", 6);
    console.log(`\nTransferring 10 USDC to adapter...`);
    
    const tx = await usdc.transfer(ADAPTER_ADDRESS, amount);
    console.log(`Transaction: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Transfer complete!");

    // Verify
    const adapterBalance = await usdc.balanceOf(ADAPTER_ADDRESS);
    console.log(`Adapter USDC balance: ${ethers.formatUnits(adapterBalance, 6)} USDC`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
