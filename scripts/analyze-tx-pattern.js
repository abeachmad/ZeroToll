/**
 * ANALISIS FINAL - Transaction Failure Root Cause
 */

console.log("=== TRANSACTION FAILURE ANALYSIS ===\n");

const analysis = {
  failed: [
    {
      tx: "0x22bc8dff40f5f980b4ad225e4e8c12d009b3688c9dcd9a5e48517d54ca06273d",
      direction: "1 USDC → 5.54 WMATIC (Amoy)",
      error: "Adapter call failed",
      approval: "TIDAK ADA (infinite approval sebelumnya)"
    },
    {
      tx: "0xef91d2ae131e313d5ba042410d92fa43fee589401e7f4c64d01771428b882523",
      direction: "0.001 WETH → 3.38 USDC (Sepolia)", 
      error: "Adapter call failed",
      approval: "TIDAK ADA (infinite approval sebelumnya)"
    }
  ],
  success: [
    {
      tx: "0x65c40c20dc95a0735c976271c2b5b2c2f015ce84c69aceeaf38bbc567c5887ca",
      direction: "1 WMATIC → 0.547 USDC (Amoy)",
      approval: "ADA (exact amount)"
    },
    {
      tx: "0x7a135e84473eab5f9f26afc785460fb3f3aa525ea9f8340a04c67e958de4af56",
      direction: "1 USDC → 0.000278 WETH (Sepolia)",
      approval: "ADA (exact amount)"
    }
  ]
};

console.log("FAILED TRANSACTIONS:");
analysis.failed.forEach(tx => {
  console.log(`  - ${tx.direction}`);
  console.log(`    TX: ${tx.tx}`);
  console.log(`    Error: ${tx.error}`);
  console.log(`    Approval: ${tx.approval}`);
  console.log("");
});

console.log("SUCCESS TRANSACTIONS:");
analysis.success.forEach(tx => {
  console.log(`  - ${tx.direction}`);
  console.log(`    TX: ${tx.tx}`);
  console.log(`    Approval: ${tx.approval}`);
  console.log("");
});

console.log("=== PATTERN IDENTIFIED ===\n");
console.log("HYPOTHESIS 1: Approval Pattern");
console.log("  - Transactions WITHOUT fresh approval → FAIL");
console.log("  - Transactions WITH fresh approval → SUCCESS");
console.log("");
console.log("BUT WHY? Approval should not affect adapter swap logic!");
console.log("");

console.log("HYPOTHESIS 2: Adapter Balance");
console.log("  - Failed txs might be trying to swap FROM adapter reserves");
console.log("  - Success txs might be direct user → user swaps");
console.log("");

console.log("HYPOTHESIS 3: Oracle Price Mismatch");
console.log("  - Adapter quote correct, but minOut from frontend wrong");
console.log("  - When approval happens, frontend refetches quote with correct minOut");
console.log("  - When no approval, frontend uses stale/wrong minOut");
console.log("");

console.log("=== ACTION REQUIRED ===");
console.log("1. ✅ DONE: Force approval reset → always show approve button");
console.log("2. TODO: Debug why adapter call fails when no fresh approval");
console.log("3. TODO: Compare minOut values in failed vs success transactions");
console.log("4. TODO: Check if frontend calculates different minOut with/without approval");
