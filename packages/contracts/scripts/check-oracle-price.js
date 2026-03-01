const hre = require("hardhat");

async function main() {
  const ADAPTER = "0x7cafe27c7367fa0e929d4e83578cec838e3ceec7";
  const WMATIC = "0x360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9";
  const USDC = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582";
  
  const adapter = await hre.ethers.getContractAt(
    "MockDEXAdapter",
    ADAPTER
  );
  
  // Get oracle address
  const oracleAddr = await adapter.priceOracle();
  console.log(`\n=== ORACLE PRICE CHECK ===`);
  console.log(`Oracle: ${oracleAddr}`);
  console.log("");
  
  const oracle = await hre.ethers.getContractAt(
    "contracts/oracles/MockPriceOracle.sol:MockPriceOracle",
    oracleAddr
  );
  
  try {
    const wmaticPrice = await oracle.getPrice(WMATIC);
    console.log(`WMATIC price: $${hre.ethers.formatUnits(wmaticPrice, 8)}`);
  } catch (err) {
    console.log(`❌ WMATIC price FAILED: ${err.message}`);
  }
  
  try {
    const usdcPrice = await oracle.getPrice(USDC);
    console.log(`USDC price: $${hre.ethers.formatUnits(usdcPrice, 8)}`);
  } catch (err) {
    console.log(`❌ USDC price FAILED: ${err.message}`);
  }
  
  console.log("");
  console.log("Calling getQuote directly on adapter...");
  
  try {
    const quote = await adapter.getQuote(USDC, WMATIC, 1000000n); // 1 USDC
    console.log(`Quote: 1 USDC → ${hre.ethers.formatEther(quote[0])} WMATIC`);
  } catch (err) {
    console.log(`❌ GET_QUOTE FAILED: ${err.shortMessage || err.message}`);
    console.log("");
    console.log("🔥 ROOT CAUSE: Oracle returning 0 or getPrice() reverts!");
  }
}

main().catch(console.error);
