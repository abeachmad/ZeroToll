/**
 * Deploy test tokens (USDC, USDT) on Amoy for testing
 */

const hre = require("hardhat");

async function main() {
  console.log("🪙 Deploying test tokens on Amoy...\n");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "POL\n");

  const TestToken = await hre.ethers.getContractFactory("TestToken");

  // Deploy USDC (6 decimals, 1M supply)
  console.log("🔨 Deploying Test USDC...");
  const usdc = await TestToken.deploy(
    "USD Coin (Test)",
    "USDC",
    6,
    hre.ethers.parseUnits("1000000", 6) // 1M USDC
  );
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ Test USDC deployed to:", usdcAddress);

  // Deploy USDT (6 decimals, 1M supply)
  console.log("\n🔨 Deploying Test USDT...");
  const usdt = await TestToken.deploy(
    "Tether USD (Test)",
    "USDT",
    6,
    hre.ethers.parseUnits("1000000", 6) // 1M USDT
  );
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("✅ Test USDT deployed to:", usdtAddress);

  // Get WPOL address
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

  console.log("\n" + "=".repeat(70));
  console.log("🎉 TEST TOKENS DEPLOYED!");
  console.log("=".repeat(70));
  console.log("\n📋 Token Addresses:");
  console.log("  USDC (Test):", usdcAddress);
  console.log("  USDT (Test):", usdtAddress);
  console.log("  WPOL (Native):", WPOL);
  console.log("\n🔗 PolygonScan:");
  console.log(`  USDC: https://amoy.polygonscan.com/address/${usdcAddress}`);
  console.log(`  USDT: https://amoy.polygonscan.com/address/${usdtAddress}`);
  console.log("\n💰 Deployer Balance:");
  console.log(`  USDC: 1,000,000`);
  console.log(`  USDT: 1,000,000`);
  console.log("\n⚙️  Next Steps:");
  console.log("  1. Update adapter to support these tokens");
  console.log("  2. Anyone can call faucet() to get 1000 tokens");
  console.log("  3. Test swaps: USDC → WPOL");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
