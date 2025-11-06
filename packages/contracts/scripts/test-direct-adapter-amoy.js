/**
 * Test calling MockDEXAdapter directly on Amoy (bypassing RouterHub)
 */

const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing direct adapter call on Amoy...\n");
  
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);

  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const USDC = "0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB";
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  const wpol = await hre.ethers.getContractAt("IERC20", WPOL);

  console.log("📋 Contracts:");
  console.log("  Adapter:", ADAPTER);
  console.log("  USDC:", USDC);
  console.log("  WPOL:", WPOL);

  // Check balances
  const usdcBal = await usdc.balanceOf(signer.address);
  const wpolBal = await wpol.balanceOf(signer.address);
  console.log("\n💰 Signer balances:");
  console.log("  USDC:", hre.ethers.formatUnits(usdcBal, 6));
  console.log("  WPOL:", hre.ethers.formatEther(wpolBal));

  // Check adapter balances
  const adapterUSDC = await usdc.balanceOf(ADAPTER);
  const adapterWPOL = await wpol.balanceOf(ADAPTER);
  console.log("\n💰 Adapter balances:");
  console.log("  USDC:", hre.ethers.formatUnits(adapterUSDC, 6));
  console.log("  WPOL:", hre.ethers.formatEther(adapterWPOL));

  // Transfer USDC to adapter (prefund pattern)
  console.log("\n📤 Transferring 0.1 USDC to adapter...");
  const transferTx = await usdc.transfer(ADAPTER, 100000n); // 0.1 USDC
  await transferTx.wait();
  console.log("✅ Transferred");

  const adapterUSDCAfter = await usdc.balanceOf(ADAPTER);
  console.log("  Adapter USDC now:", hre.ethers.formatUnits(adapterUSDCAfter, 6));

  // Call adapter.swap() directly
  console.log("\n🔨 Calling adapter.swap() directly...");
  const deadline = Math.floor(Date.now() / 1000) + 300;
  
  try {
    const tx = await adapter.swap(
      USDC,
      WPOL,
      100000n, // 0.1 USDC
      hre.ethers.parseEther("0.01"), // min out
      signer.address,
      deadline,
      {
        gasLimit: 500000,
        maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
        maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei")
      }
    );
    
    console.log("⏳ TX sent:", tx.hash);
    console.log("  View: https://amoy.polygonscan.com/tx/" + tx.hash);
    
    const receipt = await tx.wait();
    console.log("\n✅ SUCCESS!");
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
    
    // Check final balances
    const wpolFinal = await wpol.balanceOf(signer.address);
    console.log("\n💰 Final WPOL balance:", hre.ethers.formatEther(wpolFinal));
    console.log("  WPOL received:", hre.ethers.formatEther(wpolFinal - wpolBal));
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ DIRECT ADAPTER CALL WORKS!");
    console.log("=".repeat(70));
    
  } catch (error) {
    console.error("\n❌ Direct adapter call failed!");
    console.error("Error:", error.message);
    if (error.receipt) {
      console.error("Gas used:", error.receipt.gasUsed.toString());
      console.error("TX:", error.receipt.hash);
    }
  }
}

main().catch(console.error);
