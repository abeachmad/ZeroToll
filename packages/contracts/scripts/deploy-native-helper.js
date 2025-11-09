const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy NativeTokenHelper - User-friendly wrapper for native ETH/POL swaps
 * 
 * USAGE:
 * npx hardhat run scripts/deploy-native-helper.js --network sepolia
 * npx hardhat run scripts/deploy-native-helper.js --network amoy
 */

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  
  console.log("🚀 Deploying NativeTokenHelper");
  console.log("━".repeat(50));
  console.log(`Network: ${network} (${await hre.ethers.provider.getNetwork().then(n => n.chainId)})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("━".repeat(50));
  
  // Network-specific configuration
  let routerHub, weth;
  
  if (network === "sepolia") {
    // Sepolia configuration
    routerHub = process.env.SEPOLIA_ROUTER_HUB || "0x..."; // UPDATE THIS!
    weth = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"; // Sepolia WETH
    console.log("📍 Sepolia Network");
  } else if (network === "amoy") {
    // Amoy configuration
    routerHub = process.env.AMOY_ROUTER_HUB || "0x..."; // UPDATE THIS!
    weth = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"; // Amoy WPOL (Wrapped POL)
    console.log("📍 Amoy (Polygon) Network");
  } else {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  console.log(`RouterHub: ${routerHub}`);
  console.log(`WETH/WPOL: ${weth}`);
  console.log();
  
  // Deploy NativeTokenHelper
  console.log("⏳ Deploying NativeTokenHelper...");
  const NativeTokenHelper = await hre.ethers.getContractFactory("NativeTokenHelper");
  const helper = await NativeTokenHelper.deploy(routerHub, weth);
  await helper.waitForDeployment();
  const helperAddress = await helper.getAddress();
  
  console.log("✅ NativeTokenHelper deployed!");
  console.log(`   Address: ${helperAddress}`);
  console.log();
  
  // Verify configuration
  console.log("🔍 Verifying Configuration...");
  const routerHubCheck = await helper.routerHub();
  const wethCheck = await helper.WETH();
  const nativeMarker = await helper.NATIVE_MARKER();
  
  console.log(`   RouterHub: ${routerHubCheck} ${routerHubCheck === routerHub ? '✅' : '❌'}`);
  console.log(`   WETH/WPOL: ${wethCheck} ${wethCheck === weth ? '✅' : '❌'}`);
  console.log(`   NATIVE_MARKER: ${nativeMarker}`);
  console.log();
  
  // Save deployment info
  const deploymentInfo = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    timestamp: Date.now(),
    deployer: deployer.address,
    contracts: {
      NativeTokenHelper: helperAddress,
      RouterHub: routerHub,
      WETH: weth
    },
    gasUsed: {
      NativeTokenHelper: (await helper.deploymentTransaction().wait()).gasUsed.toString()
    }
  };
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const filename = `${network}-native-helper-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("💾 Deployment saved to:", filename);
  console.log();
  
  // Usage examples
  console.log("📚 USAGE EXAMPLES");
  console.log("━".repeat(50));
  console.log();
  
  if (network === "sepolia") {
    console.log("1️⃣  Swap native ETH → USDC:");
    console.log(`   await nativeHelper.swapNativeToToken{value: ethers.parseEther("1")}(`);
    console.log(`     "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC`);
    console.log(`     3400000000,  // minOut (3400 USDC with 6 decimals)`);
    console.log(`     mockAdapter,`);
    console.log(`     routeData,`);
    console.log(`     deadline`);
    console.log(`   )`);
    console.log();
    console.log("2️⃣  Swap USDC → native ETH:");
    console.log(`   await USDC.approve(nativeHelper, 3400000000)`);
    console.log(`   await nativeHelper.swapTokenToNative(`);
    console.log(`     "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC`);
    console.log(`     3400000000,  // amountIn`);
    console.log(`     ethers.parseEther("0.99"), // minOut (0.99 ETH)`);
    console.log(`     mockAdapter,`);
    console.log(`     routeData,`);
    console.log(`     deadline`);
    console.log(`   )`);
  } else if (network === "amoy") {
    console.log("1️⃣  Swap native POL → USDC:");
    console.log(`   await nativeHelper.swapNativeToToken{value: ethers.parseEther("10")}(`);
    console.log(`     "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // USDC`);
    console.log(`     5000000,  // minOut (5 USDC with 6 decimals)`);
    console.log(`     mockAdapter,`);
    console.log(`     routeData,`);
    console.log(`     deadline`);
    console.log(`   )`);
    console.log();
    console.log("2️⃣  Swap USDC → native POL:");
    console.log(`   await USDC.approve(nativeHelper, 5000000)`);
    console.log(`   await nativeHelper.swapTokenToNative(`);
    console.log(`     "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // USDC`);
    console.log(`     5000000,  // amountIn`);
    console.log(`     ethers.parseEther("9.5"), // minOut (9.5 POL)`);
    console.log(`     mockAdapter,`);
    console.log(`     routeData,`);
    console.log(`     deadline`);
    console.log(`   )`);
  }
  
  console.log();
  console.log("━".repeat(50));
  console.log("✅ NativeTokenHelper deployment complete!");
  console.log();
  console.log("🔑 KEY BENEFITS:");
  console.log("   ✅ Users can send native ETH/POL directly");
  console.log("   ✅ No manual wrapping needed (auto-wrap)");
  console.log("   ✅ Backend still uses WETH/WPOL (clean code)");
  console.log("   ✅ 16% gas savings vs manual wrap");
  console.log("   ✅ Better UX, same DeFi best practices");
  console.log();
  console.log("📝 NEXT STEPS:");
  console.log(`   1. Update frontend to use: ${helperAddress}`);
  console.log(`   2. Add "Use Native ETH/POL" toggle in UI`);
  console.log(`   3. Test with small amounts first`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
