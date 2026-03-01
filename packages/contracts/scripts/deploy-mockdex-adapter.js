const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying MockDEXAdapter to Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Mock price oracle (for demo, can be zero address or simple oracle)
  // For real deployment, use Pyth or Chainlink oracle
  const MOCK_ORACLE = "0x0000000000000000000000000000000000000001"; // Placeholder

  // Deploy MockDEXAdapter
  console.log("\n📦 Deploying MockDEXAdapter...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const mockAdapter = await MockDEXAdapter.deploy(MOCK_ORACLE);
  await mockAdapter.waitForDeployment();
  
  const mockAdapterAddress = await mockAdapter.getAddress();
  console.log("✅ MockDEXAdapter deployed to:", mockAdapterAddress);

  // Add supported tokens (USDC, WETH, LINK on Sepolia)
  console.log("\n🔧 Configuring supported tokens...");
  
  const tokens = {
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    LINK: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    PYUSD: "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9"
  };

  for (const [symbol, address] of Object.entries(tokens)) {
    console.log(`  Adding ${symbol} (${address})...`);
    const tx = await mockAdapter.addSupportedToken(address);
    await tx.wait();
    console.log(`  ✅ ${symbol} added`);
  }

  // Now whitelist adapter in RouterHub
  console.log("\n🔐 Whitelisting adapter in RouterHub...");
  
  const ROUTER_HUB_ADDRESS = "0x19091A6c655704c8fb55023635eE3298DcDf66FF";
  
  // RouterHub ABI for whitelistAdapter function
  const routerHubAbi = [
    "function whitelistAdapter(address adapter, bool status) external",
    "function isWhitelistedAdapter(address adapter) external view returns (bool)"
  ];
  
  const routerHub = await hre.ethers.getContractAt(routerHubAbi, ROUTER_HUB_ADDRESS);
  
  console.log("  Whitelisting MockDEXAdapter in RouterHub...");
  const whitelistTx = await routerHub.whitelistAdapter(mockAdapterAddress, true);
  await whitelistTx.wait();
  console.log("  ✅ Adapter whitelisted!");

  // Verify whitelisting
  const isWhitelisted = await routerHub.isWhitelistedAdapter(mockAdapterAddress);
  console.log("  Verification:", isWhitelisted ? "✅ WHITELISTED" : "❌ NOT WHITELISTED");

  // Save deployment info
  const deployment = {
    network: "sepolia",
    chainId: 11155111,
    timestamp: new Date().toISOString(),
    mockDexAdapter: mockAdapterAddress,
    routerHub: ROUTER_HUB_ADDRESS,
    supportedTokens: tokens,
    whitelisted: isWhitelisted
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `sepolia-mockdex-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Summary:");
  console.log("  MockDEXAdapter:", mockAdapterAddress);
  console.log("  RouterHub:", ROUTER_HUB_ADDRESS);
  console.log("  Whitelisted:", isWhitelisted);
  console.log("  Deployment file:", filename);
  
  console.log("\n🔗 Verify on Etherscan:");
  console.log(`  https://sepolia.etherscan.io/address/${mockAdapterAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
