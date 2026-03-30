/**
 * Update shared ZeroToll source config with deployed zToken and adapter addresses.
 *
 * Usage:
 *   node scripts/update-contracts-json.js <deployment-file>
 *
 * Example:
 *   node scripts/update-contracts-json.js deployments/ztokens-sepolia-1234567890.json
 */

const fs = require("fs");
const path = require("path");
const {
  getChainConfig,
  loadSharedConfig,
  saveSharedConfig,
  syncSharedConfig,
  upsertToken,
} = require("../../shared-config/scripts/shared-config.cjs");

function applyZTokenDeployment(config, deployment) {
  const { key, chain } = getChainConfig(config, deployment.network);

  if (deployment.adapter) {
    if (!chain.contracts.adapters) {
      chain.contracts.adapters = {};
    }
    chain.contracts.adapters.zeroToll = deployment.adapter;
  }

  const updatedTokens = [];
  for (const [symbol, data] of Object.entries(deployment.tokens || {})) {
    const token = upsertToken(chain, symbol, {
      symbol,
      name: data.name,
      address: data.address,
      decimals: data.decimals,
      isNative: false,
      isGasless: true,
      permitType: "ERC2612",
    });
    updatedTokens.push({ symbol, address: token.address });
  }

  return {
    networkKey: key,
    adapter: deployment.adapter || null,
    updatedTokens,
  };
}

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
  const sharedConfig = loadSharedConfig();

  console.log(`\n📝 Updating shared source config for ${deployment.network}...\n`);

  const result = applyZTokenDeployment(sharedConfig, deployment);
  saveSharedConfig(sharedConfig);

  console.log("♻️  Regenerating frontend/backend artifacts...\n");
  syncSharedConfig();
  
  console.log(`✅ Updated shared source config for ${result.networkKey}`);
  if (result.adapter) {
    console.log(`  adapters.zeroToll: ${result.adapter}`);
  }
  console.log(`  zTokens:`);
  for (const token of result.updatedTokens) {
    console.log(`    ${token.symbol}: ${token.address}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  applyZTokenDeployment,
  main,
};
