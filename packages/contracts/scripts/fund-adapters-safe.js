const hre = require("hardhat");

/**
 * Fund adapters with USDC - SAME CHAIN TRANSFERS ONLY!
 * NO CROSS-CHAIN! NO BRIDGE! NO CCTP!
 * 
 * Amoy: Use USDC already on Amoy (deployer has 20 USDC)
 * Sepolia: Use USDC already on Sepolia (deployer has 6158 USDC)
 */

const DEPLOYER = "0x330A86eE67bA0Da0043EaD201866A32d362C394c";

// Network-specific configs
const NETWORKS = {
    amoy: {
        adapter: "0xbe6F932465D5155c1564FF0AD7Cc9D2D2a4316d5",  // NEW adapter with TestnetOracle
        usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
        wpol: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
        fundAmounts: {
            usdc: "15",      // 15 USDC (keep 5 for deployer)
            wpol: "5"        // 5 WPOL (keep 5 for deployer)
        }
    },
    sepolia: {
        adapter: "0x86D1AA2228F3ce649d415F19fC71134264D0E84B",
        usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        fundAmounts: {
            usdc: "100",     // 100 USDC (keep 6058 for deployer)
            weth: "0"        // 0 WETH (deployer has 0)
        }
    }
};

async function main() {
    console.log("💰 Funding Adapters - SAME CHAIN TRANSFERS ONLY!");
    console.log("🚫 NO CROSS-CHAIN! NO BRIDGE! NO CCTP!");
    console.log("═".repeat(70));
    
    const network = hre.network.name;
    console.log(`\n📡 Network: ${network.toUpperCase()}`);
    
    if (!NETWORKS[network]) {
        console.error(`❌ Unsupported network: ${network}`);
        console.log("   Supported: amoy, sepolia");
        process.exit(1);
    }
    
    const config = NETWORKS[network];
    const [signer] = await hre.ethers.getSigners();
    
    console.log(`📝 Deployer: ${signer.address}`);
    console.log(`🎯 Adapter: ${config.adapter}`);
    
    // Safety check
    if (signer.address !== DEPLOYER) {
        console.error(`\n❌ ERROR: Signer mismatch!`);
        console.error(`   Expected: ${DEPLOYER}`);
        console.error(`   Got: ${signer.address}`);
        process.exit(1);
    }
    
    // Check current balances
    console.log(`\n1️⃣  Checking current balances...`);
    
    const usdc = await hre.ethers.getContractAt("IERC20", config.usdc);
    const deployerUSDC = await usdc.balanceOf(DEPLOYER);
    const adapterUSDC = await usdc.balanceOf(config.adapter);
    
    console.log(`   Deployer USDC: ${hre.ethers.formatUnits(deployerUSDC, 6)}`);
    console.log(`   Adapter USDC: ${hre.ethers.formatUnits(adapterUSDC, 6)}`);
    
    // Calculate transfer amount
    const usdcToTransfer = hre.ethers.parseUnits(config.fundAmounts.usdc, 6);
    
    if (deployerUSDC < usdcToTransfer) {
        console.error(`\n❌ Insufficient USDC!`);
        console.error(`   Need: ${config.fundAmounts.usdc} USDC`);
        console.error(`   Have: ${hre.ethers.formatUnits(deployerUSDC, 6)} USDC`);
        process.exit(1);
    }
    
    // Transfer USDC (SAME CHAIN - SAFE!)
    console.log(`\n2️⃣  Transferring USDC (SAME CHAIN - NO BRIDGE!)...`);
    console.log(`   Amount: ${config.fundAmounts.usdc} USDC`);
    console.log(`   From: ${DEPLOYER} (Deployer)`);
    console.log(`   To: ${config.adapter} (Adapter)`);
    console.log(`   ⚠️  This is a SIMPLE ERC20 transfer - NO BURN!`);
    
    const txUSDC = await usdc.transfer(config.adapter, usdcToTransfer);
    console.log(`   Transaction: ${txUSDC.hash}`);
    
    await txUSDC.wait();
    console.log(`   ✅ USDC transferred!`);
    
    // Transfer WPOL/WETH if applicable
    if (network === "amoy" && parseFloat(config.fundAmounts.wpol) > 0) {
        console.log(`\n3️⃣  Transferring WPOL (SAME CHAIN - NO BRIDGE!)...`);
        
        const wpol = await hre.ethers.getContractAt("IERC20", config.wpol);
        const deployerWPOL = await wpol.balanceOf(DEPLOYER);
        const wpolToTransfer = hre.ethers.parseUnits(config.fundAmounts.wpol, 18);
        
        console.log(`   Deployer WPOL: ${hre.ethers.formatUnits(deployerWPOL, 18)}`);
        console.log(`   Amount: ${config.fundAmounts.wpol} WPOL`);
        
        if (deployerWPOL >= wpolToTransfer) {
            const txWPOL = await wpol.transfer(config.adapter, wpolToTransfer);
            console.log(`   Transaction: ${txWPOL.hash}`);
            await txWPOL.wait();
            console.log(`   ✅ WPOL transferred!`);
        } else {
            console.log(`   ⚠️  Insufficient WPOL - skipping`);
        }
    }
    
    // Verify final balances
    console.log(`\n4️⃣  Final balances:`);
    
    const finalDeployerUSDC = await usdc.balanceOf(DEPLOYER);
    const finalAdapterUSDC = await usdc.balanceOf(config.adapter);
    
    console.log(`   Deployer USDC: ${hre.ethers.formatUnits(finalDeployerUSDC, 6)}`);
    console.log(`   Adapter USDC: ${hre.ethers.formatUnits(finalAdapterUSDC, 6)}`);
    
    if (network === "amoy") {
        const wpol = await hre.ethers.getContractAt("IERC20", config.wpol);
        const finalAdapterWPOL = await wpol.balanceOf(config.adapter);
        console.log(`   Adapter WPOL: ${hre.ethers.formatUnits(finalAdapterWPOL, 18)}`);
    }
    
    console.log(`\n✅ Funding complete!`);
    console.log(`\n🎉 SUCCESS - NO TOKENS BURNED!`);
    console.log(`   All transfers were SAME CHAIN`);
    console.log(`   No CCTP, no bridge, no burn!`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
