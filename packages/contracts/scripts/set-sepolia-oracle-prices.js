const hre = require("hardhat");

async function main() {
  console.log("⚙️  Setting Sepolia Oracle Prices...\n");
  
  const ORACLE = "0xC9aB81218270C4419ec0929A074E39E81DB9b64E";
  const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  // Prices in 8 decimals (Pyth format)
  const WETH_PRICE = 339000000000; // $3390
  const USDC_PRICE = 100000000;    // $1.00
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Oracle:", ORACLE);
  console.log("");
  
  const oracle = await hre.ethers.getContractAt("TestnetPriceOracle", ORACLE);
  
  // Set WETH price
  console.log(`Setting WETH price: $${WETH_PRICE / 1e8}...`);
  const tx1 = await oracle.setPrice(WETH, WETH_PRICE);
  await tx1.wait();
  console.log("✅ WETH price set");
  
  // Set USDC price
  console.log(`Setting USDC price: $${USDC_PRICE / 1e8}...`);
  const tx2 = await oracle.setPrice(USDC, USDC_PRICE);
  await tx2.wait();
  console.log("✅ USDC price set");
  
  // Verify
  console.log("\n📊 Verifying prices:");
  const wethPrice = await oracle.getPrice(WETH);
  const usdcPrice = await oracle.getPrice(USDC);
  console.log(`  WETH: $${Number(wethPrice) / 1e8}`);
  console.log(`  USDC: $${Number(usdcPrice) / 1e8}`);
  
  console.log("\n✅ Oracle configured!");
  console.log("\n📋 NEXT: Deploy MockDEXAdapter with this oracle");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
