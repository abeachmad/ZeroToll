const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const sourceConfigPath = path.join(repoRoot, 'packages/shared-config/src/source-of-truth.json');
const generatorPath = path.join(repoRoot, 'packages/shared-config/scripts/generate.mjs');

const NETWORK_ALIASES = {
  sepolia: 'sepolia',
  ethereumsepolia: 'sepolia',
  amoy: 'amoy',
  polygonamoy: 'amoy',
  arbitrumsepolia: 'arbitrumSepolia',
  optimismsepolia: 'optimismSepolia',
};

function normalizeNetworkName(network) {
  if (!network) return null;
  const normalized = String(network).toLowerCase().replace(/[^a-z0-9]/g, '');
  return NETWORK_ALIASES[normalized] || null;
}

function loadSharedConfig() {
  return JSON.parse(fs.readFileSync(sourceConfigPath, 'utf8'));
}

function saveSharedConfig(config) {
  fs.writeFileSync(sourceConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

function syncSharedConfig() {
  execFileSync('node', [generatorPath], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function getChainConfig(config, network) {
  const key = normalizeNetworkName(network);
  if (!key || !config.chains[key]) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return {
    key,
    chain: config.chains[key],
  };
}

function ensureNestedObject(target, key) {
  if (!target[key] || typeof target[key] !== 'object') {
    target[key] = {};
  }
  return target[key];
}

function inferPythSymbol(symbol) {
  const normalized = String(symbol).replace(/^z/i, '').toUpperCase();
  return normalized === 'MATIC' ? 'POL' : normalized;
}

function inferTokenLogo(symbol) {
  const logos = {
    ZUSDC: '💵',
    ZETH: '💎',
    ZPOL: '🔷',
    ZLINK: '🔗',
  };
  return logos[String(symbol).toUpperCase()] || '⚡';
}

function upsertToken(chain, symbol, patch) {
  const symbolUpper = String(symbol).toUpperCase();
  let token = chain.tokens.find((entry) => entry.symbol.toUpperCase() === symbolUpper);

  if (!token) {
    token = {
      symbol,
      name: patch.name || symbol,
      logo: patch.logo || inferTokenLogo(symbol),
      address: patch.address,
      decimals: patch.decimals ?? 18,
      isNative: false,
      isGasless: true,
      permitType: 'ERC2612',
      pythPriceSymbol: inferPythSymbol(symbol),
      feeModes: ['INPUT', 'OUTPUT'],
    };
    chain.tokens.unshift(token);
  } else {
    Object.assign(token, patch);
  }

  return token;
}

function getDeploymentTimestamp(fileName, deployment) {
  const fileMatch = fileName.match(/-(\d+)\.json$/);
  if (fileMatch) {
    return Number(fileMatch[1]);
  }

  const candidateValues = [
    deployment.timestamp,
    deployment.deployedAt,
    deployment.time,
  ];

  for (const value of candidateValues) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const asNumber = Number(value);
      if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
      const parsed = Date.parse(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return 0;
}

module.exports = {
  repoRoot,
  sourceConfigPath,
  normalizeNetworkName,
  loadSharedConfig,
  saveSharedConfig,
  syncSharedConfig,
  getChainConfig,
  ensureNestedObject,
  inferPythSymbol,
  inferTokenLogo,
  upsertToken,
  getDeploymentTimestamp,
};
