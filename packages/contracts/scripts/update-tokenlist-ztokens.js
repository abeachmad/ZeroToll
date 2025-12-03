/**
 * Update frontend token lists with deployed zToken addresses
 * 
 * Usage:
 *   node scripts/update-tokenlist-ztokens.js <deployment-file>
 * 
 * Example:
 *   node scripts/update-tokenlist-ztokens.js deployments/ztokens-sepolia-1234567890.json
 */

const fs = require("fs");
const path = require("path");

// Pyth Price Feed IDs
const PYTH_PRICE_IDS = {
  ETH_USD: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  USDC_USD: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  MATIC_USD: "0x5de33440f6c8ee7a2c3c3e5e8b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e",
  LINK_USD: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221"
};

// Token list file mapping
const TOKEN_LIST_FILES = {
  sepolia: "../../../frontend/src/config/tokenlists/zerotoll.tokens.sepolia.json",
  amoy: "../../../frontend/src/config/tokenlists/zerotoll.tokens.amoy.json"
};

// zToken definitions (to be added to token lists)
function createZTokenEntries(deployment) {
  const tokens = [];
  
  for (const [symbol, data] of Object.entries(deployment.tokens)) {
    tokens.push({
      symbol,
      name: data.name,
      logo: getLogoForSymbol(symbol),
      address: data.address,
      decimals: data.decimals,
      isNative: false,
      isGasless: true,
      permitType: "ERC2612",
      pythPriceId: data.priceId,
      feeModes: ["INPUT", "OUTPUT"]
    });
  }
  
  return tokens;
}

function getLogoForSymbol(symbol) {
  const logos = {
    zUSDC: "💵",
    zETH: "💎",
    zPOL: "🔷",
    zLINK: "🔗"
  };
  return logos[symbol] || "⚡";
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("Usage: node scripts/update-tokenlist-ztokens.js <deployment-file>");
    console.log("\nAvailable deployment files:");
    
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const files = fs.readdirSync(deploymentsDir).filter(f => f.startsWith("ztokens-"));
    files.forEach(f => console.log(`  deployments/${f}`));
    
    process.exit(1);
  }

  const deploymentFile = path.join(__dirname, "..", args[0]);
  
  if (!fs.existsSync(deploymentFile)) {
    console.error(`Deployment file not found: ${deploymentFile}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const network = deployment.network;
  
  console.log(`\n📝 Updating token list for ${network}...\n`);

  const tokenListFile = path.join(__dirname, TOKEN_LIST_FILES[network]);
  
  if (!fs.existsSync(tokenListFile)) {
    console.error(`Token list file not found: ${tokenListFile}`);
    process.exit(1);
  }

  const tokenList = JSON.parse(fs.readFileSync(tokenListFile, "utf8"));
  
  // Remove old ZTA/ZTB tokens
  tokenList.tokens = tokenList.tokens.filter(t => !["ZTA", "ZTB"].includes(t.symbol));
  
  // Add new zTokens at the beginning
  const zTokenEntries = createZTokenEntries(deployment);
  tokenList.tokens = [...zTokenEntries, ...tokenList.tokens];
  
  // Add adapter address to the token list metadata
  tokenList.zeroTollAdapter = deployment.adapter;
  
  // Save updated token list
  fs.writeFileSync(tokenListFile, JSON.stringify(tokenList, null, 2));
  
  console.log(`✅ Updated ${tokenListFile}`);
  console.log(`\nAdded zTokens:`);
  zTokenEntries.forEach(t => console.log(`  ${t.symbol}: ${t.address}`));
  console.log(`\nZeroTollAdapter: ${deployment.adapter}`);
  console.log(`\nRemoved: ZTA, ZTB`);
}

main().catch(console.error);
