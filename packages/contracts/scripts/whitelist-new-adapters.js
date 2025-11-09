const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\n🔐 Whitelisting NEW adapters on ${network}\n`);
  
  const [signer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${signer.address}\n`);

  if (network === "sepolia") {
    const ROUTER_HUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd";
    const NEW_ADAPTER = "0x23e2B44bC22F9940F9eb00C6C674039ed291821F";
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`RouterHub: ${ROUTER_HUB}`);
    console.log(`NEW MockDEXAdapter (Pyth): ${NEW_ADAPTER}`);
    
    const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);
    
    // Check if already whitelisted
    const isWhitelisted = await routerHub.whitelistedAdapter(NEW_ADAPTER);
    console.log(`\n📋 Current whitelist status: ${isWhitelisted ? "✅ Already whitelisted" : "⚠️  Not whitelisted"}`);
    
    if (!isWhitelisted) {
      console.log(`\n🚀 Whitelisting NEW adapter...`);
      const tx = await routerHub.whitelistAdapter(NEW_ADAPTER, true);
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✅ Whitelisted!`);
    } else {
      console.log(`\n✅ Already whitelisted, skipping`);
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
  } else if (network === "amoy") {
    const ROUTER_HUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
    const NEW_ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5";
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`RouterHub: ${ROUTER_HUB}`);
    console.log(`NEW MockDEXAdapter (Pyth): ${NEW_ADAPTER}`);
    
    const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);
    
    // Check if already whitelisted
    const isWhitelisted = await routerHub.whitelistedAdapter(NEW_ADAPTER);
    console.log(`\n📋 Current whitelist status: ${isWhitelisted ? "✅ Already whitelisted" : "⚠️  Not whitelisted"}`);
    
    if (!isWhitelisted) {
      console.log(`\n🚀 Whitelisting NEW adapter...`);
      const tx = await routerHub.whitelistAdapter(NEW_ADAPTER, true);
      console.log(`  TX: ${tx.hash}`);
      await tx.wait();
      console.log(`  ✅ Whitelisted!`);
    } else {
      console.log(`\n✅ Already whitelisted, skipping`);
    }
    
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
  
  console.log(`\n✅ Whitelist complete!\n`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
