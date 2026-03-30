const COFHE_SUPPORTED_CHAIN_IDS = [11155111];

const CLIENT_CACHE = new Map();
let sdkPromise;

const bigintToBytes32Hex = (value) => `0x${BigInt(value).toString(16).padStart(64, '0')}`;

const serializeEncryptedInput = (input) => ({
  ctHash: input.ctHash.toString(),
  ctHashHex: bigintToBytes32Hex(input.ctHash),
  securityZone: input.securityZone,
  utype: input.utype,
  signature: input.signature,
});

const loadCofheSdk = async () => {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import('@cofhe/sdk/web'),
      import('@cofhe/sdk'),
      import('@cofhe/sdk/chains'),
    ]).then(([webSdk, coreSdk, chainSdk]) => ({
      webSdk,
      coreSdk,
      chainSdk,
    }));
  }

  return sdkPromise;
};

const getSupportedChain = async (chainId) => {
  if (!COFHE_SUPPORTED_CHAIN_IDS.includes(chainId)) {
    throw new Error(
      'Real CoFHE encryption is currently enabled for Sepolia only in ZeroToll.'
    );
  }

  const { chainSdk } = await loadCofheSdk();
  return chainSdk.chains.sepolia;
};

const getOrCreateClient = async (chainId) => {
  const supportedChain = await getSupportedChain(chainId);

  if (!CLIENT_CACHE.has(chainId)) {
    const { webSdk } = await loadCofheSdk();
    const config = webSdk.createCofheConfig({
      supportedChains: [supportedChain],
      useWorkers: false,
    });
    CLIENT_CACHE.set(chainId, webSdk.createCofheClient(config));
  }

  return CLIENT_CACHE.get(chainId);
};

export const getCofheSupportedChainIds = () => [...COFHE_SUPPORTED_CHAIN_IDS];

export const isCofheSupportedChain = (chainId) =>
  COFHE_SUPPORTED_CHAIN_IDS.includes(chainId);

export async function encryptUint128WithCofhe({
  chainId,
  account,
  publicClient,
  walletClient,
  value,
}) {
  if (!publicClient || !walletClient) {
    throw new Error('Wallet connection is missing a public client or wallet client.');
  }

  if (!account) {
    throw new Error('Missing wallet account for CoFHE encryption.');
  }

  const { coreSdk } = await loadCofheSdk();
  const client = await getOrCreateClient(chainId);
  await client.connect(publicClient, walletClient);

  const [encrypted] = await client
    .encryptInputs([coreSdk.Encryptable.uint128(BigInt(value))])
    .setChainId(chainId)
    .setAccount(account)
    .setUseWorker(false)
    .execute();

  return {
    mode: 'cofhe_sdk_web_encrypt',
    commitment: bigintToBytes32Hex(encrypted.ctHash),
    input: serializeEncryptedInput(encrypted),
  };
}
