/**
 * Deploy ZeroToll Tokens (zUSDC, zETH, zPOL, zLINK) and ZeroTollAdapter
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-ztokens.js --network sepolia
 *   npx hardhat run scripts/deploy-ztokens.js --network amoy
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Pyth contract addresses
const PYTH_ADDRESSES = {
  sepolia: "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21",
  amoy: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C"
};

// Pyth Price Feed IDs (same across all networks)
const PYTH_PRICE_IDS = {
  ETH_USD: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  USDC_USD: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  MATIC_USD: "0x5de33440f6c8ee7a2c3c3e5e8b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e", // POL/MATIC
  LINK_USD: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221"
};

// Token configurations
const ZTOKENS = [
  {
    name: "ZeroToll USDC",
    symbol: "zUSDC",
    decimals: 6,
    priceId: PYTH_PRICE_IDS.USDC_USD
  },
  {
    name: "ZeroToll ETH",
    symbol: "zETH",
    decimals: 18,
    priceId: PYTH_PRICE_IDS.ETH_USD
  },
  {
    name: "ZeroToll POL",
    symbol: "zPOL",
    decimals: 18,
    priceId: PYTH_PRICE_IDS.MATIC_USD
  },
  {
    name: "ZeroToll LINK",
    symbol: "zLINK",
    decimals: 18,
    priceId: PYTH_PRICE_IDS.LINK_USD
  }
];

async function main() {
  const network = hre.network.name;
  console.log(`\n🚀 Deploying ZeroToll Tokens to ${network}...\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  const pythAddress = PYTH_ADDRESSES[network];
  if (!pythAddress) {
    throw new Error(`No Pyth address configured for network: ${network}`);
  }
  console.log(`Pyth Oracle: ${pythAddress}\n`);

  // Deploy results
  const deployment = {
    network,
    timestamp: Date.now(),
    deployer: deployer.address,
    pyth: pythAddress,
    tokens: {},
    adapter: null
  };

  // Deploy ZeroTollToken contracts
  console.log("📦 Deploying zTokens...\n");
  
  const ZeroTollToken = await hre.ethers.getContractFactory("ZeroTollToken");
  
  for (const token of ZTOKENS) {
    console.log(`Deploying ${token.symbol}...`);
    
    const contract = await ZeroTollToken.deploy(
      token.name,
      token.symbol,
      token.decimals,
      token.priceId
    );
    await contract.waitForDeployment();
    
    const address = await contract.getAddress();
    console.log(`  ✅ ${token.symbol}: ${address}`);
    
    deployment.tokens[token.symbol] = {
      address,
      name: token.name,
      decimals: token.decimals,
      priceId: token.priceId
    };
  }

  // Deploy ZeroTollAdapter
  console.log("\n📦 Deploying ZeroTollAdapter...");
  
  const ZeroTollAdapter = await hre.ethers.getContractFactory("ZeroTollAdapter");
  const adapter = await ZeroTollAdapter.deploy(pythAddress);
  await adapter.waitForDeployment();
  
  const adapterAddress = await adapter.getAddress();
  console.log(`  ✅ ZeroTollAdapter: ${adapterAddress}`);
  deployment.adapter = adapterAddress;

  // Configure adapter with zTokens
  console.log("\n⚙️ Configuring ZeroTollAdapter with zTokens...");
  
  for (const [symbol, tokenData] of Object.entries(deployment.tokens)) {
    console.log(`  Configuring ${symbol}...`);
    const tx = await adapter.configureToken(tokenData.address, tokenData.priceId);
    await tx.wait();
    console.log(`    ✅ ${symbol} configured`);
  }

  // Mint initial liquidity to adapter
  console.log("\n💰 Minting initial liquidity to adapter...");
  
  for (const [symbol, tokenData] of Object.entries(deployment.tokens)) {
    const token = await hre.ethers.getContractAt("ZeroTollToken", tokenData.address);
    
    // Mint 100,000 tokens for liquidity
    const amount = hre.ethers.parseUnits("100000", tokenData.decimals);
    
    // Mint to deployer first
    let tx = await token.mint(deployer.address, amount);
    await tx.wait();
    
    // Approve adapter
    tx = await token.approve(adapterAddress, amount);
    await tx.wait();
    
    // Add liquidity to adapter
    tx = await adapter.addLiquidity(tokenData.address, amount);
    await tx.wait();
    
    console.log(`  ✅ ${symbol}: 100,000 tokens added as liquidity`);
  }

  // Save deployment
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `ztokens-${network}-${Date.now()}.json`
  );
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log(`\n📄 Deployment saved to: ${deploymentPath}`);

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Network: ${network}`);
  console.log(`Pyth Oracle: ${pythAddress}`);
  console.log(`ZeroTollAdapter: ${adapterAddress}`);
  console.log("\nzTokens:");
  for (const [symbol, data] of Object.entries(deployment.tokens)) {
    console.log(`  ${symbol}: ${data.address}`);
  }
  console.log("=".repeat(60));

  // Verify contracts (optional)
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\n🔍 To verify contracts, run:");
    console.log(`npx hardhat verify --network ${network} ${adapterAddress} "${pythAddress}"`);
    for (const [symbol, data] of Object.entries(deployment.tokens)) {
      console.log(`npx hardhat verify --network ${network} ${data.address} "${data.name}" "${symbol}" ${data.decimals} "${data.priceId}"`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
