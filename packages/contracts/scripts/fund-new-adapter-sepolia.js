const hre = require("hardhat");

async function main() {
  console.log("Funding new MockDEXAdapter with USDC (Sepolia)...");
  console.log("===================================================");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  
  const adapterAddress = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301";
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  
  // USDC contract
  const USDC = await hre.ethers.getContractAt("IERC20", usdcAddress);
  
  // Check deployer balance
  const balance = await USDC.balanceOf(deployer.address);
  console.log("Deployer USDC balance:", hre.ethers.formatUnits(balance, 6), "USDC");
  
  if (balance === 0n) {
    console.log("\n❌ Deployer has no USDC!");
    console.log("Please get USDC from Sepolia faucet first:");
    console.log("https://faucet.circle.com/");
    process.exit(1);
  }
  
  // Fund with 50 USDC
  const fundAmount = hre.ethers.parseUnits("50", 6);
  
  if (balance < fundAmount) {
    console.log("\n⚠️ Not enough USDC for 50 USDC funding");
    console.log("Funding with available balance instead...");
    fundAmount = balance;
  }
  
  console.log("\nApproving adapter to spend USDC...");
  const approveTx = await USDC.approve(adapterAddress, fundAmount);
  await approveTx.wait();
  console.log("✅ Approved!");
  
  console.log("\nFunding adapter...");
  const MockDEXAdapter = await hre.ethers.getContractFactory("MockDEXAdapter");
  const adapter = MockDEXAdapter.attach(adapterAddress);
  
  const fundTx = await adapter.fundAdapter(usdcAddress, fundAmount);
  await fundTx.wait();
  console.log("✅ Funded with", hre.ethers.formatUnits(fundAmount, 6), "USDC");
  
  // Verify
  const adapterBalance = await USDC.balanceOf(adapterAddress);
  console.log("\nAdapter USDC balance:", hre.ethers.formatUnits(adapterBalance, 6), "USDC");
  
  console.log("\n✅ Funding complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
