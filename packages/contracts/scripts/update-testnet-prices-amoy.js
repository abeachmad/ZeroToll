const hre = require("hardhat");
const axios = require("axios");

/**
 * Update TestnetPriceOracle with REAL-TIME prices from CoinGecko
 * NO HARDCODED PRICES - fetches live data from API
 */

const ORACLE_ADDRESS = process.env.TESTNET_ORACLE_AMOY || "0xYourOracleAddress";

// Token addresses on Amoy
const TOKENS = {
    WPOL: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
    USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
};

// CoinGecko API IDs
const COINGECKO_IDS = {
    WPOL: "polygon-ecosystem-token",  // POL token (rebranded from MATIC)
    USDC: "usd-coin"
};

async function fetchRealTimePrice(coinGeckoId) {
    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd&precision=8`;
        const response = await axios.get(url);
        const priceUSD = response.data[coinGeckoId].usd;
        
        // Convert to 8 decimals (e.g., $1.50 => 150000000)
        const price8Decimals = Math.floor(priceUSD * 1e8);
        
        return {
            priceUSD,
            price8Decimals
        };
    } catch (error) {
        console.error(`❌ Failed to fetch ${coinGeckoId}:`, error.message);
        throw error;
    }
}

async function main() {
    console.log("🔄 Updating TestnetPriceOracle with REAL-TIME prices...\n");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deployer:", deployer.address);
    console.log("🔧 Oracle:", ORACLE_ADDRESS);
    
    // Check if oracle address is set
    if (ORACLE_ADDRESS === "0xYourOracleAddress") {
        console.error("\n❌ ERROR: Set TESTNET_ORACLE_AMOY environment variable!");
        console.log("   export TESTNET_ORACLE_AMOY=0xYourOracleAddress");
        process.exit(1);
    }
    
    // Connect to oracle
    const oracle = await hre.ethers.getContractAt("TestnetPriceOracle", ORACLE_ADDRESS);
    
    // Verify ownership
    const owner = await oracle.owner();
    if (owner !== deployer.address) {
        console.error(`❌ Not owner! Owner is ${owner}`);
        process.exit(1);
    }
    console.log("✅ Verified ownership\n");
    
    // Fetch real-time prices
    console.log("1️⃣  Fetching REAL-TIME prices from CoinGecko...");
    
    const wpolPrice = await fetchRealTimePrice(COINGECKO_IDS.WPOL);
    console.log(`   WPOL: $${wpolPrice.priceUSD} => ${wpolPrice.price8Decimals} (8 decimals)`);
    
    const usdcPrice = await fetchRealTimePrice(COINGECKO_IDS.USDC);
    console.log(`   USDC: $${usdcPrice.priceUSD} => ${usdcPrice.price8Decimals} (8 decimals)`);
    
    // Prepare batch update
    const tokens = [TOKENS.WPOL, TOKENS.USDC];
    const prices = [wpolPrice.price8Decimals, usdcPrice.price8Decimals];
    
    console.log("\n2️⃣  Updating oracle prices...");
    const tx = await oracle.setPrices(tokens, prices);
    console.log("   Transaction:", tx.hash);
    
    await tx.wait();
    console.log("✅ Prices updated!\n");
    
    // Verify
    console.log("3️⃣  Verifying prices...");
    const wpolStored = await oracle.getPrice(TOKENS.WPOL);
    const usdcStored = await oracle.getPrice(TOKENS.USDC);
    
    console.log(`   WPOL: ${wpolStored} (stored) vs ${wpolPrice.price8Decimals} (set)`);
    console.log(`   USDC: ${usdcStored} (stored) vs ${usdcPrice.price8Decimals} (set)`);
    
    const wpolMatch = wpolStored === BigInt(wpolPrice.price8Decimals);
    const usdcMatch = usdcStored === BigInt(usdcPrice.price8Decimals);
    
    console.log(`   WPOL match: ${wpolMatch ? "✅" : "❌"}`);
    console.log(`   USDC match: ${usdcMatch ? "✅" : "❌"}`);
    
    if (wpolMatch && usdcMatch) {
        console.log("\n🎉 Success! Prices updated with REAL-TIME data!");
        console.log("\n💡 To update prices again:");
        console.log("   npx hardhat run scripts/update-testnet-prices-amoy.js --network amoy");
    } else {
        console.error("\n❌ Price mismatch detected!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
