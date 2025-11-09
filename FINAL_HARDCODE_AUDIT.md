# 🔍 FINAL COMPREHENSIVE HARDCODE AUDIT
## Complete Analysis of ALL Hardcoded Values

**Date:** November 8, 2025  
**Status:** 🚨 CRITICAL HARDCODED VALUES CONFIRMED

---

## 📊 EXECUTIVE SUMMARY

After exhaustive search across all files, here are **ALL hardcoded price values** found:

### ❌ CRITICAL (Active in Production):
1. **Backend Fallback Prices** - Used for Amoy (no Pyth oracle deployed)
2. **Amoy Adapter Oracle** - Points to `0x0000...0001` (returns $1 for all tokens)
3. **Sepolia OLD Adapter** - Was using `0x0000...0001` (NOW FIXED ✅)

### ⚠️ MEDIUM (Test/Analysis Scripts):
4. **Test Scripts** - Hardcoded prices for analysis (not affecting production)
5. **OLD Service File** - `pyth_price_service_old.py` (not used)

---

## 🔍 DETAILED INVENTORY

### 1. ❌ BACKEND: pyth_oracle_service.py (ACTIVE)

**File:** `backend/pyth_oracle_service.py`  
**Lines:** 147-168  
**Status:** 🚨 ACTIVELY USED FOR AMOY

```python
def _get_fallback_price(self, token_symbol: str) -> float:
    """
    Fallback prices - ONLY used if Pyth oracle query fails
    These are APPROXIMATE and should trigger alerts in production
    """
    fallback_prices = {
        'ETH': 3450.0,      # ❌ HARDCODED - Last updated: Unknown
        'WETH': 3450.0,     # ❌ HARDCODED
        'POL': 0.55,        # ❌ HARDCODED - Amoy using this!
        'WPOL': 0.55,       # ❌ HARDCODED
        'WMATIC': 0.55,     # ❌ HARDCODED - Amoy using this!
        'USDC': 1.0,        # ❌ HARDCODED - Reasonable for stablecoin
        'USDT': 1.0,        # ❌ HARDCODED - Reasonable for stablecoin
        'DAI': 1.0,         # ❌ HARDCODED - Reasonable for stablecoin
        'LINK': 18.0,       # ❌ HARDCODED
        'ARB': 0.85,        # ❌ HARDCODED
        'OP': 2.15,         # ❌ HARDCODED
    }
    
    price = fallback_prices.get(token_symbol, 1.0)  # ❌ Default $1
    logger.warning(f"⚠️  Using FALLBACK price for {token_symbol}: ${price}")
    return price
```

**Impact:**
- ✅ **Sepolia**: Not used (Pyth oracle deployed)
- ❌ **Amoy**: ACTIVELY USED (no Pyth oracle)
  ```
  Log: "WARNING - No oracle for chain 80002, using fallback"
  Log: "WARNING - ⚠️ Using FALLBACK price for WMATIC: $0.55"
  ```

**Risk Level:** 🔴 **CRITICAL**
- Prices become stale (WMATIC may not be $0.55 forever)
- No alert when fallback is used in production
- Default $1 for unknown tokens is dangerous

**Fix Required:**
```python
# Option 1: Use external API
import requests

def _get_fallback_price(self, token_symbol: str) -> float:
    # Map symbols to CoinGecko IDs
    coingecko_ids = {
        'ETH': 'ethereum',
        'WETH': 'weth',
        'POL': 'matic-network',
        'WMATIC': 'wmatic',
        'USDC': 'usd-coin',
        'LINK': 'chainlink',
        # ...
    }
    
    token_id = coingecko_ids.get(token_symbol)
    if not token_id:
        logger.critical(f"🚨 UNKNOWN TOKEN: {token_symbol}")
        raise ValueError(f"No price source for {token_symbol}")
    
    try:
        url = f'https://api.coingecko.com/api/v3/simple/price'
        params = {'ids': token_id, 'vs_currencies': 'usd'}
        response = requests.get(url, params=params, timeout=5)
        price = response.json()[token_id]['usd']
        logger.warning(f"⚠️ Using CoinGecko fallback for {token_symbol}: ${price}")
        return price
    except Exception as e:
        logger.critical(f"🚨 FALLBACK FAILED for {token_symbol}: {e}")
        raise Exception(f"Cannot get price for {token_symbol}")

# Option 2: Fail loudly
def _get_fallback_price(self, token_symbol: str) -> float:
    logger.critical(f"🚨 PYTH ORACLE FAILED! No fallback allowed in production!")
    raise Exception(f"Oracle failure for {token_symbol} - manual intervention required")
```

---

### 2. ❌ AMOY ADAPTER: Using Mock Oracle (ACTIVE)

**Contract:** Deployed at `0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`  
**Oracle:** `0x0000000000000000000000000000000000000001`  
**Status:** 🚨 ACTIVE IN PRODUCTION

