const hre = require("hardhat");

const CONFIGS = {
  amoy: {
    routerHub: "0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881",
    adapter: "0xc8a769B6dd35c34B8c5612b340cCA52Fca7B041c", // OdosAdapter
  },
  sepolia: {
    routerHub: "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84",
    adapter: "0x...", // TODO
  }
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  
  console.log("\n=== WHITELISTING ADAPTER ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  
  const config = CONFIGS[network];
  if (!config || config.adapter === "0x...") {
    console.log("❌ No configuration for network:", network);
    return;
  }
  
  console.log("RouterHub:", config.routerHub);
  console.log("Adapter:", config.adapter);

  const routerHub = await hre.ethers.getContractAt("RouterHub", config.routerHub);
  
  // Check if already whitelisted
  const isWhitelisted = await routerHub.whitelistedAdapter(config.adapter);
  console.log("\nCurrent status:", isWhitelisted ? "✅ Already whitelisted" : "❌ Not whitelisted");
  
  if (isWhitelisted) {
    console.log("No action needed!");
    return;
  }

  // Whitelist adapter
  console.log("\nWhitelisting adapter...");
  const tx = await routerHub.whitelistAdapter(config.adapter, true);
  console.log("TX sent:", tx.hash);
  
  await tx.wait();
  console.log("✅ Transaction confirmed!");

  // Verify
  const newStatus = await routerHub.whitelistedAdapter(config.adapter);
  console.log("Verified:", newStatus ? "✅ Whitelisted" : "❌ Failed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
