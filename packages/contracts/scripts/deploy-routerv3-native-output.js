const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const SOURCE_OF_TRUTH_PATH = path.join(
  __dirname,
  "..",
  "..",
  "shared-config",
  "src",
  "source-of-truth.json"
);

const NETWORK_KEY_BY_NAME = {
  sepolia: "sepolia",
  amoy: "amoy",
  arbitrumSepolia: "arbitrumSepolia",
  optimismSepolia: "optimismSepolia",
};

function getConfiguredAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || "") ? value : null;
}

function loadChainConfig(networkName) {
  const networkKey = NETWORK_KEY_BY_NAME[networkName];
  if (!networkKey) {
    throw new Error(`Unsupported network "${networkName}"`);
  }

  const source = JSON.parse(fs.readFileSync(SOURCE_OF_TRUTH_PATH, "utf8"));
  const chainConfig = source.chains?.[networkKey];
  if (!chainConfig) {
    throw new Error(`No chain config found for "${networkKey}"`);
  }

  const contracts = chainConfig.contracts || {};
  const primaryAdapter =
    getConfiguredAddress(contracts.smartDexAdapter) ||
    getConfiguredAddress(contracts.adapters?.uniswapV3) ||
    getConfiguredAddress(contracts.adapters?.uniswapV2) ||
    getConfiguredAddress(contracts.adapters?.quickswapV2) ||
    getConfiguredAddress(contracts.adapters?.mockDex);
  const fallbackAdapter =
    getConfiguredAddress(contracts.adapters?.zeroToll) ||
    getConfiguredAddress(contracts.adapters?.mockDex) ||
    getConfiguredAddress(contracts.adapters?.uniswapV2) ||
    getConfiguredAddress(contracts.adapters?.uniswapV3);
  const legacyAdapter = getConfiguredAddress(contracts.adapters?.mockDex);

  return {
    networkKey,
    chainConfig,
    contracts,
    primaryAdapter,
    fallbackAdapter,
    legacyAdapter,
    wrappedToken: getConfiguredAddress(contracts.wrappedToken),
    treasury: getConfiguredAddress(contracts.treasury),
    feeRecipient: getConfiguredAddress(contracts.feeSink),
  };
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { chainId } = await hre.ethers.provider.getNetwork();
  const { networkKey, chainConfig, contracts, primaryAdapter, fallbackAdapter, legacyAdapter, wrappedToken, treasury, feeRecipient } =
    loadChainConfig(hre.network.name);

  if (!treasury) {
    throw new Error(`Treasury not configured for ${networkKey}`);
  }

  if (!wrappedToken) {
    throw new Error(`Wrapped native token not configured for ${networkKey}`);
  }

  console.log("=".repeat(72));
  console.log("DEPLOY NATIVE-AWARE ZeroTollRouterV3");
  console.log("=".repeat(72));
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", Number(chainId));
  console.log("Deployer:", deployer.address);
  console.log("Existing Treasury:", treasury);
  console.log("Wrapped Native:", wrappedToken);
  console.log("Primary Adapter:", primaryAdapter || "(none)");
  console.log("Fallback Adapter:", fallbackAdapter || "(none)");
  console.log("Legacy Adapter:", legacyAdapter || "(none)");
  console.log("");

  const RouterV3 = await hre.ethers.getContractFactory("ZeroTollRouterV3");
  const router = await RouterV3.deploy();
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("New RouterV3:", routerAddress);

  const treasuryContract = await hre.ethers.getContractAt("ZeroTollTreasury", treasury, deployer);

  console.log("\nConfiguring router...");
  await (await router.setTreasury(treasury)).wait();
  console.log("  ✓ Treasury set");

  await (await treasuryContract.setCollector(routerAddress, true)).wait();
  console.log("  ✓ Treasury authorized router as fee collector");

  await (await router.setGaslessFeeConfig(100, true)).wait();
  console.log("  ✓ Gasless fee cap set to 1%");

  await (await router.setWrappedNativeToken(wrappedToken)).wait();
  console.log("  ✓ Wrapped native token configured");

  if (primaryAdapter || fallbackAdapter) {
    await (await router.setAdapters(primaryAdapter || hre.ethers.ZeroAddress, fallbackAdapter || hre.ethers.ZeroAddress)).wait();
    console.log("  ✓ Primary/fallback adapters configured");
  }

  if (
    legacyAdapter &&
    legacyAdapter.toLowerCase() !== (primaryAdapter || "").toLowerCase() &&
    legacyAdapter.toLowerCase() !== (fallbackAdapter || "").toLowerCase()
  ) {
    await (await router.setDexAdapter(legacyAdapter)).wait();
    console.log("  ✓ Legacy adapter configured");
  }

  if (feeRecipient) {
    await (await router.setFeeConfig(50, feeRecipient)).wait();
    console.log("  ✓ Test-mode fee recipient configured");
  }

  await (await router.setTestMode(true)).wait();
  console.log("  ✓ Test mode enabled");

  const deployment = {
    network: hre.network.name,
    networkKey,
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    replacedRouterV3: contracts.zeroTollRouterV3 || null,
    zeroTollRouterV3: routerAddress,
    treasury,
    wrappedToken,
    primaryAdapter: primaryAdapter || null,
    fallbackAdapter: fallbackAdapter || null,
    legacyAdapter: legacyAdapter || null,
    feeRecipient: feeRecipient || null,
    confidentialIntentEscrow: contracts.confidentialIntentEscrow || null,
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const filename = path.join(
    deploymentsDir,
    `zerotoll-router-v3-native-${networkKey}-${Date.now()}.json`
  );
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));

  console.log("\nDeployment record:", filename);
  console.log("\nUpdate next:");
  console.log(`  packages/shared-config/src/source-of-truth.json -> chains.${networkKey}.contracts.zeroTollRouterV3`);
  console.log(`  packages/shared-config/src/source-of-truth.json -> chains.${networkKey}.contracts.zeroTollRouter`);
  console.log("\nSummary:");
  console.log(JSON.stringify(deployment, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