**Verification:**
```bash
$ cast call 0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7 \
  "priceOracle()" --rpc-url amoy

0x0000000000000000000000000000000000000001
```

**Behavior:**
- Address `0x0000...0001` is a **special mock oracle**
- Returns **$1.00 (1e8)** for ALL tokens
- WMATIC = $1, USDC = $1, ETH = $1 (all equal)

**Impact:**
```
Backend calculates: 1 USDC ÷ $0.55 = 1.818 WMATIC
Adapter calculates:  1 USDC ÷ $1.00 = 1.000 WMATIC (with decimals)
Quote (0.997) < MinOut (1.718) → TRANSACTION FAILS ❌
```

**Fix Required:**
1. Deploy Pyth oracle to Amoy
2. Deploy new adapter pointing to Pyth oracle
3. Update `frontend/src/config/contracts.json`:
   ```json
   "adapters": {
     "mockDex": "<NEW_PYTH_ADAPTER_ADDRESS>"
   }
   ```

---

### 3. ✅ SEPOLIA ADAPTER: Fixed (Was Using Mock)

**OLD Adapter:** `0x2Ed51974196EC8787a74c00C5847F03664d66Dc5` ❌  
**NEW Adapter:** `0x86D1AA2228F3ce649d415F19fC71134264D0E84B` ✅

**Status:** FIXED on November 8, 2025

**Before:**
```json
// frontend/src/config/contracts.json
"adapters": {
  "mockDex": "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"  // Mock oracle
}
```

**After:**
```json
"adapters": {
  "mockDex": "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"  // Pyth oracle ✅
}
```

**Verification:**
```bash
$ cast call 0x86D1AA2228F3ce649d415F19fC71134264D0E84B \
  "priceOracle()" --rpc-url sepolia

0x729fBc26977F8df79B45c1c5789A483640E89b4A  ← Real Pyth oracle!
```

---

### 4. ⚠️ TEST SCRIPTS: Hardcoded Prices (Low Risk)

**File:** `backend/analyze_failed_txs.py`  
**Status:** Test/analysis script only (not affecting production)

```python
# Lines 16-76: Historical price data for analysis
txs = [
    {
        "chain": "sepolia",
        "eth_price": 3445.77,  # From Pyth log (historical)
        "usdc_price": 1.0,
        # ...
    },
    {
        "chain": "amoy",
        "wmatic_price": 0.55,  # Fallback (historical)
        # ...
    }
]
```

**Impact:** None (test script using historical data)

**Recommendation:** Add comment explaining these are historical snapshots

---

### 5. ⚠️ OLD SERVICE FILE (Not Used)

**File:** `backend/pyth_price_service_old.py`  
**Status:** Backup file, not imported or used

```python
# Lines 104-110: OLD hardcoded prices
fallback_prices = {
    'ETH': 3709.35,     # OLD value
    'WETH': 3709.35,
    'POL': 0.179665,    # OLD value
    'WPOL': 0.179665,
    'LINK': 23.45,
    'ARB': 0.85,
    'OP': 2.15
}
```

**Impact:** None (file not used)

**Recommendation:** Delete file or clearly mark as `.backup`

---

## 📋 COMPLETE HARDCODE LOCATIONS

### Python Files:
| File | Lines | Type | Status | Impact |
|------|-------|------|--------|--------|
| `pyth_oracle_service.py` | 152-168 | Fallback prices | ❌ ACTIVE | CRITICAL |
| `pyth_price_service_old.py` | 104-110 | OLD fallback | ⚠️ UNUSED | None |
| `analyze_failed_txs.py` | 16-76 | Test data | ⚠️ TEST | None |
| `test_quote_pyth.py` | 66-75 | Price range check | ⚠️ TEST | None |

### Smart Contracts:
| Contract | Address | Oracle | Status | Impact |
|----------|---------|--------|--------|--------|
| Amoy Adapter | `0x7cafe...` | `0x0000...0001` | ❌ ACTIVE | CRITICAL |
| Sepolia OLD | `0x2Ed51...` | `0x0000...0001` | ✅ REPLACED | None |
| Sepolia NEW | `0x86D1A...` | `0x729fB...` (Pyth) | ✅ ACTIVE | None |

### Config Files:
| File | Field | Value | Status | Impact |
|------|-------|-------|--------|--------|
| `contracts.json` (Amoy) | `adapters.mockDex` | `0x7cafe...` | ❌ OLD | CRITICAL |
| `contracts.json` (Sepolia) | `adapters.mockDex` | `0x86D1A...` | ✅ FIXED | None |

---

## 🎯 ACTION PLAN

### Priority 1: Fix Amoy Adapter (CRITICAL - Do Now!)

**Steps:**
1. Deploy Pyth oracle to Amoy
2. Deploy new adapter with Pyth oracle
3. Update frontend config
4. Test swaps

**Estimated Time:** 30-60 minutes

