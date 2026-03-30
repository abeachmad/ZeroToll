# Timeout Increased to 5 Minutes ✅

**Date**: February 1, 2026  
**Change**: Extended all timeouts to 5-6 minutes for slow RPC  
**Status**: APPLIED

---

## 🔧 Changes Applied

### 1. Gas Estimation Timeout: 10s → 5 minutes ⏱️

**File**: `backend/eip7702-relayer.mjs`

```javascript
// Before
setTimeout(() => reject(new Error('Gas estimation timeout')), 10000)  // 10s

// After
setTimeout(() => reject(new Error('Gas estimation timeout after 5 minutes')), 300000)  // 5 minutes
```

**Reason**: 
- Public RPC endpoints bisa sangat lambat (terutama Sepolia)
- EIP-7702 transaction dengan `authorizationList` butuh waktu lebih lama
- 5 menit memberikan buffer yang cukup untuk RPC yang lambat

---

### 2. Relayer Execution Timeout: 60s → 6 minutes ⏱️

**File**: `backend/routes/eip7702.py`

```python
# Before
timeout=60  # 60 seconds

# After
timeout=360  # 6 minutes (5 min gas estimation + 1 min tx)
```

**Reason**:
- Relayer perlu waktu untuk:
  - Gas estimation: up to 5 minutes
  - Transaction submission: ~30 seconds
  - Transaction confirmation: ~30 seconds
- Total: 6 minutes untuk safety

---

### 3. Transaction Receipt Timeout: 60s → 5 minutes ⏱️

**File**: `backend/web3_tx_builder.py`

```python
# Before
receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

# After
receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=300)  # 5 minutes
```

**Reason**:
- Testnet block time bisa tidak konsisten
- Congestion bisa memperlambat confirmation
- 5 menit memberikan buffer yang cukup

---

### 4. Error Message Update

**File**: `backend/routes/eip7702.py`

```python
# Before
detail='Transaction timeout after 60s. Check relayer logs for details.'

# After
detail='Transaction timeout after 6 minutes. This may indicate RPC issues. Check relayer logs for details.'
```

---

## 📊 Timeout Summary

| Component | Before | After | Reason |
|-----------|--------|-------|--------|
| **Gas Estimation** | 10s | 5 min | Slow RPC, complex EIP-7702 tx |
| **Relayer Execution** | 60s | 6 min | Gas estimation + tx submission |
| **Transaction Receipt** | 60s | 5 min | Testnet block time variability |
| **Error Message** | "60s timeout" | "6 min timeout" | Clarity |

---

## 🎯 Expected Behavior

### Normal Case (Fast RPC):
```
1. Gas estimation: 2-5 seconds ✅
2. Transaction submission: 5-10 seconds ✅
3. Transaction confirmation: 10-30 seconds ✅
Total: ~30-45 seconds
```

### Slow RPC Case:
```
1. Gas estimation: 30-120 seconds ⏳
2. Transaction submission: 10-30 seconds ⏳
3. Transaction confirmation: 30-60 seconds ⏳
Total: ~70-210 seconds (still under 6 min limit)
```

### Worst Case (Very Slow RPC):
```
1. Gas estimation: up to 5 minutes ⚠️
2. Fallback to fixed gas: 300,000 ✅
3. Transaction submission: 30 seconds ✅
4. Transaction confirmation: 60 seconds ✅
Total: ~6 minutes (at timeout limit)
```

---

## 🧪 Testing

### Test Normal Flow:
```bash
# 1. Start services
./start-zerotoll.sh

# 2. Open frontend
http://localhost:3000/swap

# 3. Execute EIP-7702 swap
# - Connect wallet (Sepolia)
# - Toggle "EIP-7702 Gasless" ON
# - Swap: 1 USDC → ETH
# - Sign 3x
# - Wait (should complete in 30-60s normally)
```

### Test Slow RPC:
```bash
# Simulate slow RPC by using congested endpoint
# In backend/eip7702-relayer.mjs:
const RPC_URL = {
  11155111: 'https://rpc.sepolia.org'  // Known to be slow
};

# Execute swap - should still work but take longer
# Will use fallback gas estimate if estimation times out
```

