# 🔧 DEBUGGING REPORT - November 9, 2025

## 📊 MASALAH YANG DITEMUKAN

### **Sepolia (Partial Success)**

#### ✅ **Berhasil:**
1. WETH → USDC: **SUCCESS** ✅
   - TX: `0xa8437ea10c860c8c300e8bcb5f70174d2c669758c101fcc5f9dbce09cef91a0a`
   - 0.001 WETH → 3.248516 USDC

2. USDC → WETH: **SUCCESS** ✅  
   - TX: `0x309041bd59728e5519c355ff1b0fa8b6a4d54991255ee49006a5ae0c41f8a904`
   - 3 USDC → 0.000833 WETH

#### ❌ **Gagal:**
3. **ETH → USDC: FAILED** ❌
   - TX: `0xafff327c630b9f32ff1fb56b8059d9af14ed88fe962aaa370c2b727cb3ba47ed`
   - Error: `Adapter call failed`
   - **Root Cause:** Adapter hanya terima wrapped token (WETH), tidak bisa handle native ETH

4. **USDC → ETH: SUCCESS tapi SALAH OUTPUT** ⚠️
   - TX: `0x3e46cec2f06e12e8bb52a84012b0ec9b5c4a384c1f5e2d9d7368114936408828`
   - User minta **native ETH**, tapi terima **WETH**!
   - Backend log: `TODO: Unwrap WETH → native after swap`

### **Amoy (All Failed)**

#### ❌ **Semua Transaksi Gagal:**
1. WMATIC → USDC: **FAILED** ❌
   - TX: `0x003f864d87b810d2375fcd3a696ce0702dcae1c7701180a79b16826c4750fce1`

2. USDC → WMATIC: **FAILED** ❌ 
   - TX: `0xe993c57fb2d4d77fe31141b642c8c7085c0378fc1620d50f68b3a0a34ed54e54`

3. USDC → POL: **FAILED** ❌
   - TX: `0xe993c57fb2d4d77fe31141b642c8c7085c0378fc1620d50f68b3a0a34ed54e54`

4. POL → USDC: **FAILED** ❌
   - TX: `0xa7ecc893d6f0a1fab4ed7804774b4a203f7a5a700276235470b47751816b1c0d`

**Backend Log Pattern:**
```
Gas estimation failed: execution reverted: Adapter call failed
Failed to get Pyth price ... chain 80002: 0x14aebe68
Using FALLBACK price for POL: $0.55 (Pyth query failed!)
```

**Root Cause (Amoy):**
1. ❌ Adapter (`0x2Ed51...`) **tidak initialized dengan benar**
   - Oracle function revert
   - Router address salah (pointing ke dirinya sendiri)
   - getQuote() gagal total

2. ❌ Backend coba query **Pyth smart contract on-chain**
   - Error `0x14aebe68` = contract tidak ada/tidak configured
   - Fallback ke hardcode $0.55 (SALAH KONSEP!)

---

## ✅ SOLUSI YANG SUDAH DITERAPKAN

### **1. Pyth REST Oracle - LIVE Prices (Off-Chain)**

