const hre = require("hardhat");

async function main() {
  // Use lowercase to avoid checksum validation, ethers will handle it
  const ADAPTER_ADDRESS = "0x7cafe27c7367fa0e929d4e83578cec838e3ceec7".toLowerCase();
  const WMATIC_AMOY = "0x360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9".toLowerCase();
  const USDC_AMOY = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582".toLowerCase();
  
  const provider = new hre.ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology/");
  
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];
  
  const wmatic = new hre.ethers.Contract(WMATIC_AMOY, ERC20_ABI, provider);
  const usdc = new hre.ethers.Contract(USDC_AMOY, ERC20_ABI, provider);
  
  const wmaticBalance = await wmatic.balanceOf(ADAPTER_ADDRESS);
  const usdcBalance = await usdc.balanceOf(ADAPTER_ADDRESS);
  
  console.log("\n=== ADAPTER BALANCES ===");
  console.log(`Adapter: ${ADAPTER_ADDRESS}`);
  console.log("");
  console.log(`WMATIC balance: ${hre.ethers.formatEther(wmaticBalance)} WMATIC`);
  console.log(`USDC balance: ${hre.ethers.formatUnits(usdcBalance, 6)} USDC`);
  console.log("");
  
  if (wmaticBalance < hre.ethers.parseEther("5")) {
    console.log("❌ INSUFFICIENT WMATIC! Adapter needs at least 5 WMATIC to fulfill 1 USDC → WMATIC swap");
    console.log(`   Current: ${hre.ethers.formatEther(wmaticBalance)} WMATIC`);
    console.log(`   Required: ~5.26 WMATIC`);
  } else {
    console.log("✅ Sufficient WMATIC balance");
  }
}

main().catch(console.error);