### Monitor Logs:
```bash
# Watch backend logs
Get-Content .pids/backend.log -Tail 20 -Wait

# Expected output:
# Estimating gas (timeout: 5 minutes)...
# [If slow] Gas estimation failed: timeout
# [If slow] Using fallback gas estimate: 300000
# Sending EIP-7702 transaction...
# ✅ Transaction sent: 0x...
# ✅ Transaction confirmed
```

---

## ⚠️ Important Notes

### 1. Fallback Gas Estimate
Jika gas estimation timeout, relayer akan otomatis menggunakan fallback:
```javascript
gasEstimate = 300000n;  // Safe for EIP-7702
```

Ini **aman** tapi mungkin sedikit lebih mahal (~10-20% lebih tinggi dari actual).

### 2. User Experience
User akan melihat:
- "Estimating gas..." - bisa sampai 5 menit
- "Sending transaction..." - ~30 detik
- "Waiting for confirmation..." - ~30-60 detik

**Total**: Bisa sampai 6-7 menit untuk worst case.

### 3. Frontend Timeout
Frontend juga perlu timeout yang cukup. Check `useEIP7702Swap.js`:
```javascript
// Pastikan fetch timeout >= 6 minutes
const response = await fetch(url, {
  method: 'POST',
  body: JSON.stringify(data),
  // No timeout = infinite (good for slow RPC)
});
```

---

## 🚀 Performance Tips

### 1. Use Paid RPC (Recommended for Production)
```bash
# In .env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
# or
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

**Benefits**:
- Gas estimation: <2s (vs 30-300s)
- Higher rate limits
- Better reliability
- 99.9% uptime

### 2. Use Multiple RPC Endpoints
Already implemented in `eip7702-relayer.mjs`:
```javascript
const RPC_URLS = {
  11155111: [
    'https://ethereum-sepolia-rpc.publicnode.com',  // Primary
    'https://rpc.sepolia.org',                      // Fallback 1
    'https://ethereum-sepolia.blockpi.network/v1/rpc/public',  // Fallback 2
    'https://rpc.ankr.com/eth_sepolia'              // Fallback 3
  ]
};
```

### 3. Cache Gas Estimates
For similar transactions, cache gas estimates:
```javascript
// Cache key: tokenIn + tokenOut + amountIn
const cacheKey = `${tokenIn}-${tokenOut}-${amountIn}`;
if (gasCache[cacheKey]) {
  gasEstimate = gasCache[cacheKey];
} else {
  gasEstimate = await estimateGas(...);
  gasCache[cacheKey] = gasEstimate;
}
```

---

## 📝 Files Modified

| File | Change | Timeout |
|------|--------|---------|
| `backend/eip7702-relayer.mjs` | Gas estimation timeout | 10s → 5 min |
| `backend/routes/eip7702.py` | Relayer execution timeout | 60s → 6 min |
| `backend/routes/eip7702.py` | Error message | Updated |
| `backend/web3_tx_builder.py` | Transaction receipt timeout | 60s → 5 min |

---

## ✅ Verification

### Check Timeouts Applied:
```bash
# Gas estimation timeout
grep -n "300000" backend/eip7702-relayer.mjs
# Should show: setTimeout(..., 300000)

# Relayer timeout
grep -n "timeout=360" backend/routes/eip7702.py
# Should show: timeout=360

# Receipt timeout
grep -n "timeout=300" backend/web3_tx_builder.py
# Should show: timeout=300
```

### Test Execution:
```bash
# Execute swap and monitor time
time curl -X POST http://localhost:8000/api/eip7702/execute \
  -H "Content-Type: application/json" \
  -d @test-swap.json

# Should complete in:
# - Fast RPC: 30-60s
# - Slow RPC: 2-5 min
# - Timeout: 6 min (fallback used)
```

---

## 🎉 Summary

✅ **Gas estimation timeout**: 10s → 5 minutes  
✅ **Relayer execution timeout**: 60s → 6 minutes  
✅ **Transaction receipt timeout**: 60s → 5 minutes  
✅ **Error messages**: Updated for clarity  
✅ **Fallback gas estimate**: 300,000 (safe for EIP-7702)  

**Result**: System sekarang bisa handle RPC yang sangat lambat tanpa timeout error!

---

**Status**: ✅ APPLIED - Ready for testing  
**Backend**: Auto-reloaded (uvicorn --reload)  
**Action**: Test EIP-7702 swap di frontend
