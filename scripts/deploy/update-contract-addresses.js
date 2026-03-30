#!/usr/bin/env node

/**
 * Auto-update shared ZeroToll source config from deployment artifacts.
 *
 * This script no longer writes directly to frontend/backend generated config files.
 * It updates packages/shared-config/src/source-of-truth.json and then regenerates
 * the derived artifacts used by the current apps.
 */

const fs = require('fs');
const path = require('path');
const {
  repoRoot,
  normalizeNetworkName,
  loadSharedConfig,
  saveSharedConfig,
  syncSharedConfig,
  ensureNestedObject,
  getDeploymentTimestamp,
} = require('../../packages/shared-config/scripts/shared-config.cjs');
const deploymentsDir = path.join(repoRoot, 'packages/contracts/deployments');

const fieldExtractors = [
  { key: 'routerHub', extract: (deployment) => deployment.routerHub || deployment.contracts?.routerHub },
  { key: 'feeSink', extract: (deployment) => deployment.feeSink },
  { key: 'wrappedToken', extract: (deployment) => deployment.wrappedToken },
  { key: 'feeVault', extract: (deployment) => deployment.feeVault },
  { key: 'feeRebalancer', extract: (deployment) => deployment.feeRebalancer },
  { key: 'verifyingPaymaster', extract: (deployment) => deployment.paymaster || deployment.contracts?.VerifyingPaymaster || deployment.contracts?.paymaster },
  { key: 'zeroTollDelegate', extract: (deployment) => deployment.contracts?.ZeroTollDelegate?.address },
  { key: 'uniswapV2', adapter: true, extract: (deployment) => deployment.uniswapV2Adapter },
  { key: 'uniswapV3', adapter: true, extract: (deployment) => deployment.uniswapV3Adapter },
  { key: 'quickswapV2', adapter: true, extract: (deployment) => deployment.quickswapAdapter },
  { key: 'mockDex', adapter: true, extract: (deployment) => deployment.mockDEXAdapter },
  { key: 'mockBridge', adapter: true, extract: (deployment) => deployment.mockBridgeAdapter },
];

console.log('🔍 Scanning deployment artifacts for shared-config updates...\n');

if (!fs.existsSync(deploymentsDir)) {
  console.error(`❌ Deployments directory not found: ${deploymentsDir}`);
  process.exit(1);
}

const latestValues = {};
const deploymentFiles = fs.readdirSync(deploymentsDir).filter((file) => file.endsWith('.json'));

for (const fileName of deploymentFiles) {
  const fullPath = path.join(deploymentsDir, fileName);
  const deployment = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const networkKey = normalizeNetworkName(deployment.network);

  if (!networkKey) {
    continue;
  }

  const score = getDeploymentTimestamp(fileName, deployment);
  if (!latestValues[networkKey]) {
    latestValues[networkKey] = {};
  }

  for (const field of fieldExtractors) {
    const value = field.extract(deployment);
    if (!value) continue;

    const current = latestValues[networkKey][field.key];
    if (!current || score >= current.score) {
      latestValues[networkKey][field.key] = {
        score,
        value,
        source: fileName,
        adapter: Boolean(field.adapter),
      };
    }
  }
}

if (Object.keys(latestValues).length === 0) {
  console.error('❌ No supported deployment values found.');
  process.exit(1);
}

const sharedConfig = loadSharedConfig();

for (const [networkKey, fields] of Object.entries(latestValues)) {
  const chain = sharedConfig.chains[networkKey];
  if (!chain) continue;

  console.log(`📝 ${networkKey}`);
  for (const [fieldKey, entry] of Object.entries(fields)) {
    if (entry.adapter) {
      const adapters = ensureNestedObject(chain.contracts, 'adapters');
      adapters[fieldKey] = entry.value;
      console.log(`   adapters.${fieldKey} = ${entry.value}  (${entry.source})`);
    } else {
      chain.contracts[fieldKey] = entry.value;
      console.log(`   ${fieldKey} = ${entry.value}  (${entry.source})`);
    }
  }
  console.log('');
}

saveSharedConfig(sharedConfig);

console.log('♻️  Regenerating derived config artifacts...\n');
syncSharedConfig();

console.log('\n✅ Shared source config updated successfully.');
console.log('   Source: packages/shared-config/src/source-of-truth.json');
console.log('   Derived files regenerated for frontend and backend.\n');
