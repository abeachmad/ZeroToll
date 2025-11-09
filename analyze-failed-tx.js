/**
 * Analisis Perbedaan Transaksi Berhasil vs Gagal
 * 
 * TRANSAKSI GAGAL (4):
 * - Amoy: 0xd4fa6f75... & 0x70cf7f16... (1 USDC → WMATIC) ❌
 * - Sepolia: 0xebae995e... & 0x45e3df9c... (0.001 WETH → USDC) ❌
 * 
 * TRANSAKSI BERHASIL (2):
 * - Amoy: 0x99a3c8a9... (1 WMATIC → USDC) ✅
 * - Sepolia: 0xdecaf707... (1 USDC → WETH) ✅
 */

const ANALYSIS = {
  // AMOY GAGAL #1 & #2
  amoy_failed: {
    tx1: "0xd4fa6f75095bf8837f8137ae2fc2a2cc92afbe11da469713a1a13c239b1b21c6",
    tx2: "0x70cf7f163face9bf6577e77231225b99fc5d42c6af7a67d5966ae651a2d61569",
    direction: "USDC → WMATIC",
    tokenIn: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // USDC
    tokenOut: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", // WMATIC
    amountIn: "1000000", // 1 USDC (6 decimals)
    error: "Insufficient output",
    adapter_error: "Adapter call failed",
    
    // Dari VM Trace
    getQuote_output: "0x0000000000000000000000000000000000000000000000000dd60e37b91080000", // 0.997 WMATIC
    minAmountOut: "0x17d8c97dcda3c0000", // 1.726 WMATIC (terlalu tinggi!)
    
    // Flow:
    // 1. RouterHub.transferFrom(user → router) ✅
    // 2. RouterHub.transfer(router → adapter) ✅
    // 3. Adapter.swap() → getQuote returns 0.997 WMATIC
    // 4. Check: 0.997 WMATIC < 1.726 WMATIC (minAmountOut) → REVERT ❌
  },
  
  // SEPOLIA GAGAL #1 & #2
  sepolia_failed: {
    tx1: "0xebae995eb630f1c439dfcd4e16be4f7b22721d2e01fb34f51bb7477756277e5e",
    tx2: "0x45e3df9c6b2aaa44018d1496f8fa10e0c25160f0a615ae3ddf475751fe2203b0",
    direction: "WETH → USDC",
    tokenIn: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", // WETH
    tokenOut: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
    amountIn: "1000000000000000", // 0.001 WETH (18 decimals)
    error: "Adapter call failed",
    
    // Tidak ada detail quote dari VM trace (internal call gagal)
    minAmountOut: "0x30d2db", // 3.2 USDC (6 decimals)
    
    // Flow:
    // 1. RouterHub.transferFrom(user → router) ✅
    // 2. RouterHub.transfer(router → adapter) ✅
    // 3. Adapter.swap() → REVERT ❌ (tidak sampai ke quote check)
  },
  
  // AMOY BERHASIL
  amoy_success: {
    tx: "0x99a3c8a981a5b2f77ef5f9ce834ff0989c2b1056e614339a703af189512e75ee",
    direction: "WMATIC → USDC",
    tokenIn: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", // WMATIC
    tokenOut: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582", // USDC
    amountIn: "1000000000000000000", // 1 WMATIC (18 decimals)
    amountOut: "997000", // 0.997 USDC
    minAmountOut: "0x7eecf", // 0.52 USDC
    
    // Flow:
    // 1. RouterHub.transferFrom(user → router) ✅
    // 2. RouterHub.transfer(router → adapter) ✅
    // 3. Adapter.swap() → getQuote returns 0.997 USDC ✅
    // 4. Check: 0.997 USDC > 0.52 USDC → CONTINUE ✅
    // 5. Adapter.transfer(adapter → router) ✅
    // 6. RouterHub.transfer(router → user) ✅
  },
  
  // SEPOLIA BERHASIL
  sepolia_success: {
    tx: "0xdecaf707bc2edbad0935a0497db65e7302ddfe21f6f819dd18f2ed864b21d39a",
    direction: "USDC → WETH",
    tokenIn: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
    tokenOut: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", // WETH
    amountIn: "1000000", // 1 USDC (6 decimals)
    amountOut: "498500000000000", // 0.0004985 WETH
    minAmountOut: "0xfe05994927ff", // 0.000278 WETH
    
    // Flow: sama dengan amoy_success, semua tahap berhasil ✅
  }
};

