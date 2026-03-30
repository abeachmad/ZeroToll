import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const sourcePath = path.join(__dirname, '../src/source-of-truth.json');
const nativeSentinel = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const isConfiguredAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(value || '');

const writeJson = (relativePath, data) => {
  const outputPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${relativePath}`);
};

const frontendContracts = { permit2: source.permit2 };

for (const [chainKey, chain] of Object.entries(source.chains)) {
  frontendContracts[chainKey] = {
    chainId: chain.chainId,
    ...chain.contracts,
  };
}

const frontendPythFeeds = source.pythFeeds;
const backendPythFeedIds = Object.fromEntries(
  Object.entries(source.pythFeeds).map(([symbol, feed]) => [symbol, feed.priceId])
);

const backendTokenAddresses = {};
const backendChainConfig = {};

for (const [chainKey, chain] of Object.entries(source.chains)) {
  const visibleTokens = chain.tokens
    .filter((token) => token.frontend !== false)
    .map((token) => {
      const entry = {
        symbol: token.symbol,
        name: token.name,
        logo: token.logo,
        address: token.isNative ? 'NATIVE' : token.address,
        decimals: token.decimals,
        isNative: token.isNative,
        feeModes: token.feeModes,
      };

      if (token.wrappedAddress) {
        entry.wrappedAddress = token.wrappedAddress;
      }

      if (token.isGasless) {
        entry.isGasless = true;
      }

      if (token.permitType) {
        entry.permitType = token.permitType;
      }

      if (token.pythPriceSymbol && source.pythFeeds[token.pythPriceSymbol]) {
        entry.pythPriceId = source.pythFeeds[token.pythPriceSymbol].priceId;
      }

      return entry;
    });

  const tokenList = {
    chainId: chain.chainId,
    network: chain.tokenlistNetwork,
    tokens: visibleTokens,
  };

  if (isConfiguredAddress(chain.contracts.adapters?.zeroToll)) {
    tokenList.zeroTollAdapter = chain.contracts.adapters.zeroToll;
  }

  writeJson(
    path.join('frontend/src/config/tokenlists', chain.tokenlistFile),
    tokenList
  );

  const backendTokens = {};
  const backendTokenMetadataByAddress = {};
  const backendTokenMetadataBySymbol = {};
  for (const token of chain.tokens) {
    const tokenAddress = token.isNative ? nativeSentinel : token.address;
    const backendSymbols = [token.symbol.toUpperCase(), ...(token.backendAliases || [])];
    const metadata = {
      symbol: token.symbol,
      decimals: token.decimals,
      isNative: token.isNative,
      pythPriceSymbol: token.pythPriceSymbol || null,
    };

    backendTokenMetadataByAddress[tokenAddress.toLowerCase()] = metadata;

    for (const symbol of backendSymbols) {
      backendTokens[symbol] = tokenAddress;
      backendTokenMetadataBySymbol[symbol.toUpperCase()] = metadata;
    }
  }

  backendTokenAddresses[chain.chainId] = {
    name: chain.backendName,
    tokens: backendTokens,
    metadataByAddress: backendTokenMetadataByAddress,
    metadataBySymbol: backendTokenMetadataBySymbol,
  };

  const router = isConfiguredAddress(chain.contracts.zeroTollRouterV3)
    ? chain.contracts.zeroTollRouterV3
    : null;
  const routerHub = isConfiguredAddress(chain.contracts.routerHub)
    ? chain.contracts.routerHub
    : null;
  const delegate = isConfiguredAddress(chain.contracts.zeroTollDelegate)
    ? chain.contracts.zeroTollDelegate
    : null;
  const treasury = isConfiguredAddress(chain.contracts.treasury)
    ? chain.contracts.treasury
    : null;
  const paymaster = isConfiguredAddress(chain.contracts.verifyingPaymaster)
    ? chain.contracts.verifyingPaymaster
    : null;
  const feeSink = isConfiguredAddress(chain.contracts.feeSink)
    ? chain.contracts.feeSink
    : null;
  const confidentialIntentEscrow = isConfiguredAddress(chain.contracts.confidentialIntentEscrow)
    ? chain.contracts.confidentialIntentEscrow
    : null;
  const wrappedToken = isConfiguredAddress(chain.contracts.wrappedToken)
    ? chain.contracts.wrappedToken
    : null;
  const smartDexAdapter = isConfiguredAddress(chain.contracts.smartDexAdapter)
    ? chain.contracts.smartDexAdapter
    : null;
  const adapters = Object.fromEntries(
    Object.entries(chain.contracts.adapters || {}).map(([adapterKey, address]) => [
      adapterKey,
      isConfiguredAddress(address) ? address : null,
    ])
  );

  backendChainConfig[chain.chainId] = {
    chainId: chain.chainId,
    key: chainKey,
    name: chain.name,
    network: chain.network,
    router,
    routerHub,
    delegate,
    treasury,
    paymaster,
    feeSink,
    wrappedToken,
    smartDexAdapter,
    confidentialIntentEscrow,
    adapters,
    permit2: source.permit2,
    rpc: chain.rpcUrl,
    explorerTx: chain.explorerBaseUrl ? `${chain.explorerBaseUrl}/tx/` : null,
    nativeSymbol: chain.nativeSymbol,
    pimlicoNetwork: chain.pimlicoNetwork,
    features: {
      gasless: Boolean(router),
      eip7702: Boolean(delegate),
      confidentialIntent: Boolean(confidentialIntentEscrow),
      permit2: true,
    },
  };
}

writeJson('frontend/src/config/contracts.json', frontendContracts);
writeJson('frontend/src/config/pyth.feeds.json', frontendPythFeeds);
writeJson('backend/token_addresses.json', backendTokenAddresses);
writeJson('backend/chain_config.json', backendChainConfig);
writeJson('backend/pyth_feed_ids.json', backendPythFeedIds);

console.log('shared config sync complete');
