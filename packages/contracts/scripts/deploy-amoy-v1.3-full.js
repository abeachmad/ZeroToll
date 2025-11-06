/**
 * Deploy RouterHub v1.3 + MockDEXAdapter to Polygon Amoy Testnet
 * With intent.user fix and proper token configuration
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying to Polygon Amoy Testnet...");
  console.log("Network:", hre.network.name);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "POL");

  // Amoy token addresses (from official Polygon token list)
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"; // Wrapped POL
  const USDC = "0x150ae9614a43361775d9d3a006f75ccc558b598f"; // USDC on Amoy
  const USDT = "0xb02af5db30228b30552a9c59d764524ac9d24522"; // USDT on Amoy
  const LINK = "0x066f1d09e781c82dbb4e976fc4b47ed3813d31e6"; // LINK on Amoy

  console.log("\n📋 Token Configuration:");
  console.log("  WPOL:", WPOL);
  console.log("  USDC:", USDC);
  console.log("  USDT:", USDT);
  console.log("  LINK:", LINK);

  // 1. Deploy RouterHub v1.3
  console.log("\n🔨 Deploying RouterHub v1.3...");
  const RouterHub = await hre.ethers.getContractFactory("RouterHub");
  const routerHub = await RouterHub.deploy();
  await routerHub.waitForDeployment();
  const routerHubAddress = await routerHub.getAddress();
  console.log("✅ RouterHub v1.3 deployed to:", routerHubAddress);

  // 2. Set native wrapper
  console.log("\n⚙️  Setting WPOL as native wrapper...");
  const tx1 = await routerHub.setNativeWrapped(WPOL);
  await tx1.wait();
  console.log("✅ WPOL configured");

  // 3. Deploy MockDEXAdapter
  console.log("\n🔨 Deploying MockDEXAdapter v7...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const adapter = await MockDEXAdapter.deploy();
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ MockDEXAdapter deployed to:", adapterAddress);

  // 4. Configure adapter with token pairs
  console.log("\n⚙️  Configuring adapter token pairs...");
  
  // USDC/WPOL pair (most common on Polygon)
  const tx2 = await adapter.addMockPrice(USDC, WPOL, 6, 18, hre.ethers.parseUnits("2000", 18)); // 1 POL = ~$0.50
  await tx2.wait();
  console.log("✅ Added USDC/WPOL pair");

  // USDC/USDT pair (stablecoin)
  const tx3 = await adapter.addMockPrice(USDC, USDT, 6, 6, hre.ethers.parseUnits("1", 6)); // 1:1
  await tx3.wait();
  console.log("✅ Added USDC/USDT pair");

  // USDC/LINK pair
  const tx4 = await adapter.addMockPrice(USDC, LINK, 6, 18, hre.ethers.parseUnits("0.1", 18)); // 1 LINK = ~$10
  await tx4.wait();
  console.log("✅ Added USDC/LINK pair");

  // 5. Whitelist adapter in RouterHub
  console.log("\n⚙️  Whitelisting adapter...");
  const tx5 = await routerHub.whitelistAdapter(adapterAddress, true);
  await tx5.wait();
  console.log("✅ Adapter whitelisted");

  // 6. Fund adapter with output tokens
  console.log("\n💰 Funding adapter with WPOL for swaps...");
  // Try to get WPOL from faucet or wrap POL
  const WPOL_Contract = await hre.ethers.getContractAt(
    ["function deposit() payable", "function balanceOf(address) view returns (uint256)"],
    WPOL
  );
  
  try {
    const depositTx = await WPOL_Contract.deposit({ value: hre.ethers.parseEther("1") });
    await depositTx.wait();
    console.log("✅ Wrapped 1 POL to WPOL");
    
    // Transfer to adapter
    const transferTx = await WPOL_Contract.transfer(adapterAddress, hre.ethers.parseEther("1"));
    await transferTx.wait();
    console.log("✅ Transferred 1 WPOL to adapter");
  } catch (error) {
    console.log("⚠️  Could not fund adapter with WPOL:", error.message);
    console.log("   Please manually send WPOL to adapter:", adapterAddress);
  }

  // 7. Save deployment info
  const deploymentInfo = {
    network: "amoy",
    chainId: 80002,
    routerHub: routerHubAddress,
    mockDEXAdapter: adapterAddress,
    tokens: {
      WPOL,
      USDC,
      USDT,
      LINK
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    version: "v1.3"
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `amoy-v1.3-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", filename);

  // 8. Print summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("  RouterHub v1.3:", routerHubAddress);
  console.log("  MockDEXAdapter:", adapterAddress);
  console.log("\n🔗 Verify on PolygonScan:");
  console.log(`  https://amoy.polygonscan.com/address/${routerHubAddress}`);
  console.log(`  https://amoy.polygonscan.com/address/${adapterAddress}`);
  console.log("\n⚙️  Next Steps:");
  console.log("  1. Update backend/.env with new addresses");
  console.log("  2. Get USDC from faucet: https://faucet.polygon.technology/");
  console.log("  3. Approve RouterHub to spend USDC");
  console.log("  4. Test swap: USDC → WPOL");
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
