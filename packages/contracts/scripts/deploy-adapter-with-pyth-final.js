const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy MockDEXAdapter with MultiTokenPythOracle
 * CRITICAL FIX: Old adapters using TestnetPriceOracle (manual prices)
 *               New adapters use MultiTokenPythOracle (LIVE Pyth prices!)
 * 
 * USAGE:
 * npx hardhat run scripts/deploy-adapter-with-pyth-final.js --network sepolia
 * npx hardhat run scripts/deploy-adapter-with-pyth-final.js --network amoy
 */

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;
  
  console.log("🚀 Deploying MockDEXAdapter with MultiTokenPythOracle");
  console.log("━".repeat(60));
  console.log(`Network: ${network} (Chain ID: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))}`);
  console.log("━".repeat(60));
  console.log();
  
  // Network-specific configuration
  let oracleAddress, routerHub, tokens;
  
  if (network === "sepolia") {
    oracleAddress = process.env.SEPOLIA_PYTH_ORACLE || "0x1240c97bc33f7635b8e25C721fF6D05d2bfC44Db";
    routerHub = process.env.SEPOLIA_ROUTERHUB || "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
    tokens = {
      WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
      USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      LINK: "0x779877A7B0D9E8603169DdbD7836e478b4624789"
    };
    console.log("📍 Sepolia Testnet");
  } else if (network === "amoy") {
    oracleAddress = process.env.AMOY_PYTH_ORACLE || "0x14BfA9bdf75a2c8049C826B63EeEf6ED7F52E838";
    routerHub = process.env.AMOY_ROUTERHUB || "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
    tokens = {
      WPOL: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
      USDC: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
      LINK: "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904"
    };
    console.log("📍 Amoy (Polygon) Testnet");
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  console.log("Configuration:");
  console.log(`  MultiTokenPythOracle: ${oracleAddress}`);
  console.log(`  RouterHub: ${routerHub}`);
  console.log(`  Tokens:`, Object.keys(tokens).join(", "));
  console.log();
  
  // Deploy MockDEXAdapter
  console.log("⏳ Deploying MockDEXAdapter...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const adapter = await MockDEXAdapter.deploy(oracleAddress);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  
  console.log("✅ MockDEXAdapter deployed!");
  console.log(`   Address: ${adapterAddress}`);
  console.log();
  
  // Add supported tokens
  console.log("🔧 Configuring supported tokens...");
  for (const [symbol, address] of Object.entries(tokens)) {
    const tx = await adapter.addSupportedToken(address);
    await tx.wait();
    console.log(`  ✅ ${symbol}: ${address}`);
  }
  console.log();
  
  // Verify oracle connection
  console.log("🔍 Verifying oracle connection...");
  const oracleCheck = await adapter.priceOracle();
  console.log(`   Oracle: ${oracleCheck}`);
  
  if (oracleCheck.toLowerCase() === oracleAddress.toLowerCase()) {
    console.log("   ✅ Oracle configured correctly!");
  } else {
    console.log("   ❌ Oracle mismatch!");
    console.log(`   Expected: ${oracleAddress}`);
    console.log(`   Got: ${oracleCheck}`);
  }
  console.log();
  
  // Save deployment info
  const deploymentInfo = {
    network: network,
    chainId: chainId.toString(),
    timestamp: Date.now(),
    deployer: deployer.address,
    contracts: {
      adapter: adapterAddress,
      oracle: oracleAddress,
      routerHub: routerHub
    },
    tokens: tokens,
    gasUsed: {
      adapter: (await adapter.deploymentTransaction().wait()).gasUsed.toString()
    }
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `${network}-adapter-pyth-final-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("💾 Deployment saved:", filename);
  console.log();
  
  // Next steps
  console.log("📝 NEXT STEPS");
  console.log("━".repeat(60));
  console.log();
  console.log("1️⃣  Update backend/.env:");
  console.log(`   ${network.toUpperCase()}_MOCKDEX_ADAPTER=${adapterAddress}`);
  console.log();
  console.log("2️⃣  Whitelist adapter in RouterHub:");
  console.log(`   RouterHub.whitelistAdapter("${adapterAddress}", true)`);
  console.log();
  console.log("3️⃣  Fund adapter with tokens:");
  if (network === "sepolia") {
    console.log(`   - WETH: ~1 WETH`);
    console.log(`   - USDC: ~3400 USDC`);
  } else {
    console.log(`   - WPOL: ~10 WPOL`);
    console.log(`   - USDC: ~5 USDC`);
  }
  console.log();
  console.log("4️⃣  Test swap with LIVE Pyth prices:");
  console.log(`   Frontend → Swap → Verify price matches Pyth Network`);
  console.log();
  console.log("━".repeat(60));
  console.log("✅ Deployment complete!");
  console.log();
  console.log("🔑 KEY DIFFERENCE:");
  console.log("   OLD: TestnetPriceOracle (manual setPrice, can be stale)");
  console.log("   NEW: MultiTokenPythOracle (LIVE Pyth Network prices! ✨)");
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