// KESIMPULAN AWAL:
console.log("=== ANALISIS PERBEDAAN TRANSAKSI ===\n");

console.log("1. POLA KESUKSESAN:");
console.log("   ✅ WMATIC → USDC (Amoy): Quote 0.997 USDC, minOut 0.52 USDC → PASS");
console.log("   ✅ USDC → WETH (Sepolia): Quote 0.0004985 WETH, minOut 0.000278 WETH → PASS");
console.log("");

console.log("2. POLA KEGAGALAN:");
console.log("   ❌ USDC → WMATIC (Amoy): Quote 0.997 WMATIC, minOut 1.726 WMATIC → FAIL");
console.log("   ❌ WETH → USDC (Sepolia): Adapter call failed (tidak sampai quote check)");
console.log("");

console.log("3. ROOT CAUSE ANALYSIS:");
console.log("");
console.log("   A. AMOY USDC → WMATIC FAILURE:");
console.log("      - getQuote mengembalikan: 0.997 WMATIC (~$0.18)");
console.log("      - minAmountOut yang diminta: 1.726 WMATIC (~$0.31)");
console.log("      - Penyebab: Frontend menghitung minAmountOut SALAH!");
console.log("      - Quote 0.997 WMATIC berarti rate: 0.997 WMATIC per 1 USDC");
console.log("      - Tapi minOut 1.726 WMATIC = harapan rate 1.726 WMATIC per 1 USDC");
console.log("      - KONTRADIKSI: Oracle bilang WPOL=$0.18, tapi minOut harapkan $0.58!");
console.log("");
console.log("   B. SEPOLIA WETH → USDC FAILURE:");
console.log("      - Transaksi revert sebelum sampai quote comparison");
console.log("      - Kemungkinan: Adapter tidak memiliki USDC yang cukup");
console.log("      - Atau: Oracle query gagal (Pyth feed issue)");
console.log("");

console.log("4. HIPOTESIS:");
console.log("");
console.log("   FRONTEND ISSUE:");
console.log("   - Frontend menghitung slippage/minAmountOut dengan HARGA LAMA/SALAH");
console.log("   - Saat direction: tokenA → tokenB, quote benar");
console.log("   - Tapi saat direction: tokenB → tokenA, minOut dihitung terbalik");
console.log("");
console.log("   CONTOH:");
console.log("   - Oracle: WPOL=$0.18, USDC=$1.00");
console.log("   - Benar: 1 USDC → 0.997 WMATIC (1/0.18 = 5.55, tapi ada fee)");
console.log("   - minOut Salah: 1.726 WMATIC (frontend pakai rate lama?)");
console.log("");

console.log("5. VERIFIKASI YANG DIBUTUHKAN:");
console.log("   1. Cek frontend logic untuk kalkulasi minAmountOut");
console.log("   2. Cek apakah frontend cache price lama");
console.log("   3. Cek backend log untuk melihat price yang diberikan ke frontend");
console.log("   4. Cek adapter balance untuk Sepolia USDC");
console.log("   5. Cek apakah ada hardcode price di frontend");
console.log("");

console.log("=== LANGKAH DEBUGGING ===");
console.log("1. Cek adapter balance Sepolia");
console.log("2. Cek frontend code untuk minAmountOut calculation");
console.log("3. Test oracle price query langsung");
console.log("4. Cek backend API response untuk quote");
