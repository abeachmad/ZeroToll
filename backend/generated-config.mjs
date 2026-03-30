import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { polygonAmoy, sepolia } from 'viem/chains';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generatedChainConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'chain_config.json'), 'utf8')
);
const generatedTokenAddresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'token_addresses.json'), 'utf8')
);
const generatedPythFeedIds = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pyth_feed_ids.json'), 'utf8')
);

const CHAIN_METADATA = {
  80002: {
    chain: polygonAmoy,
    rpcEnvVars: ['RPC_AMOY', 'AMOY_RPC_URL'],
    pimlicoNetwork: 'polygon-amoy',
    rpcFallbacks: [
      'https://polygon-amoy.drpc.org',
      'https://rpc.ankr.com/polygon_amoy',
    ],
  },
  11155111: {
    chain: sepolia,
    rpcEnvVars: ['RPC_SEPOLIA', 'SEPOLIA_RPC_URL'],
    pimlicoNetwork: 'sepolia',
    rpcFallbacks: [
      'https://sepolia.drpc.org',
      'https://rpc.sepolia.org',
      'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
      'https://rpc.ankr.com/eth_sepolia',
    ],
  },
};

function pickFirstEnv(keys = []) {
  for (const key of keys) {
    if (process.env[key]) {
      return process.env[key];
    }
  }
  return null;
}

function uniqueTruthy(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePythSymbol(symbol) {
  const normalized = String(symbol || '').replace(/^z/i, '').toUpperCase();
  return normalized === 'MATIC' ? 'POL' : normalized;
}

export function getConfiguredChain(chainId, { pimlicoApiKey } = {}) {
  const chainKey = String(chainId);
  const generated = generatedChainConfig[chainKey];
  const metadata = CHAIN_METADATA[Number(chainId)];

  if (!generated || !metadata) {
    return null;
  }

  const rpc = pickFirstEnv(metadata.rpcEnvVars) || generated.rpc || null;
  const pimlicoNetwork = generated.pimlicoNetwork || metadata.pimlicoNetwork || null;

  return {
    chainId: Number(chainId),
    chain: metadata.chain,
    name: generated.name,
    network: generated.network,
    rpc,
    rpcCandidates: uniqueTruthy([rpc, ...metadata.rpcFallbacks]),
    explorerTx: generated.explorerTx || null,
    delegate: generated.delegate || null,
    router: generated.router || null,
    routerHub: generated.routerHub || null,
    treasury: generated.treasury || null,
    paymaster: generated.paymaster || null,
    nativeSymbol: generated.nativeSymbol || metadata.chain.nativeCurrency?.symbol,
    pimlicoNetwork,
    pimlicoRpc: pimlicoApiKey && pimlicoNetwork
      ? `https://api.pimlico.io/v2/${pimlicoNetwork}/rpc?apikey=${pimlicoApiKey}`
      : null,
  };
}

export function getConfiguredChains({ pimlicoApiKey } = {}) {
  return Object.fromEntries(
    Object.keys(CHAIN_METADATA)
      .map((chainId) => {
        const chain = getConfiguredChain(Number(chainId), { pimlicoApiKey });
        return chain ? [Number(chainId), chain] : null;
      })
      .filter(Boolean)
  );
}

export function getTokenMetadata(chainId, tokenReference) {
  const chainConfig = generatedTokenAddresses[String(chainId)];
  if (!chainConfig || !tokenReference) {
    return null;
  }

  if (String(tokenReference).startsWith('0x')) {
    return chainConfig.metadataByAddress?.[String(tokenReference).toLowerCase()] || null;
  }

  return chainConfig.metadataBySymbol?.[String(tokenReference).toUpperCase()] || null;
}

export function getTokenSymbol(chainId, tokenReference) {
  return getTokenMetadata(chainId, tokenReference)?.symbol || null;
}

export function getTokenDecimals(chainId, tokenReference) {
  return getTokenMetadata(chainId, tokenReference)?.decimals ?? 18;
}

export function getPythPriceId(symbol) {
  return generatedPythFeedIds[normalizePythSymbol(symbol)] || null;
}
