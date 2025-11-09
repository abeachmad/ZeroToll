# INSTRUKSI TESTING SETELAH FIX

## ✅ PERBAIKAN SUDAH DITERAPKAN

### File yang diperbaiki:
**frontend/src/pages/Swap.jsx** line 267
```javascript
srcChainId: fromChain.id,  // ✅ Ditambahkan!
```

### Status sistem:
- ✅ Frontend recompiled: `webpack compiled successfully`
- ✅ Backend running: PID 1479
- ✅ Oracle address benar: 0xA4F18e08...
- ✅ Adapter balance: 11.92 WMATIC, 7.00 USDC

---

## 🔄 CARA TESTING

### 1. HARD RELOAD Browser (WAJIB!)

**Chrome/Edge:**
- Tekan `Ctrl + Shift + R` (Linux/Windows)
- Atau `Ctrl + F5`

**Firefox:**
- Tekan `Ctrl + Shift + R`
- Atau `Ctrl + F5`

**Alternatif:**
1. Buka Developer Tools (`F12`)
2. Klik kanan tombol refresh
3. Pilih "Empty Cache and Hard Reload"

### 2. Test Quote WMATIC → USDC

1. Pilih: From = Polygon Amoy, To = Polygon Amoy
2. Token In = WMATIC
3. Token Out = USDC
4. Amount = 1
5. **Klik "Get Quote"**

**Expected Result:**
```
Quote muncul: ~0.17 USDC (BUKAN 0.547!)
```

### 3. Cek Backend Log

Buka terminal dan jalankan:
```bash
tail -f /tmp/zerotoll_backend.log | grep -E "Pyth price|FALLBACK|chain"
```

**Expected:**
```
💰 Pyth price: WMATIC = $0.18 (chain 80002)  ✅
💰 Pyth price: USDC = $1.00 (chain 80002)    ✅
```

**TIDAK BOLEH ADA:**
```
⚠️ Using FALLBACK price for WMATIC: $0.55  ❌
Token WMATIC not found on chain 11155111    ❌
```

### 4. Execute Swap

Jika quote sudah benar (0.17 USDC), klik "Execute Swap"

**Expected:**
- Gas estimation: ~208k (bukan 500k)
- Transaction: SUCCESS ✅
- Output: ~0.171 USDC

---

## 🔍 VERIFIKASI DENGAN CURL

Test backend langsung (bypass browser cache):

```bash
curl -X POST http://localhost:8000/api/quote \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "user": "0x5a87A3c738cf99DB95787D51B627217B6dE12F62",
      "tokenIn": "WMATIC",
      "amtIn": 1,
      "tokenOut": "USDC",
      "srcChainId": 80002,
      "dstChainId": 80002,
      "feeMode": "INPUT",
      "feeCap": 1,
      "deadline": 1762999999,
      "nonce": 123456
    }
  }' | python3 -m json.tool
```

**Expected Response:**
```json
{
  "success": true,
  "netOut": 0.1791,  // ~0.17-0.18 USDC ✅
  "grossOut": 0.1881,
  "fee": 0.009,
  "priceIn": 0.18,   // WMATIC price ✅
  "priceOut": 1.0    // USDC price ✅
}
```

Jika masih dapat `netOut: 0.547`, berarti backend belum restart atau ada cache.

---

## 📊 LOG ANALYSIS DARI TRANSAKSI SEBELUMNYA

### ❌ Quote yang GAGAL (12:50:16):
```
Token WMATIC not found on chain 11155111  ← Backend query Sepolia!
Using FALLBACK price for WMATIC: $0.55    ← Price salah!
```

**Root Cause:** Frontend TIDAK kirim `srcChainId` di quote request

### ✅ Execute yang SUDAH BENAR (12:51:01):
```
'srcChainId': 80002, 'dstChainId': 80002  ← Execute SUDAH kirim!
```

Tapi execute pakai quote yang salah (0.5198875 USDC minOut), jadi tetap gagal.

---

## 🎯 KESIMPULAN

**Masalah:** Browser masih pakai JavaScript bundle LAMA (sebelum srcChainId ditambahkan)

**Solusi:** Hard reload browser dengan `Ctrl + Shift + R`

**Setelah reload:** Quote akan query chain 80002 → dapat $0.18 → quote benar → execute berhasil!

---

**Timestamp:** 2025-11-09 05:45:00 UTC  
**Action Required:** HARD RELOAD BROWSER 🔄
