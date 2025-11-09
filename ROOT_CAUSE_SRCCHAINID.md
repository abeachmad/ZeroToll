# ROOT CAUSE ANALYSIS - SWAP FAILURES

## 🔍 MASALAH DITEMUKAN

### 1. ❌ Frontend TIDAK kirim `srcChainId` (CRITICAL - SUDAH DIPERBAIKI)

**File:** `frontend/src/pages/Swap.jsx` line 265

**SEBELUM:**
```javascript
const intent = {
  user: address || '0x1234567890123456789012345678901234567890',
  tokenIn: tokenIn.symbol,
  amtIn: parseFloat(amountIn),
  tokenOut: tokenOut.symbol,
  minOut: parseFloat(amountIn) * 0.995,
  dstChainId: toChain.id,  // ✅ Ada
  // srcChainId TIDAK ADA! ❌
  feeMode,
  feeCap: parseFloat(feeCap),
  deadline: Math.floor(Date.now() / 1000) + 600,
  nonce: Date.now()
};
```

**SESUDAH (FIXED):**
```javascript
const intent = {
  user: address || '0x1234567890123456789012345678901234567890',
  tokenIn: tokenIn.symbol,
  amtIn: parseFloat(amountIn),
  tokenOut: tokenOut.symbol,
  minOut: parseFloat(amountIn) * 0.995,
  srcChainId: fromChain.id,  // ✅ DITAMBAHKAN!
  dstChainId: toChain.id,
  feeMode,
  feeCap: parseFloat(feeCap),
  deadline: Math.floor(Date.now() / 1000) + 600,
  nonce: Date.now()
};
```

---

## 💥 DAMPAK KESALAHAN INI

### Backend Default ke Sepolia (chain 11155111)

**File:** `backend/server.py` line 147-148

```python
# Get chain IDs from intent (default to Sepolia if not provided)
src_chain_id = getattr(intent, 'srcChainId', 11155111)  # ❌ Default Sepolia!
dst_chain_id = getattr(intent, 'dstChainId', 11155111)
```

### Alur Kesalahan:

1. **Frontend kirim request TANPA `srcChainId`**
2. **Backend pakai default:** `src_chain_id = 11155111` (Sepolia)
3. **Backend query oracle:** `getPrice('WMATIC', 11155111)` 
4. **Sepolia TIDAK PUNYA token WMATIC!**
5. **Backend pakai fallback:** `$0.55` (hardcoded di `pyth_oracle_service.py` line 158)
6. **Frontend dapat quote:** 1 WMATIC = 0.547 USDC (berdasar $0.55)
7. **Frontend set minOut:** 0.547 × 0.95 = 0.520 USDC
8. **User execute swap:**
   - Backend TETAP query Sepolia → fallback $0.55
   - Smart contract di Amoy query oracle → $0.18 (benar!)
   - Adapter output: 0.171 USDC (1 WMATIC × $0.18 × 95%)
   - Check: **0.171 < 0.520** → **REVERT!** ❌

---

## 📊 POLA TRANSAKSI YANG TERLIHAT

### ✅ BERHASIL: USDC → WMATIC
**Tx:** 0x0fe62911d24791e10b281f44b27e459873e29da043b4dfac2b7d0d5843bf9469

**Kenapa berhasil?**
- USDC ada di **KEDUA** chain (Amoy DAN Sepolia)
- Backend query Sepolia untuk USDC → dapat $1.00 ✅
- Backend query Amoy untuk WMATIC → dapat $0.18 ✅
- Quote: 1 USDC = 5.527 WMATIC (benar: $1.00 / $0.18 = 5.56)
- minOut: 5.527 × 0.95 = 5.25 WMATIC
- Contract output: 5.43 WMATIC → **SUKSES!** ✅

### ✅ BERHASIL: USDC → USDC
**Tx:** 0x74ddf0226c4298c55be8ec300cf53b756004edab61501e1ff554f3f470a43e49

**Kenapa berhasil?**
- USDC ada di kedua chain
- Quote: 1 USDC = 0.995 USDC (benar)
- Contract output: 0.994 USDC → **SUKSES!** ✅

### ❌ GAGAL: WMATIC → USDC
**Tx:** 0x9200c3dac871b45ecf12578304826685c5aa701b595eaf57a2512cd5f92af191

