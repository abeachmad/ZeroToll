const hre = require("hardhat");

async function main() {
  console.log("🔐 Whitelisting Mock Adapter in RouterHub (Sepolia)...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Account:", deployer.address);

  const ROUTER_HUB_ADDRESS = "0x19091A6c655704c8fb55023635eE3298DcDf66FF";
  
  // Use deployer address as mock adapter for testing
  const MOCK_ADAPTER = deployer.address;
  
  console.log("RouterHub:", ROUTER_HUB_ADDRESS);
  console.log("Mock Adapter:", MOCK_ADAPTER);

  // RouterHub ABI
  const routerHubAbi = [
    "function whitelistAdapter(address adapter, bool status) external",
    "function isWhitelistedAdapter(address adapter) external view returns (bool)",
    "function owner() external view returns (address)"
  ];
  
  const routerHub = await hre.ethers.getContractAt(routerHubAbi, ROUTER_HUB_ADDRESS);
  
  // Check current owner
  try {
    const owner = await routerHub.owner();
    console.log("RouterHub owner:", owner);
    console.log("Deployer:", deployer.address);
    
    if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log("\n❌ ERROR: You are not the owner of RouterHub!");
      console.log("   Owner:", owner);
      console.log("   Your address:", deployer.address);
      console.log("\n💡 Solution: Use the private key that deployed RouterHub");
      process.exit(1);
    }
  } catch (e) {
    console.log("Warning: Could not check owner, proceeding anyway...");
  }

  // Whitelist adapter
  console.log("\n📝 Whitelisting adapter...");
  const tx = await routerHub.whitelistAdapter(MOCK_ADAPTER, true);
  console.log("TX sent:", tx.hash);
  
  await tx.wait();
  console.log("✅ Transaction confirmed!");

  // Verify
  const isWhitelisted = await routerHub.isWhitelistedAdapter(MOCK_ADAPTER);
  console.log("\n🔍 Verification:");
  console.log("  Whitelisted:", isWhitelisted ? "✅ YES" : "❌ NO");
  
  if (isWhitelisted) {
    console.log("\n🎉 SUCCESS! Adapter is now whitelisted!");
    console.log("\n📝 Update backend/.env:");
    console.log(`SEPOLIA_MOCKDEX_ADAPTER=${MOCK_ADAPTER}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
