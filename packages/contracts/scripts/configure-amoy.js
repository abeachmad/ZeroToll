/**
 * Configure existing RouterHub v1.3 and deploy MockDEXAdapter on Amoy
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Configuring Polygon Amoy deployment...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "POL");

  // Existing RouterHub v1.3 (just deployed)
  const ROUTERHUB = "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b";
  
  // Amoy token addresses
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const USDC = "0x150ae9614a43361775d9d3a006f75ccc558b598f";
  const USDT = "0xb02af5db30228b30552a9c59d764524ac9d24522";
  const LINK = "0x066f1d09e781c82dbb4e976fc4b47ed3813d31e6";

  console.log("\n📋 Configuration:");
  console.log("  RouterHub:", ROUTERHUB);
  console.log("  WPOL:", WPOL);
  console.log("  USDC:", USDC);

  // 1. Get RouterHub contract
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTERHUB);

  // 2. Set native wrapper
  console.log("\n⚙️  Setting WPOL as native wrapper...");
  try {
    const tx1 = await routerHub.setNativeWrapped(WPOL);
    await tx1.wait();
    console.log("✅ WPOL configured");
  } catch (error) {
    console.log("⚠️  Could not set WPOL:", error.message);
  }

  // 3. Deploy MockDEXAdapter
  console.log("\n🔨 Deploying MockDEXAdapter v7...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const MOCK_ORACLE = "0x0000000000000000000000000000000000000001"; // Dummy oracle for mock prices
  const adapter = await MockDEXAdapter.deploy(MOCK_ORACLE);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ MockDEXAdapter deployed to:", adapterAddress);

  // 4. Add supported tokens
  console.log("\n⚙️  Adding supported tokens...");
  
  const tx2 = await adapter.addSupportedToken(USDC);
  await tx2.wait();
  console.log("✅ Added USDC");

  const tx3 = await adapter.addSupportedToken(WPOL);
  await tx3.wait();
  console.log("✅ Added WPOL");

  const tx4 = await adapter.addSupportedToken(USDT);
  await tx4.wait();
  console.log("✅ Added USDT");

  const tx5_tok = await adapter.addSupportedToken(LINK);
  await tx5_tok.wait();
  console.log("✅ Added LINK");
  console.log("   (Adapter will use default $1 price for all Amoy tokens)");

  // 5. Whitelist adapter in RouterHub
  console.log("\n⚙️  Whitelisting adapter...");
  const tx5 = await routerHub.whitelistAdapter(adapterAddress, true);
  await tx5.wait();
  console.log("✅ Adapter whitelisted");

  // 6. Fund adapter with WPOL
  console.log("\n💰 Funding adapter with WPOL...");
  const WPOL_Contract = await hre.ethers.getContractAt(
    ["function deposit() payable", "function transfer(address,uint256) returns(bool)", "function balanceOf(address) view returns (uint256)"],
    WPOL
  );
  
  try {
    // Wrap 10 POL to WPOL
    const depositTx = await WPOL_Contract.deposit({ value: hre.ethers.parseEther("10") });
    await depositTx.wait();
    console.log("✅ Wrapped 10 POL to WPOL");
    
    // Transfer to adapter
    const transferTx = await WPOL_Contract.transfer(adapterAddress, hre.ethers.parseEther("10"));
    await transferTx.wait();
    console.log("✅ Transferred 10 WPOL to adapter");
    
    const balance = await WPOL_Contract.balanceOf(adapterAddress);
    console.log("   Adapter WPOL balance:", hre.ethers.formatEther(balance), "WPOL");
  } catch (error) {
    console.log("⚠️  Could not fund adapter:", error.message);
  }

  // 7. Save deployment info
  const deploymentInfo = {
    network: "amoy",
    chainId: 80002,
    routerHub: ROUTERHUB,
    mockDEXAdapter: adapterAddress,
    tokens: { WPOL, USDC, USDT, LINK },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    version: "v1.3"
  };

  const filename = `amoy-v1.3-${Date.now()}.json`;
  const filepath = path.join(__dirname, "../deployments", filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Saved to:", filename);

  // 8. Print summary
  console.log("\n" + "=".repeat(70));
  console.log("🎉 AMOY DEPLOYMENT READY!");
  console.log("=".repeat(70));
  console.log("\n📋 Addresses:");
  console.log("  RouterHub v1.3:", ROUTERHUB);
  console.log("  MockDEXAdapter:", adapterAddress);
  console.log("\n🔗 PolygonScan:");
  console.log(`  RouterHub: https://amoy.polygonscan.com/address/${ROUTERHUB}`);
  console.log(`  Adapter:   https://amoy.polygonscan.com/address/${adapterAddress}`);
  console.log("\n⚙️  Update backend/.env:");
  console.log(`  AMOY_ROUTERHUB=${ROUTERHUB}`);
  console.log(`  AMOY_MOCKDEX_ADAPTER=${adapterAddress}`);
  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
