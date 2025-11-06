const hre = require("hardhat");

async function main() {
  const pk1 = "0x50adc32849a844382026830b6d797652ec432b255c2b3b31afd11e604d074332";
  const pk2 = "0x470e31d6cb154d9c5fe824241d57689665869db3df390278570aeecd2318116c";
  
  const wallet1 = new hre.ethers.Wallet(pk1);
  const wallet2 = new hre.ethers.Wallet(pk2);
  
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                    WALLET ADDRESSES                            ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  console.log("1️⃣  DEPLOYER (packages/contracts/.env)");
  console.log("    Private Key Variable: PRIVATE_KEY_DEPLOYER");
  console.log("    Address:", wallet1.address);
  console.log("");
  
  console.log("2️⃣  RELAYER (backend/.env)");
  console.log("    Private Key Variable: RELAYER_PRIVATE_KEY");
  console.log("    Address:", wallet2.address);
  console.log("");
  
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("");
  
  if (wallet1.address.toLowerCase() === wallet2.address.toLowerCase()) {
    console.log("✅ DEPLOYER dan RELAYER adalah WALLET YANG SAMA!");
  } else {
    console.log("❌ DEPLOYER dan RELAYER adalah wallet yang BERBEDA!");
  }
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
