/**
 * Test low-level call to adapter from RouterHub on Amoy
 */

const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing low-level call pattern...\n");
  
  const [signer] = await hre.ethers.getSigners();

  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const USDC = "0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);

  // Transfer USDC to adapter first
  console.log("📤 Prefunding adapter with USDC...");
  const tx1 = await usdc.transfer(ADAPTER, 100000n);
  await tx1.wait();
  console.log("✅ Adapter prefunded");

  // Encode the swap call
  const deadline = Math.floor(Date.now() / 1000) + 300;
  
  console.log("\n🔨 Encoding swap call...");
  const routeData = adapter.interface.encodeFunctionData("swap", [
    USDC,
    WPOL,
    100000n, // 0.1 USDC
    hre.ethers.parseEther("0.01"), // min out
    signer.address,
    deadline
  ]);
  
  console.log("  RouteData length:", routeData.length, "bytes");
  console.log("  Function selector:", routeData.slice(0, 10));

  // Make low-level call (simulating what RouterHub does)
  console.log("\n📞 Making low-level call to adapter...");
  
  try {
    const tx = await signer.sendTransaction({
      to: ADAPTER,
      data: routeData,
      gasLimit: 800000,
      maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
      maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei")
    });
    
    console.log("⏳ TX sent:", tx.hash);
    const receipt = await tx.wait();
    
    console.log("\n✅ LOW-LEVEL CALL SUCCESS!");
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    
    // Decode return data
    if (receipt.status === 1) {
      console.log("\n🎉 LOW-LEVEL CALL PATTERN WORKS!");
      console.log("  This proves RouterHub's call{gas:800000}(routeData) SHOULD work");
    }
    
  } catch (error) {
    console.error("\n❌ Low-level call failed!");
    console.error("Error:", error.message);
    if (error.receipt) {
      console.error("Gas:", error.receipt.gasUsed.toString());
    }
  }
}

main().catch(console.error);