**Konsep (seperti saran GPT-5):**
- ✅ Backend fetch harga LIVE dari **Pyth Hermes API** (https://hermes.pyth.network)
- ✅ **TIDAK pakai Pyth smart contract on-chain** (tidak perlu deploy di testnet)
- ✅ Harga testnet token = **1:1 dengan harga mainnet** dari Pyth
- ✅ Cache dengan TTL 15 detik
- ✅ **Fail-closed:** Kalau Pyth API gagal dan cache stale → return `available: false`, TIDAK pakai hardcode

**File Baru:**
- `backend/pyth_rest_oracle.py` - Oracle baru dengan Pyth REST API

**Pyth Feed IDs (Mainnet):**
```python
"ETH": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
"POL": "0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472"
"USDC": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
```

**Test Results:**
```json
{
  "symbol": "ETH",
  "price": 3419.75270821,  // LIVE!
  "conf": 1.45873832,
  "publishTime": 1762687766,
  "stale": false,
  "available": true,
  "source": "pyth-rest"
}

{
  "symbol": "POL",
  "price": 0.17585004,  // BUKAN $0.55 fallback!
  "conf": 0.00020977,
  "available": true
}
```

**Backend Updated:**
- `server.py` sekarang pakai `pyth_rest_oracle` 
- Endpoint baru: `/api/oracle/health` untuk monitor oracle status

---

### **2. Fix Amoy Adapter - Deploy Baru dengan Oracle yang Benar**

**Problem Identified:**
- Adapter lama (`0x2Ed51...`) deployed tapi **tidak initialized**
- Oracle address = null (revert saat query)
- Router address = self (salah!)

**Solution:**

**A. Deploy SimpleMockOracle** ✅
- Address: `0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e`
- Updatable dari backend (owner can setPrices)
- Initial prices dari Pyth REST API

**B. Deploy MockDEXAdapter Baru** ✅
- Address: `0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1`
- Oracle: `0xA5965...` (SimpleMockOracle)
- Supported tokens: WMATIC, USDC, LINK
- **Quote test: WORKING!** (1 WMATIC → 0.175339 USDC)

**C. Whitelist di RouterHub** ✅
- TX: `0x45fecf4808a4b1085b8f47845ccf5d91775b15df7ca7790a744acac800720bf6`
- Verified: `whitelistedAdapter(0xc8A7...) = true`

**D. Backend Config Updated** ✅
```bash
AMOY_MOCKDEX_ADAPTER=0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1
AMOY_SIMPLE_ORACLE=0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e
```

**E. Price Updater Script** ✅
- File: `backend/update_amoy_prices.py`
- Fetch dari Pyth REST API → Update SimpleMockOracle on-chain
- Usage: `python3 update_amoy_prices.py --interval 30`

---

## 🔧 CARA UPDATE HARGA ORACLE (Amoy)

### **Manual Update:**
```javascript
const oracle = await ethers.getContractAt(
  "SimpleMockOracle", 
  "0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e"
);

// Batch update
await oracle.setPrices(
  [
    "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",  // WMATIC
    "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",  // USDC
  ],
  [
    "17585004",   // $0.176 (8 decimals)
    "99990071",   // $1.00
  ]
);
```

### **Automated Update (Backend):**
```bash
# Run once
python3 backend/update_amoy_prices.py --once

# Run continuously (update every 30s)
python3 backend/update_amoy_prices.py --interval 30
```

**Script akan:**
1. Fetch harga LIVE dari Pyth REST API
2. Convert ke format 8 decimals
3. Update SimpleMockOracle on-chain
4. Verify update berhasil

---

## ⚠️ MASALAH YANG BELUM FIXED

### **1. Native Token Handling (Sepolia & Amoy)**

**Problem:**
- ETH → USDC: **GAGAL** (adapter tidak terima native ETH)
- USDC → ETH: **SALAH OUTPUT** (user dapat WETH bukan ETH)

**Solution Needed:**
1. **RouterHub wrap/unwrap logic:**
   ```solidity
   // Input: Native ETH
   if (tokenIn == 0xEeee...) {
       IWETH(WETH).deposit{value: msg.value}();
       tokenIn = WETH;  // Lanjut dengan wrapped
   }
   
   // Output: Native ETH
   if (wantNativeOut && tokenOut == WETH) {
       IWETH(WETH).withdraw(amountOut);
       payable(user).transfer(amountOut);
   } else {
       IERC20(tokenOut).transfer(user, amountOut);
   }
   ```

2. **Backend normalization:**
   ```python
   # server.py /api/execute
   if intent.tokenOut == "ETH":
       intent.wantNativeOut = True
       intent.tokenOut = "WETH"  # Swap ke wrapped dulu
   ```

**Files to Modify:**
- `packages/contracts/contracts/RouterHub.sol`
- `backend/server.py` (execute endpoint)

---

### **2. Approval Flow - Double Pop-up**

**Problem:**
- USDC → WETH/ETH: **2 pop-up** (remove permission + spending cap)
- Approval diminta **berulang** untuk nilai sama
- WETH → USDC: Approval **hanya sekali** (expected)

**Root Cause (Suspected):**
1. **Spender mismatch:** Frontend approve ke RouterHub, tapi adapter menarik langsung?
2. **Allowance check salah unit:** Frontend compare float vs wei

**Solution (GPT-5 recommendation):**
1. **Single spender pattern:** RouterHub sebagai SATU-SATUNYA spender
   ```solidity
   // User approve ke RouterHub
   // RouterHub transferFrom user → RouterHub
   // RouterHub transfer ke adapter (TIDAK transferFrom dari user!)
   ```

2. **Permit2 integration:** Gasless signature approval (next phase)

3. **Frontend allowance check fix:**
   ```javascript
   // SALAH
   if (allowance < amountIn) { approve() }
   
   // BENAR
   const allowanceWei = await token.allowance(user, ROUTER_HUB);
   const amountWei = parseUnits(amountIn, decimals);
   if (allowanceWei < amountWei) { approve() }
   ```

---

### **3. Amoy Adapter Funding**

**Problem:**
Adapter baru (`0xc8A7...`) **tidak punya balance** WMATIC/USDC untuk transfer ke user.

**MockDEXAdapter code:**
```solidity
// Line 115
IERC20(tokenOut).safeTransfer(recipient, amountOut);
// ☝️ Butuh balance tokenOut di adapter!
```

**Solution:**
1. **Get test tokens:**
   - Polygon Faucet: https://faucet.polygon.technology
   - Wrap POL → WMATIC via WMATIC contract

2. **Fund adapter:**
   ```bash
   npx hardhat run scripts/fund-adapter-amoy.js --network amoy
   ```
   
   Or manual:
   ```javascript
   await wmatic.transfer(
     "0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1",
     ethers.parseEther("100")  // 100 WMATIC
   );
   
   await usdc.transfer(
     "0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1",
     ethers.parseUnits("1000", 6)  // 1000 USDC
   );
   ```

---

## 📋 DEPLOYMENT ADDRESSES (UPDATED)

### **Sepolia (11155111)**
```
RouterHub: 0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd
MockDEXAdapter: 0x86D1AA2228F3ce649d415F19fC71134264D0E84B
MultiTokenPythOracle: 0x1240c97bc33f7635b8e25C721fF6D05d2bfC44Db
```

### **Amoy (80002)** ⚠️ UPDATED
```
RouterHub: 0x5335f887E69F4B920bb037062382B9C17aA52ec6
MockDEXAdapter: 0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1  ⬅️ BARU!
SimpleMockOracle: 0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e  ⬅️ BARU!

OLD (Deprecated):
MockDEXAdapter (OLD): 0x2Ed51974196EC8787a74c00C5847F03664d66Dc5  ❌
```

---

## 🧪 TESTING CHECKLIST

### **Backend Oracle Health:**
```bash
curl http://localhost:8000/api/oracle/health | jq
```

Expected:
```json
{
  "success": true,
  "oracle": "pyth-rest",
  "status": "healthy",
  "total_feeds": 16,
  "cached_feeds": 3,
  "fresh_feeds": 3
}
```

### **Amoy Oracle Price Check:**
```javascript
const oracle = await ethers.getContractAt(
  "SimpleMockOracle",
  "0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e"
);

const price = await oracle.getPrice("0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9");
console.log("WMATIC price (8 dec):", price.toString());
console.log("WMATIC price (USD):", parseFloat(price.toString()) / 1e8);
```

### **Amoy Adapter Quote:**
```javascript
const adapter = await ethers.getContractAt(
  "MockDEXAdapter",
  "0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1"
);

const [quote] = await adapter.getQuote(
  "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",  // WMATIC
  "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",  // USDC
  ethers.parseEther("1")
);

console.log("Quote:", ethers.formatUnits(quote, 6), "USDC");
```

### **Sepolia Native ETH Swap (EXPECTED TO FAIL):**
```javascript
// Frontend
tokenIn: "ETH"  // Native
tokenOut: "USDC"
amountIn: 0.001

// Expected: REVERT with "Adapter call failed"
// Fix needed: RouterHub wrap logic
```

### **Amoy Swap (After Funding):**
```javascript
// 1. Fund adapter dengan WMATIC dan USDC
// 2. Update oracle prices (python3 update_amoy_prices.py --once)
// 3. Test swap WMATIC → USDC via frontend
// 4. Check user balance (should receive USDC)
```

---

## 📚 FILES CREATED/MODIFIED

### **New Files:**
```
backend/pyth_rest_oracle.py          - Pyth REST API oracle
backend/update_amoy_prices.py        - Price updater script
packages/contracts/contracts/oracles/SimpleMockOracle.sol
packages/contracts/scripts/deploy-simple-oracle-amoy.js
packages/contracts/scripts/deploy-new-adapter-amoy.js
packages/contracts/scripts/whitelist-adapter-amoy.js
packages/contracts/scripts/fund-adapter-amoy.js
packages/contracts/scripts/debug-amoy-adapter.js
```

### **Modified Files:**
```
backend/server.py                     - Use pyth_rest_oracle instead of pyth_oracle_service
backend/.env                          - Updated AMOY_MOCKDEX_ADAPTER address
```

---

## 🎯 NEXT STEPS (Priority Order)

### **1. HIGH PRIORITY - Native Token Support**
- [ ] Implement wrap/unwrap logic di RouterHub
- [ ] Update backend untuk normalize native → wrapped
- [ ] Test ETH → USDC dan USDC → ETH di Sepolia
- [ ] Test POL → USDC dan USDC → POL di Amoy

**Impact:** Fix 2 dari 4 failed transactions

### **2. HIGH PRIORITY - Fund Amoy Adapter**
- [ ] Get test tokens dari faucet
- [ ] Fund adapter dengan WMATIC dan USDC
- [ ] Test actual swap execution di Amoy
- [ ] Verify user receives correct token

**Impact:** Enable Amoy testing

### **3. MEDIUM PRIORITY - Approval Flow Fix**
- [ ] Debug mengapa USDC approval muncul 2× pop-up
- [ ] Check spender address consistency
- [ ] Fix allowance check di frontend (wei vs float)
- [ ] Implement Permit2 (optional, future)

**Impact:** Better UX (less clicks)

### **4. LOW PRIORITY - Automation**
- [ ] Setup cron job untuk `update_amoy_prices.py`
- [ ] Monitor oracle health
- [ ] Alert jika prices stale

**Impact:** Maintenance

---

## 🔍 ROOT CAUSE SUMMARY

| Masalah | Root Cause | Fix Applied | Status |
|---------|-----------|-------------|--------|
| **Pyth query failed (Amoy)** | Backend query Pyth contract on-chain (tidak ada di Amoy) | Ganti dengan Pyth REST API (off-chain) | ✅ FIXED |
| **Adapter call failed (Amoy)** | Adapter tidak initialized, oracle=null | Deploy adapter baru dengan SimpleMockOracle | ✅ FIXED |
| **ETH → USDC failed (Sepolia)** | Adapter tidak handle native ETH | Perlu wrap logic di RouterHub | ⏳ PENDING |
| **USDC → ETH wrong output (Sepolia)** | Tidak ada unwrap logic setelah swap ke WETH | Perlu unwrap logic di RouterHub | ⏳ PENDING |
| **USDC approval loop** | Spender mismatch atau allowance check salah | Perlu debug frontend + contract | ⏳ PENDING |

---

## 💡 KEY INSIGHTS (dari GPT-5 & Debugging)

### **1. Oracle Strategy (BENAR):**
✅ **Pyth REST API** untuk testnet (off-chain, LIVE prices)
❌ **BUKAN** deploy Pyth contract on-chain di testnet

**Alasan:**
- Pyth contract tidak di-deploy di semua testnet
- REST API lebih fleksibel untuk testing
- Harga tetap LIVE dan real-time
- Backend control penuh atas price updates

### **2. MockDEXAdapter Design:**
⚠️ **Adapter perlu oracle untuk getQuote()** (immutable, diset di constructor)
⚠️ **Adapter perlu balance tokenOut** untuk transfer ke user

**Implications:**
- Kalau oracle rusak → harus deploy adapter baru
- Adapter harus di-fund dengan liquidity (testnet demo)

### **3. Native Token Flow:**
Backend normalize native → wrapped **SEBELUM** kirim ke adapter:
```
User intent: ETH → USDC
↓
Backend: Convert ETH → WETH
↓
Adapter: Swap WETH → USDC
↓
Output: USDC (no unwrap needed)

User intent: USDC → ETH
↓
Backend: Flag wantNativeOut=true, convert ETH → WETH
↓
Adapter: Swap USDC → WETH
↓
RouterHub: Unwrap WETH → ETH
↓
Output: Native ETH ✅
```

---

## 🚀 QUICK START (Test Now)

### **1. Backend Oracle Test:**
```bash
cd /home/abeachmad/ZeroToll/backend
source venv/bin/activate
python3 -c "
from pyth_rest_oracle import pyth_oracle
print(pyth_oracle.get_price('POL', 80002))
print(pyth_oracle.get_price('ETH', 11155111))
"
```

### **2. Update Amoy Prices (Manual):**
```bash
# Butuh PRIVATE_KEY di .env
python3 update_amoy_prices.py --once
```

### **3. Test Sepolia (Working Pairs):**
- ✅ WETH → USDC (WORKS!)
- ✅ USDC → WETH (WORKS!)
- ❌ ETH → USDC (FAILS - need wrap)
- ⚠️ USDC → ETH (WORKS but outputs WETH - need unwrap)

### **4. Test Amoy (After Funding):**
1. Get test tokens from faucet
2. Fund adapter: `npx hardhat run scripts/fund-adapter-amoy.js --network amoy`
3. Update prices: `python3 backend/update_amoy_prices.py --once`
4. Test swap via frontend

---

## ✅ SUCCESS METRICS

**Completed:**
- ✅ Pyth REST Oracle implemented (LIVE prices, no hardcode)
- ✅ Backend updated to use new oracle
- ✅ Amoy adapter deployed dan whitelisted
- ✅ Oracle health monitoring endpoint
- ✅ Price updater script created

**Remaining:**
- ⏳ Native token wrap/unwrap logic
- ⏳ Amoy adapter funding
- ⏳ Approval flow optimization
- ⏳ End-to-end testing all pairs

---

**Authored by:** GitHub Copilot  
**Date:** November 9, 2025  
**Session Duration:** ~2 hours  
**Lines of Code:** ~1,500 lines (new + modified)  