**Kenapa gagal?**
- Backend query **Sepolia** untuk WMATIC → **TIDAK ADA** → fallback $0.55 ❌
- Quote: 1 WMATIC = 0.547 USDC (SALAH!)
- minOut: 0.547 × 0.95 = 0.520 USDC
- Contract query Amoy oracle → $0.18 ✅
- Contract output: 0.171 USDC
- Check: 0.171 < 0.520 → **REVERT!** ❌

### ❌ GAGAL: WMATIC → WMATIC  
**Error:** `insufficient funds for gas`

**Kenapa gagal?**
- Backend query Sepolia → fallback $0.55
- Quote: 1 WMATIC = 3.04 WMATIC (SALAH! Seharusnya ~0.95)
- Frontend set minOut: **2.888 WMATIC** (berdasar quote salah)
- Gas estimation GAGAL karena minOut terlalu tinggi
- Pakai default gas 500000
- **Deployer balance:** 0.0127 POL native
- **Gas cost:** 500000 × 29.87 Gwei = 0.0149 POL
- **Balance kurang!** → insufficient funds ❌

---

## 🔧 PERBAIKAN YANG SUDAH DITERAPKAN

### 1. Frontend: Tambah `srcChainId`
**File:** `frontend/src/pages/Swap.jsx` line 265  
**Status:** ✅ FIXED

### 2. Backend: Oracle fallback sudah benar
**File:** `backend/pyth_oracle_service.py` line 15  
**Status:** ✅ FIXED (sudah dari sebelumnya)

### 3. Startup script load .env
**File:** `start-zerotoll.sh`  
**Status:** ✅ FIXED (sudah dari sebelumnya)

---

## 🧪 TESTING SEKARANG

### Expected Behavior (Setelah Fix):

**WMATIC → USDC:**
1. Frontend kirim: `srcChainId: 80002, tokenIn: 'WMATIC'`
2. Backend query: `getPrice('WMATIC', 80002)` ✅
3. Oracle Amoy return: $0.18 ✅
4. Quote: 1 WMATIC = 0.171 USDC
5. minOut: 0.171 × 0.95 = 0.162 USDC
6. Contract output: 0.171 USDC
7. Check: 0.171 > 0.162 → **SUCCESS!** ✅

**WMATIC → WMATIC:**
1. Backend query Amoy untuk kedua token → $0.18 ✅
2. Quote: 1 WMATIC = 0.95 WMATIC (dengan slippage)
3. minOut: 0.95 × 0.95 = 0.902 WMATIC
4. Gas estimation: ~208k (bukan 500k)
5. Gas cost: ~0.006 POL (affordable!)
6. Contract output: 0.95 WMATIC
7. Check: 0.95 > 0.902 → **SUCCESS!** ✅

---

## ⚠️ CATATAN TENTANG NATIVE TOKEN

### MockDEXAdapter MASIH punya hardcode untuk address(0)

**File:** `packages/contracts/contracts/adapters/MockDEXAdapter.sol` lines 148, 153

```solidity
if (tokenIn == address(0)) {
    priceIn = 2000 * 1e8; // ❌ Hardcode!
}

if (tokenOut == address(0)) {
    priceOut = 2000 * 1e8; // ❌ Hardcode!
}
```

**TAPI ini TIDAK MASALAH untuk swap WMATIC/USDC karena:**
- WMATIC address: `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` (BUKAN address(0))
- Native POL address(0) jarang digunakan (frontend/backend sudah convert ke WPOL)

**Untuk swap NATIVE POL langsung:**
- TestnetPriceOracle **TIDAK SUPPORT** address(0) (ada check `require(token != address(0))`)
- Solusinya: **Selalu gunakan WPOL** instead of native POL
- Backend sudah handle ini dengan baik (convert POL → WPOL untuk query)

---

## 🎯 KESIMPULAN

### Root Cause:
**Frontend tidak kirim `srcChainId` → Backend default ke Sepolia → Query oracle Sepolia untuk WMATIC → Tidak ada → Fallback $0.55 → Price mismatch**

### Fix:
**Tambahkan `srcChainId: fromChain.id` di frontend intent**

### Status:
- ✅ Frontend FIXED & restarted
- ✅ Backend running dengan env benar
- ✅ Oracle address benar: 0xA4F18e08...
- ✅ Adapter balance cukup: 11.92 WMATIC

### Next Step:
**SILAKAN TEST ULANG SWAP WMATIC → USDC**

Expected result: **BERHASIL!** ✅

---

**Timestamp:** 2025-11-09 05:35:00 UTC  
**Fix Applied:** srcChainId added to frontend intent  
**Status:** READY FOR TESTING 🚀
