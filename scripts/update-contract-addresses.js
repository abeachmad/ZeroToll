#!/usr/bin/env node

/**
 * Auto-update contract addresses after deployment
 * Reads from packages/contracts/deployments/*.json
 * Updates frontend/src/config/contracts.json
 */

const fs = require('fs');
const path = require('path');

// Paths
const deploymentsDir = path.join(__dirname, '../packages/contracts/deployments');
const frontendConfigPath = path.join(__dirname, '../frontend/src/config/contracts.json');

// Network name mapping
const networkMap = {
  'sepolia': 'sepolia',
  'amoy': 'amoy',
  'arbitrumSepolia': 'arbitrumSepolia',
  'optimismSepolia': 'optimismSepolia',
};

console.log('🔍 Searching for deployment artifacts...\n');

// Find all deployment files
let deployments = {};

if (fs.existsSync(deploymentsDir)) {
  const files = fs.readdirSync(deploymentsDir);
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(deploymentsDir, file);
      const deployment = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Extract network from filename (e.g., amoy-1762188044470.json)
      const network = file.split('-')[0];
      
      if (networkMap[network]) {
        console.log(`✓ Found deployment for ${network}`);
        deployments[networkMap[network]] = deployment;
      }
    }
  }
}

if (Object.keys(deployments).length === 0) {
  console.error('❌ No deployment files found!');
  console.log('\nPlease deploy contracts first:');
  console.log('  ./deploy-wave3.sh');
  process.exit(1);
}

console.log(`\n📝 Updating frontend config: ${frontendConfigPath}\n`);

// Load existing frontend config
let frontendConfig = {};
if (fs.existsSync(frontendConfigPath)) {
  frontendConfig = JSON.parse(fs.readFileSync(frontendConfigPath, 'utf8'));
} else {
  console.warn('⚠️  Frontend config not found, creating new one');
}

// Update addresses
for (const [network, deployment] of Object.entries(deployments)) {
  if (!frontendConfig[network]) {
    frontendConfig[network] = {};
  }
  
  const contracts = frontendConfig[network];
  
  // Core contracts
  if (deployment.routerHub) {
    contracts.routerHub = deployment.routerHub;
    console.log(`  ${network}.routerHub = ${deployment.routerHub}`);
  }
  
  if (deployment.feeSink) {
    contracts.feeSink = deployment.feeSink;
    console.log(`  ${network}.feeSink = ${deployment.feeSink}`);
  }
  
  if (deployment.paymaster) {
    contracts.paymaster = deployment.paymaster;
    console.log(`  ${network}.paymaster = ${deployment.paymaster}`);
  }
  
  // Wave-3 contracts
  if (deployment.feeVault) {
    contracts.feeVault = deployment.feeVault;
    console.log(`  ${network}.feeVault = ${deployment.feeVault}`);
  }
  
  if (deployment.feeRebalancer) {
    contracts.feeRebalancer = deployment.feeRebalancer;
    console.log(`  ${network}.feeRebalancer = ${deployment.feeRebalancer}`);
  }
  
  // Adapters
  if (!contracts.adapters) {
    contracts.adapters = {};
  }
  
  if (deployment.uniswapV2Adapter) {
    contracts.adapters.uniswapV2 = deployment.uniswapV2Adapter;
    console.log(`  ${network}.adapters.uniswapV2 = ${deployment.uniswapV2Adapter}`);
  }
  
  if (deployment.uniswapV3Adapter) {
    contracts.adapters.uniswapV3 = deployment.uniswapV3Adapter;
    console.log(`  ${network}.adapters.uniswapV3 = ${deployment.uniswapV3Adapter}`);
  }
  
  if (deployment.quickswapAdapter) {
    contracts.adapters.quickswap = deployment.quickswapAdapter;
    console.log(`  ${network}.adapters.quickswap = ${deployment.quickswapAdapter}`);
  }
  
  if (deployment.mockDEXAdapter) {
    contracts.adapters.mockDEX = deployment.mockDEXAdapter;
    console.log(`  ${network}.adapters.mockDEX = ${deployment.mockDEXAdapter}`);
  }
  
  if (deployment.mockBridgeAdapter) {
    contracts.adapters.mockBridge = deployment.mockBridgeAdapter;
    console.log(`  ${network}.adapters.mockBridge = ${deployment.mockBridgeAdapter}`);
  }
  
  console.log('');
}

// Write updated config
fs.writeFileSync(frontendConfigPath, JSON.stringify(frontendConfig, null, 2));

console.log('✅ Frontend config updated successfully!\n');

// Generate .env snippet for backend
console.log('📋 Copy these to your backend .env:\n');

for (const [network, deployment] of Object.entries(deployments)) {
  const prefix = network.toUpperCase().replace('SEPOLIA', 'SEPOLIA');
  
  if (deployment.routerHub) {
    console.log(`${prefix}_ROUTER_HUB=${deployment.routerHub}`);
  }
  if (deployment.feeSink) {
    console.log(`${prefix}_FEE_SINK=${deployment.feeSink}`);
  }
  if (deployment.paymaster) {
    console.log(`${prefix}_PAYMASTER=${deployment.paymaster}`);
  }
  if (deployment.feeVault) {
    console.log(`${prefix}_FEE_VAULT=${deployment.feeVault}`);
  }
  if (deployment.feeRebalancer) {
    console.log(`${prefix}_FEE_REBALANCER=${deployment.feeRebalancer}`);
  }
  
  console.log('');
}

console.log('✨ All done! Next steps:\n');
console.log('1. Update backend/.env with the addresses above');
console.log('2. Restart backend: cd backend && python server.py');
console.log('3. Start frontend: cd frontend && npm start');
console.log('4. Test E2E swaps and verify on block explorers\n');
