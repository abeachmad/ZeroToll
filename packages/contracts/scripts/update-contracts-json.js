/**
 * Update frontend contracts.json with deployed zToken and adapter addresses
 * 
 * Usage:
 *   node scripts/update-contracts-json.js <deployment-file>
 * 
 * Example:
 *   node scripts/update-contracts-json.js deployments/ztokens-sepolia-1234567890.json
 */

const fs = require("fs");
const path = require("path");

const CONTRACTS_JSON_PATH = "../../../frontend/src/config/contracts.json";

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("Usage: node scripts/update-contracts-json.js <deployment-file>");
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
  
  console.log(`\n📝 Updating contracts.json for ${network}...\n`);

  const contractsFile = path.join(__dirname, CONTRACTS_JSON_PATH);
  const contracts = JSON.parse(fs.readFileSync(contractsFile, "utf8"));
  
  if (!contracts[network]) {
    console.error(`Network ${network} not found in contracts.json`);
    process.exit(1);
  }

  // Add ZeroTollAdapter
  contracts[network].adapters.zeroToll = deployment.adapter;
  
  // Update gaslessTokens with zTokens (replace ZTA/ZTB)
  contracts[network].gaslessTokens = {};
  for (const [symbol, data] of Object.entries(deployment.tokens)) {
    contracts[network].gaslessTokens[symbol] = data.address;
  }
  
  // Save updated contracts.json
  fs.writeFileSync(contractsFile, JSON.stringify(contracts, null, 2));
  
  console.log(`✅ Updated ${contractsFile}`);
  console.log(`\nChanges for ${network}:`);
  console.log(`  adapters.zeroToll: ${deployment.adapter}`);
  console.log(`  gaslessTokens:`);
  for (const [symbol, data] of Object.entries(deployment.tokens)) {
    console.log(`    ${symbol}: ${data.address}`);
  }
}

main().catch(console.error);
