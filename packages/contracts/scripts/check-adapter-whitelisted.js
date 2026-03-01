const hre = require("hardhat");

async function main() {
  const ADAPTER = "0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec";
  const ROUTER_HUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
  
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTER_HUB);
  
  const isWhitelisted = await routerHub.whitelistedAdapter(ADAPTER);
  
  console.log(`\nAdapter: ${ADAPTER}`);
  console.log(`RouterHub: ${ROUTER_HUB}`);
  console.log(`Whitelisted: ${isWhitelisted ? '✅ YES' : '❌ NO'}\n`);
  
  if (!isWhitelisted) {
    console.log("🔥 ROOT CAUSE: Adapter not whitelisted!");
    console.log("Fix: await routerHub.whitelistAdapter(adapter, true)");
  }
}

main().catch(console.error);
