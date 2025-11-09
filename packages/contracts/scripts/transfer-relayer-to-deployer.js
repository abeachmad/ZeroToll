const hre = require("hardhat");

/**
 * Transfer assets from relayer to deployer
 * Keep operational reserve for relayer (1 ETH + 100 USDC on each network)
 */

// Addresses
const RELAYER_ADDRESS = "0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A";
const RELAYER_PRIVATE_KEY = "0x470e31d6cb154d9c5fe824241d57689665869db3df390278570aeecd2318116c";
const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";

// Operational reserves (keep this much for relayer operations)
const NATIVE_RESERVE = hre.ethers.parseEther("0.1"); // 0.1 ETH/POL
const USDC_RESERVE_SEPOLIA = hre.ethers.parseUnits("100", 6); // 100 USDC on Sepolia
const USDC_RESERVE_AMOY = hre.ethers.parseUnits("50", 6); // 50 USDC on Amoy (already minimal)

async function main() {
    console.log("💸 Transferring assets from relayer to deployer...\n");
    
    const network = hre.network.name;
    console.log("📡 Network:", network);
    
    // Connect relayer wallet
    const relayerWallet = new hre.ethers.Wallet(RELAYER_PRIVATE_KEY, hre.ethers.provider);
    console.log("📝 Relayer:", relayerWallet.address);
    console.log("📝 Deployer:", DEPLOYER);
    
    // Token addresses
    let USDC, WETH, WPOL;
    if (network === "sepolia") {
        USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
        WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    } else if (network === "amoy") {
        USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
        WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
    }
    
    // Check current balances
    console.log("\n1️⃣  Current balances:");
    const nativeBalance = await hre.ethers.provider.getBalance(RELAYER_ADDRESS);
    console.log(`   ${network === "sepolia" ? "ETH" : "POL"}: ${hre.ethers.formatEther(nativeBalance)}`);
    
    const usdc = await hre.ethers.getContractAt("IERC20", USDC);
    const usdcBalance = await usdc.balanceOf(RELAYER_ADDRESS);
    console.log(`   USDC: ${hre.ethers.formatUnits(usdcBalance, 6)}`);
    
    // Calculate transferable amounts
    console.log("\n2️⃣  Calculating transferable amounts...");
    
    const usdcReserve = network === "sepolia" ? USDC_RESERVE_SEPOLIA : USDC_RESERVE_AMOY;
    const usdcTransferable = usdcBalance > usdcReserve ? usdcBalance - usdcReserve : 0n;
    
    console.log(`   USDC reserve: ${hre.ethers.formatUnits(usdcReserve, 6)}`);
    console.log(`   USDC transferable: ${hre.ethers.formatUnits(usdcTransferable, 6)}`);
    
    if (usdcTransferable === 0n) {
        console.log("\n✅ No excess USDC to transfer (at or below reserve)");
        return;
    }
    
    // Transfer USDC
    console.log("\n3️⃣  Transferring USDC...");
    console.log(`   Amount: ${hre.ethers.formatUnits(usdcTransferable, 6)} USDC`);
    console.log(`   From: ${RELAYER_ADDRESS}`);
    console.log(`   To: ${DEPLOYER}`);
    
    const tx = await usdc.connect(relayerWallet).transfer(DEPLOYER, usdcTransferable);
    console.log("   Transaction:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transfer successful!");
    console.log("   Block:", receipt.blockNumber);
    
    // Final balances
    console.log("\n4️⃣  Final balances:");
    
    const relayerUSDC = await usdc.balanceOf(RELAYER_ADDRESS);
    const deployerUSDC = await usdc.balanceOf(DEPLOYER);
    
    console.log(`   Relayer USDC: ${hre.ethers.formatUnits(relayerUSDC, 6)} (reserve maintained)`);
    console.log(`   Deployer USDC: ${hre.ethers.formatUnits(deployerUSDC, 6)}`);
    
    console.log("\n🎉 Transfer complete!");
    console.log("\n📋 Summary:");
    console.log(`   Transferred: ${hre.ethers.formatUnits(usdcTransferable, 6)} USDC`);
    console.log(`   Network: ${network}`);
    console.log(`   Tx: ${tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
