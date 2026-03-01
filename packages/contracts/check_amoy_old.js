const hre = require("hardhat");

async function checkAdapter(addr, desc) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${desc}: ${addr}`);
  
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
  const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
  
  const wpol = await hre.ethers.getContractAt("IERC20", WPOL);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  
  const wpolBal = await wpol.balanceOf(addr);
  const usdcBal = await usdc.balanceOf(addr);
  const nativeBal = await hre.ethers.provider.getBalance(addr);
  
  const hasAny = wpolBal > 0n || usdcBal > 0n || nativeBal > 0n;
  
  if (hasAny) {
    console.log("💰 BALANCES:");
    if (wpolBal > 0n) console.log(`  WPOL: ${hre.ethers.formatEther(wpolBal)}`);
    if (usdcBal > 0n) console.log(`  USDC: ${hre.ethers.formatUnits(usdcBal, 6)}`);
    if (nativeBal > 0n) console.log(`  POL:  ${hre.ethers.formatEther(nativeBal)}`);
    console.log("  ⚠️  HAS FUNDS!");
  } else {
    console.log("✅ Empty");
  }
  
  return hasAny;
}

async function main() {
  console.log("🔍 Checking Amoy old adapters...\n");
  
  const adapters = [
    ["0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301", "Very old adapter"],
    ["0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7", "Old adapter v2"],
    ["0xAdA3d900ee8d20aDF3d531bE4dF1c3AC42Bc80Ec", "Most recent (pre-Pyth)"],
  ];
  
  let anyFunds = false;
  for (const [addr, desc] of adapters) {
    const hasFunds = await checkAdapter(addr, desc);
    anyFunds = anyFunds || hasFunds;
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (anyFunds) {
    console.log("\n⚠️  Some adapters have funds - check output above");
  } else {
    console.log("\n✅ All adapters empty - safe to proceed!");
  }
}

main().catch(console.error);
