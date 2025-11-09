const { ethers } = require("ethers");

// Fix checksum untuk semua addresses
const addresses = {
  "Amoy USDC": "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
  "Amoy WMATIC": "0x360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9",
  "Sepolia USDC": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  "Sepolia WETH": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
};

console.log("=== PROPER CHECKSUM ADDRESSES ===\n");
for (const [name, addr] of Object.entries(addresses)) {
  const checksummed = ethers.getAddress(addr);
  console.log(`${name}:`);
  console.log(`  Input:  ${addr}`);
  console.log(`  Proper: ${checksummed}`);
  console.log("");
}