**Commands:**
```bash
# 1. Deploy Pyth oracle
cd packages/contracts
npx hardhat run scripts/deploy-pyth-oracle-amoy.js --network amoy

# 2. Deploy adapter
npx hardhat run scripts/deploy-mockdex-amoy-pyth.js --network amoy

# 3. Whitelist adapter
npx hardhat run scripts/whitelist-adapter-amoy.js --network amoy

# 4. Fund adapter
npx hardhat run scripts/fund-adapter-amoy.js --network amoy

# 5. Update frontend/src/config/contracts.json
# Change adapters.mockDex to new address

# 6. Rebuild frontend
cd ../../frontend
npm run build
```

---

### Priority 2: Replace Backend Fallback (HIGH - This Week)

**Option A: External API (Recommended)**
```python
def _get_fallback_price(self, token_symbol: str) -> float:
    # Fetch from CoinGecko/CoinMarketCap
    return self._fetch_from_api(token_symbol)
```

**Option B: Fail Loudly (Production-Safe)**
```python
def _get_fallback_price(self, token_symbol: str) -> float:
    logger.critical(f"🚨 Oracle failure! Manual intervention required!")
    raise Exception("No price available")
```

**Estimated Time:** 2-4 hours

---

### Priority 3: Cleanup (LOW - Future)

**Tasks:**
1. Delete `pyth_price_service_old.py`
2. Add comments to test scripts explaining historical data
3. Create monitoring alerts for fallback usage
4. Add CI check to prevent new hardcoded prices

**Estimated Time:** 1-2 hours

---

## 📊 RISK ASSESSMENT

### Current Risks:

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|------------|--------|------------|
| Amoy swaps fail | 🔴 Critical | High | Users can't swap | Deploy Pyth oracle ASAP |
| Stale fallback prices | 🟡 Medium | Medium | Wrong quotes | Use external API |
| No production alerts | 🟡 Medium | Low | Silent failures | Add monitoring |
| Mock oracle in prod | 🔴 Critical | High (Amoy) | Wrong prices | Replace with Pyth |

### After Fixes:

| Risk | Severity | Likelihood | Impact |
|------|----------|------------|--------|
| Pyth oracle downtime | 🟡 Medium | Low | Temporary failures |
| API rate limits | 🟢 Low | Low | Slow fallback |
| Price staleness | 🟢 Low | Very Low | Minimal |

---

## ✅ VERIFICATION CHECKLIST

After implementing all fixes:

- [ ] **Amoy Pyth oracle deployed**
  ```bash
  cast call <ORACLE> "getPrice(address)" <WMATIC> --rpc-url amoy
  # Should return realistic price (not 1e8)
  ```

- [ ] **Amoy adapter uses Pyth oracle**
  ```bash
  cast call <ADAPTER> "priceOracle()" --rpc-url amoy
  # Should NOT be 0x0000...0001
  ```

- [ ] **Frontend config updated**
  ```bash
  grep mockDex frontend/src/config/contracts.json
  # Should show new adapter address for Amoy
  ```

- [ ] **Backend fallback replaced**
  ```bash
  grep -n "3450.0\|0.55" backend/pyth_oracle_service.py
  # Should only appear in comments, not code
  ```

- [ ] **Test Amoy swap**
  ```bash
  # Use frontend to swap 1 USDC → WMATIC
  # Should get ~1.8 WMATIC (at current price)
  # Should succeed without errors
  ```

- [ ] **Monitor logs**
  ```bash
  # Check backend logs
  # Should NOT see "Using FALLBACK price" for Amoy
  ```

---

## 🎓 LESSONS LEARNED

### Why Hardcoded Prices Exist:

1. **Quick Prototyping:** Fallback prices added for development
2. **Oracle Not Available:** Amoy Pyth oracle not deployed yet
3. **Migration Incomplete:** Forgot to update Amoy adapter in frontend

### Prevention Strategies:

1. **Code Reviews:** Flag any hardcoded numeric values > 1.0
2. **CI Checks:** Add linter rule to detect hardcoded prices
3. **Monitoring:** Alert when fallback prices are used
4. **Documentation:** Clear separation of dev vs prod configs
5. **Deployment Checklist:** Verify oracle + adapter before going live

---

## 📞 SUPPORT

**If swaps continue to fail after fixes:**

1. **Check oracle deployment:**
   ```bash
   cast call <ORACLE> "getPrice(address)" <TOKEN> --rpc-url <NETWORK>
   ```

2. **Check adapter oracle:**
   ```bash
   cast call <ADAPTER> "priceOracle()" --rpc-url <NETWORK>
   ```

3. **Check quote:**
   ```bash
   cast call <ADAPTER> "getQuote(address,address,uint256)" \
     <TOKEN_IN> <TOKEN_OUT> <AMOUNT> --rpc-url <NETWORK>
   ```

4. **Check backend logs:**
   ```bash
   tail -f backend/logs/*.log | grep -i "fallback\|pyth\|oracle"
   ```

---

**Report Status:** COMPLETE ✅  
**Last Updated:** November 8, 2025  
**Next Review:** After Amoy oracle deployment
