const hre = require("hardhat");

/**
 * Rescue tokens from OLD adapters before switching to NEW adapters
 * CRITICAL: Must recover all funds before whitelisting new adapters!
 * 
 * USAGE:
 * npx hardhat run scripts/rescue-old-adapters.js --network sepolia
 * npx hardhat run scripts/rescue-old-adapters.js --network amoy
 */

// Old adapters with funds (from balance check)
const RESCUE_CONFIG = {
  sepolia: [
    {
      adapter: "0x86D1AA2228F3ce649d415F19fC71134264D0E84B",
      desc: "Old MockDEX v1",
      tokens: {
        WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      }
    },
    {
      adapter: "0x3522D5F996a506374c33835a985Bf7ec775403B2",
      desc: "Old MockDEX v2 (empty but check anyway)",
      tokens: {
        WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      }
    }
  ],
  amoy: [
    {
      adapter: "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301",
      desc: "Very old adapter",
      tokens: {
        WPOL: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
        USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
      }
    },
    {
      adapter: "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7",
      desc: "Old adapter v2",
      tokens: {
        WPOL: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
        USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
      }
    },
    {
      adapter: "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec",
      desc: "Most recent (pre-Pyth)",
      tokens: {
        WPOL: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
        USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
      }
    }
  ]
};

async function checkAndRescueAdapter(adapterAddr, desc, tokens, recipient) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Rescuing from: ${desc}`);
  console.log(`Adapter: ${adapterAddr}`);
  console.log(`Recipient: ${recipient}`);
  console.log();
  
  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", adapterAddr);
  const adapterOwner = await adapter.owner();
  
  console.log(`Adapter owner: ${adapterOwner}`);
  
  let totalRescued = 0;
  
  // Check and rescue each token
  for (const [symbol, tokenAddr] of Object.entries(tokens)) {
    const token = await hre.ethers.getContractAt("IERC20", tokenAddr);
    const decimals = symbol === "USDC" ? 6 : 18;
    
    const balance = await token.balanceOf(adapterAddr);
    const formatted = hre.ethers.formatUnits(balance, decimals);
    
    if (parseFloat(formatted) > 0) {
      console.log(`  💰 Found ${symbol}: ${formatted}`);
      console.log(`     Rescuing...`);
      
      try {
        // MockDEXAdapter has rescueTokens(address token, uint256 amount) onlyOwner
        const tx = await adapter.rescueTokens(tokenAddr, balance);
        const receipt = await tx.wait();
        
        console.log(`     ✅ Rescued! TX: ${receipt.hash}`);
        console.log(`     Gas used: ${receipt.gasUsed.toString()}`);
        totalRescued++;
      } catch (error) {
        console.log(`     ❌ Failed to rescue ${symbol}:`, error.message);
        
        // Check if we're the owner
        const [signer] = await hre.ethers.getSigners();
        if (adapterOwner.toLowerCase() !== signer.address.toLowerCase()) {
          console.log(`     ⚠️  You are not the owner! Owner is: ${adapterOwner}`);
        }
      }
    } else {
      console.log(`  ✓ ${symbol}: 0 (empty)`);
    }
  }
  
  // Check native balance
  const nativeBalance = await hre.ethers.provider.getBalance(adapterAddr);
  const nativeFormatted = hre.ethers.formatEther(nativeBalance);
  const nativeSymbol = hre.network.name === "sepolia" ? "ETH" : "POL";
  
  if (parseFloat(nativeFormatted) > 0) {
    console.log(`  💰 Found native ${nativeSymbol}: ${nativeFormatted}`);
    console.log(`     ⚠️  Note: Native token rescue may require special function`);
    console.log(`     Manual rescue: Send transaction to adapter owner`);
  } else {
    console.log(`  ✓ Native ${nativeSymbol}: 0 (empty)`);
  }
  
  return totalRescued;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  
  console.log("🚨 RESCUE OPERATION: OLD ADAPTER FUNDS");
  console.log("━".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Rescuer: ${deployer.address}`);
  console.log(`Recipient: ${deployer.address} (same as rescuer)`);
  console.log("━".repeat(60));
  
  const config = RESCUE_CONFIG[network];
  
  if (!config || config.length === 0) {
    console.log(`\n⚠️  No old adapters configured for ${network}`);
    console.log("Either no old adapters exist, or they've already been rescued.");
    return;
  }
  
  console.log(`\nFound ${config.length} old adapter(s) to check`);
  
  let totalAdaptersProcessed = 0;
  let totalTokensRescued = 0;
  
  // Process in order (oldest first)
  for (const adapterConfig of config) {
    const rescued = await checkAndRescueAdapter(
      adapterConfig.adapter,
      adapterConfig.desc,
      adapterConfig.tokens,
      deployer.address
    );
    
    totalAdaptersProcessed++;
    totalTokensRescued += rescued;
  }
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📊 RESCUE SUMMARY`);
  console.log(`━`.repeat(60));
  console.log(`Adapters processed: ${totalAdaptersProcessed}`);
  console.log(`Tokens rescued: ${totalTokensRescued}`);
  console.log();
  
  if (totalTokensRescued > 0) {
    console.log(`✅ Rescue complete! Funds transferred to: ${deployer.address}`);
    console.log();
    console.log(`💡 Next steps:`);
    console.log(`  1. Verify funds received in your wallet`);
    console.log(`  2. Transfer rescued tokens to NEW adapters if needed`);
    console.log(`  3. Proceed with whitelisting NEW adapters`);
  } else {
    console.log(`ℹ️  No tokens were rescued (adapters already empty)`);
    console.log();
    console.log(`✅ Safe to proceed with whitelisting NEW adapters`);
  }
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Rescue operation failed:", error);
    process.exit(1);
  });
