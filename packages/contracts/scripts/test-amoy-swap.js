/**
 * Test RouterHub v1.3 on Polygon Amoy
 * Execute USDC → WPOL swap and verify on PolygonScan
 */

const hre = require("hardhat");

async function main() {
  console.log("🧪 Testing RouterHub v1.3 on Amoy...\n");
  
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), "POL\n");

  // Deployed contracts
  const ROUTERHUB = "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b";
  const ADAPTER = "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7";
  const USDC = "0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB"; // Test USDC
  const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

  console.log("📋 Configuration:");
  console.log("  RouterHub:", ROUTERHUB);
  console.log("  Adapter:", ADAPTER);
  console.log("  USDC:", USDC);
  console.log("  WPOL:", WPOL);

  // Get contracts
  const routerHub = await hre.ethers.getContractAt("RouterHub", ROUTERHUB);
  const usdc = await hre.ethers.getContractAt("IERC20", USDC);
  const wpol = await hre.ethers.getContractAt("IERC20", WPOL);

  // Check balances
  console.log("\n💰 Checking balances...");
  const usdcBalance = await usdc.balanceOf(signer.address);
  const wpolBalance = await wpol.balanceOf(signer.address);
  console.log("  USDC balance:", hre.ethers.formatUnits(usdcBalance, 6));
  console.log("  WPOL balance:", hre.ethers.formatEther(wpolBalance));

  if (usdcBalance < 100000n) { // Less than 0.1 USDC
    console.log("\n⚠️  Insufficient USDC!");
    console.log("   Get USDC from faucet: https://faucet.polygon.technology/");
    console.log("   Or use Amoy USDC faucet");
    return;
  }

  // Approve RouterHub
  console.log("\n✅ Approving RouterHub to spend USDC...");
  const currentAllowance = await usdc.allowance(signer.address, ROUTERHUB);
  console.log("  Current allowance:", hre.ethers.formatUnits(currentAllowance, 6));
  
  if (currentAllowance < 100000n) {
    const approveTx = await usdc.approve(ROUTERHUB, hre.ethers.MaxUint256);
    await approveTx.wait();
    console.log("  ✅ Approval TX:", approveTx.hash);
  } else {
    console.log("  Already approved");
  }

  // Build intent (USDC → WPOL)
  const SWAP_AMOUNT = 100000n; // 0.1 USDC (6 decimals)
  const MIN_OUT = hre.ethers.parseEther("0.01"); // Expect at least 0.01 WPOL
  const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

  const intent = {
    user: signer.address,
    tokenIn: USDC,
    amtIn: SWAP_AMOUNT,
    tokenOut: WPOL,
    minOut: MIN_OUT,
    dstChainId: 80002, // Amoy chain ID
    deadline: deadline,
    feeToken: "0x0000000000000000000000000000000000000000", // Zero address (no fee)
    feeMode: 0, // NATIVE mode
    feeCapToken: 0,
    routeHint: "0x",
    nonce: 0
  };

  console.log("\n📝 Intent:");
  console.log("  User:", intent.user);
  console.log("  TokenIn (USDC):", intent.tokenIn);
  console.log("  TokenOut (WPOL):", intent.tokenOut);
  console.log("  AmountIn:", hre.ethers.formatUnits(intent.amtIn, 6), "USDC");
  console.log("  MinAmountOut:", hre.ethers.formatEther(intent.minOut), "WPOL");
  console.log("  Deadline:", new Date(deadline * 1000).toISOString());

  // Encode route data (for MockDEXAdapter.swap)
  const adapter = await hre.ethers.getContractAt("MockDEXAdapter", ADAPTER);
  const routeData = adapter.interface.encodeFunctionData("swap", [
    USDC,
    WPOL,
    SWAP_AMOUNT,
    MIN_OUT,
    ROUTERHUB, // ← CRITICAL: Recipient should be RouterHub, not signer!
    deadline
  ]);
  
  console.log("  RouteData length:", routeData.length, "bytes");
  console.log("  Function selector:", routeData.slice(0, 10));

  console.log("\n🚀 Executing swap via RouterHub...");
  console.log("  Gas limit: 1,200,000");
  
  try {
    const tx = await routerHub.executeRoute(
      intent,
      ADAPTER,
      routeData,
      { 
        gasLimit: 1200000,
        maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
        maxPriorityFeePerGas: hre.ethers.parseUnits("30", "gwei")
      }
    );
    
    console.log("\n⏳ Transaction sent:", tx.hash);
    console.log("  View on PolygonScan: https://amoy.polygonscan.com/tx/" + tx.hash);
    console.log("  Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("\n🎉 SUCCESS!");
    console.log("  Block:", receipt.blockNumber);
    console.log("  Gas used:", receipt.gasUsed.toString());
    console.log("  Status:", receipt.status === 1 ? "✅ SUCCESS" : "❌ FAILED");
    
    // Check final balances
    const usdcBalanceAfter = await usdc.balanceOf(signer.address);
    const wpolBalanceAfter = await wpol.balanceOf(signer.address);
    console.log("\n💰 Final balances:");
    console.log("  USDC:", hre.ethers.formatUnits(usdcBalanceAfter, 6), "(was", hre.ethers.formatUnits(usdcBalance, 6) + ")");
    console.log("  WPOL:", hre.ethers.formatEther(wpolBalanceAfter), "(was", hre.ethers.formatEther(wpolBalance) + ")");
    console.log("  WPOL received:", hre.ethers.formatEther(wpolBalanceAfter - wpolBalance));
    
    console.log("\n" + "=".repeat(70));
    console.log("✅ TRANSACTION RECORDED ON AMOY BLOCKCHAIN!");
    console.log("🔗 https://amoy.polygonscan.com/tx/" + tx.hash);
    console.log("=".repeat(70));
    
  } catch (error) {
    console.error("\n❌ Transaction failed!");
    console.error("Error:", error.message);
    
    if (error.receipt) {
      console.error("Gas used:", error.receipt.gasUsed.toString());
      console.error("TX hash:", error.receipt.hash);
      console.error("View on PolygonScan: https://amoy.polygonscan.com/tx/" + error.receipt.hash);
    }
    
    // If gas is exactly 154819, it's the same issue
    if (error.receipt && error.receipt.gasUsed.toString() === "154819") {
      console.error("\n⚠️  SAME 154819 GAS ISSUE DETECTED!");
      console.error("  Root cause: Still reverting at same point");
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
