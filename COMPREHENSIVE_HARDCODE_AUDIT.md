# 🚨 COMPREHENSIVE HARDCODE AUDIT - November 8, 2025

## ❌ CRITICAL FINDINGS: Hardcoded Values Still Present!

---

## 📊 EXECUTIVE SUMMARY

**Status:** ⚠️ **MULTIPLE HARDCODED VALUES FOUND**

Despite previous cleanup efforts, the following hardcoded values remain:

1. **Adapter Addresses** - Using OLD adapters with MockPriceOracle ($1 prices)
2. **Fallback Prices** - Hardcoded in backend (ETH=$3450, WMATIC=$0.55, etc.)
3. **Contract Addresses** - Scattered across multiple files

**Impact:** CRITICAL - Causes transaction failures due to price mismatches

---

## 🔍 DETAILED FINDINGS

### 1. ❌ FRONTEND: OLD Adapter Addresses (MockPriceOracle)

**File:** `frontend/src/config/contracts.json`

#### SEPOLIA (FIXED ✅):
```json
// BEFORE (WRONG):
"mockDex": "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"  // MockPriceOracle $1

// AFTER (CORRECT):
"mockDex": "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"  // Pyth oracle
```

#### AMOY (NOT FIXED ❌):
```json
// CURRENT (WRONG):
"mockDex": "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7"  // MockPriceOracle $1 ❌

// SHOULD BE:
"mockDex": "TBD - Deploy Pyth-enabled adapter first"  // Pyth oracle ✅
```

**Verification:**
```bash
# Amoy adapter oracle check:
Oracle: 0x0000000000000000000000000000000000000001 ❌
This is MockPriceOracle with hardcoded $1 prices!
```

**Impact:**
- ❌ All Amoy swaps use $1 prices (WMATIC=$1, USDC=$1)
- ❌ Backend uses fallback prices (WMATIC=$0.55, USDC=$1)
- ❌ Price mismatch causes transaction failures

---

### 2. ❌ BACKEND: Hardcoded Fallback Prices

**File:** `backend/pyth_oracle_service.py` (Lines 147-168)

```python
def _get_fallback_price(self, token_symbol: str) -> float:
    """
    Fallback prices - ONLY used if Pyth oracle query fails
    These are APPROXIMATE and should trigger alerts in production
    """
    fallback_prices = {
        'ETH': 3450.0,      # ❌ HARDCODED
        'WETH': 3450.0,     # ❌ HARDCODED
        'POL': 0.55,        # ❌ HARDCODED
        'WPOL': 0.55,       # ❌ HARDCODED
        'WMATIC': 0.55,     # ❌ HARDCODED
        'USDC': 1.0,        # ❌ HARDCODED
        'USDT': 1.0,        # ❌ HARDCODED
        'DAI': 1.0,         # ❌ HARDCODED
        'LINK': 18.0,       # ❌ HARDCODED
        'ARB': 0.85,        # ❌ HARDCODED
        'OP': 2.15,         # ❌ HARDCODED
    }
    
    price = fallback_prices.get(token_symbol, 1.0)  # ❌ Default $1
    logger.warning(f"⚠️  Using FALLBACK price for {token_symbol}: ${price}")
    return price
```

**Why This Is Bad:**
1. Fallback prices become **stale** (ETH may not be $3450 forever)
2. Default price of **$1** for unknown tokens is dangerous
3. No **alert system** when fallbacks are used in production
4. **ACTIVELY USED** for Amoy (oracle not deployed yet)

**Current Usage:**
```
Backend Logs (Amoy swaps):
2025-11-08 18:49:10,610 - WARNING - No oracle for chain 80002, using fallback
2025-11-08 18:49:10,610 - WARNING - ⚠️ Using FALLBACK price for WMATIC: $0.55
```

**Impact:**
- ✅ Sepolia: Using Pyth oracle (real-time prices)
- ❌ Amoy: Using fallback prices (stale, hardcoded)

---

### 3. ❌ ADAPTER CONTRACTS: MockPriceOracle ($1 Hardcoded)

**Contract:** `packages/contracts/contracts/oracles/MockPriceOracle.sol`

```solidity
contract MockPriceOracle is IPriceOracle {
    function getPrice(address) external pure override returns (uint256) {
        return 1e8; // Always returns $1.00 (8 decimals) ❌ HARDCODED
    }
}
```

**Deployed Instances:**
- **Amoy**: `0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7` uses `0x0000...0001` (MockPriceOracle)
- **Sepolia OLD**: `0x2Ed51974196EC8787a74c00C5847F03664d66Dc5` uses `0x0000...0001` (MockPriceOracle)
- **Sepolia NEW**: `0x86D1AA2228F3ce649d415F19fC71134264D0E84B` uses Pyth oracle ✅

**Impact:**
- All tokens valued at $1 (ETH=$1, WMATIC=$1, USDC=$1)
- Swaps calculate quotes as 1:1 (ignoring decimal differences)
- Causes massive price discrepancies with backend

---

### 4. ⚠️ TEST SCRIPTS: Hardcoded Addresses

**Files with Hardcoded Adapter Addresses:**

1. `backend/test_adapter_quote.py` (Line 12):
```python
ADAPTER_ADDRESS = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"  # Sepolia NEW
```

2. `backend/check_adapter_balance.py` (Line 9):
```python
ADAPTER_ADDRESS = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"  # Sepolia NEW
```

3. `backend/check_failed_quotes.py` (Lines 10, 16):
```python
SEPOLIA_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"  # NEW ✅
AMOY_ADAPTER = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301"  # OLD ❌
```

4. `packages/contracts/scripts/fund-adapter-sepolia.js` (Line 8):
```javascript
const ADAPTER_ADDRESS = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B";
```

5. `packages/contracts/scripts/debug-failed-swap-sepolia.js` (Line 6):
```javascript
const adapter = await ethers.getContractAt("MockDEXAdapter", "0x86D1AA2228F3ce649d415F19fC71134264D0E84B");
```

6. `packages/contracts/scripts/check-amoy-adapter-prices.js` (Line 10):
```javascript
const OLD_ADAPTER = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301";
```

**Impact:** LOW - Test scripts only, but should use environment variables

---

### 5. ⚠️ DOCUMENTATION: Stale Adapter Addresses

**Files with Outdated Info:**

1. `FUND_ADAPTERS_MANUAL.md`:
```markdown
- **Amoy**: `0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`  # MockPriceOracle ❌
- **Sepolia**: `0x2Ed51974196EC8787a74c00C5847F03664d66Dc5`  # OLD adapter ❌
```

2. `HARDCODE_AUDIT_NOV8.md` (.env template):
```bash
SEPOLIA_MOCKDEX_ADAPTER=0x2Ed51974196EC8787a74c00C5847F03664d66Dc5  # OLD ❌
AMOY_MOCKDEX_ADAPTER=0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7  # MockPrice ❌
```

3. `README.md`:
```markdown
- Address (Amoy): `0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`  # MockPrice ❌
```

**Impact:** LOW - Documentation only, but confusing for users

---

## 🎯 ROOT CAUSE: Why Hardcoded Prices Exist

### Timeline:

1. **Initial Deployment** (Earlier):
   - Deployed MockPriceOracle with $1 hardcoded prices
   - Deployed adapters pointing to MockPriceOracle
   - Frontend configured with these adapters

2. **Pyth Integration** (Recent):
   - Deployed Pyth oracle to Sepolia ✅
   - Deployed NEW Sepolia adapter with Pyth oracle ✅
   - Updated backend to use Pyth prices ✅
   - **FORGOT to update frontend config** ❌

3. **Current State**:
   - **Sepolia**: Frontend NOW using Pyth adapter (just fixed) ✅
   - **Amoy**: Still using MockPriceOracle adapter ❌
   - **Backend**: Using Pyth for Sepolia, fallback for Amoy

---

## 📋 COMPREHENSIVE FIX CHECKLIST

### Priority 1: Deploy Pyth Oracle to Amoy (CRITICAL)

**Why:** Stop using hardcoded fallback prices in backend

**Steps:**
```bash
# 1. Create deployment script
cat > packages/contracts/scripts/deploy-pyth-oracle-amoy.js << 'EOF'
const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying MultiTokenPythOracle to Amoy...\n");

    const AMOY_PYTH_CONTRACT = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";
    
    const MultiTokenPythOracle = await ethers.getContractFactory("MultiTokenPythOracle");
    const oracle = await MultiTokenPythOracle.deploy(AMOY_PYTH_CONTRACT);
    await oracle.waitForDeployment();
    
    const oracleAddress = await oracle.getAddress();
    console.log("✅ MultiTokenPythOracle deployed to:", oracleAddress);
    
    // Set price IDs
    const WPOL_USD = "0x..." // Get from pyth.network
    const USDC_USD = "0x..." // Get from pyth.network
    
    const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
    const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    
    await oracle.setPriceIds([WPOL, USDC], [WPOL_USD, USDC_USD]);
    
    console.log("\n📊 Configuration:");
    console.log("  WPOL:", WPOL, "→", WPOL_USD);
    console.log("  USDC:", USDC, "→", USDC_USD);
}

main().catch(console.error);
EOF

# 2. Run deployment
npx hardhat run scripts/deploy-pyth-oracle-amoy.js --network amoy

# 3. Update backend config
# Add to backend/.env:
AMOY_PYTH_ORACLE=<deployed_address>
```

### Priority 2: Deploy Pyth-Enabled Adapter to Amoy (CRITICAL)

**Why:** Stop using MockPriceOracle with $1 prices

**Steps:**
```bash
# 1. Deploy adapter pointing to Pyth oracle
cat > packages/contracts/scripts/deploy-mockdex-amoy-pyth.js << 'EOF'
const { ethers } = require("hardhat");

async function main() {
    const PYTH_ORACLE = process.env.AMOY_PYTH_ORACLE;
    
    const MockDEXAdapter = await ethers.getContractFactory("MockDEXAdapter");
    const adapter = await MockDEXAdapter.deploy(PYTH_ORACLE);
    await adapter.waitForDeployment();
    
    const adapterAddress = await adapter.getAddress();
    console.log("✅ MockDEXAdapter deployed to:", adapterAddress);
    
    // Add supported tokens
    const WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";
    const USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
    
    await adapter.addSupportedToken(WPOL);
    await adapter.addSupportedToken(USDC);
    
    console.log("\n✅ Tokens added: WPOL, USDC");
}

main().catch(console.error);
EOF

npx hardhat run scripts/deploy-mockdex-amoy-pyth.js --network amoy
```

### Priority 3: Whitelist New Adapter in RouterHub (CRITICAL)

```bash
cat > packages/contracts/scripts/whitelist-adapter-amoy.js << 'EOF'
const { ethers } = require("hardhat");

async function main() {
    const ROUTER_HUB = "0x5335f887E69F4B920bb037062382B9C17aA52ec6";
    const NEW_ADAPTER = process.env.NEW_AMOY_ADAPTER;
    
    const routerHub = await ethers.getContractAt("RouterHub", ROUTER_HUB);
    await routerHub.whitelistAdapter(NEW_ADAPTER, true);
    
    console.log("✅ Adapter whitelisted:", NEW_ADAPTER);
}

main().catch(console.error);
EOF

npx hardhat run scripts/whitelist-adapter-amoy.js --network amoy
```

### Priority 4: Update Frontend Config (CRITICAL)

```json
// frontend/src/config/contracts.json
{
  "amoy": {
    "adapters": {
      "mockDex": "<NEW_PYTH_ADAPTER_ADDRESS>"  // Update after deployment
    }
  }
}
```

### Priority 5: Fund New Adapter with Reserves (HIGH)

```bash
# Transfer tokens to new adapter
npx hardhat run scripts/fund-adapter-amoy.js --network amoy
```

### Priority 6: Update Backend Config (MEDIUM)

```python
# backend/pyth_oracle_service.py
# Update oracle addresses in __init__

self.oracle_addresses = {
    11155111: os.getenv('SEPOLIA_PYTH_ORACLE', '0x729fBc26977F8df79B45c1c5789A483640E89b4A'),
    80002: os.getenv('AMOY_PYTH_ORACLE', '<NEW_ORACLE_ADDRESS>'),  # Add this
}
```

### Priority 7: Remove Hardcoded Fallback Prices (LOW)

**Option A:** Use external price API as fallback
```python
def _get_fallback_price(self, token_symbol: str) -> float:
    """
    Fetch fallback from CoinGecko/CoinMarketCap API
    """
    try:
        response = requests.get(f'https://api.coingecko.com/api/v3/simple/price?ids={token_id}&vs_currencies=usd')
        return response.json()[token_id]['usd']
    except:
        logger.critical(f"🚨 FALLBACK FAILED for {token_symbol}! No price available!")
        raise Exception("Cannot get price - Pyth and fallback API both failed")
```

**Option B:** Keep hardcoded but add alerts
```python
def _get_fallback_price(self, token_symbol: str) -> float:
    price = fallback_prices.get(token_symbol, None)
    if price is None:
        logger.critical(f"🚨 UNKNOWN TOKEN {token_symbol}! Cannot provide price!")
        raise Exception(f"No price available for {token_symbol}")
    
    logger.warning(f"⚠️  FALLBACK PRICE for {token_symbol}: ${price}")
    # TODO: Send alert to monitoring system
    # send_slack_alert(f"Using fallback price for {token_symbol}")
    return price
```

### Priority 8: Update Test Scripts to Use ENV Vars (LOW)

```python
# backend/test_adapter_quote.py
import os

ADAPTER_ADDRESS = os.getenv('SEPOLIA_MOCKDEX_ADAPTER', '0x86D1AA2228F3ce649d415F19fC71134264D0E84B')
```

### Priority 9: Update Documentation (LOW)

Update all docs to reference environment variables:
- FUND_ADAPTERS_MANUAL.md
- HARDCODE_AUDIT_NOV8.md
- README.md

---

## 📊 HARDCODE INVENTORY

### Category A: CRITICAL (Causes Failures)
| Location | Type | Value | Status | Impact |
|----------|------|-------|--------|--------|
| `contracts.json` (Amoy) | Adapter | `0x7cafe...` | ❌ ACTIVE | Transaction failures |
| `MockPriceOracle.sol` | Price | `$1.00` | ❌ ACTIVE | Wrong quotes |
| `pyth_oracle_service.py` | Fallback | `$0.55, $3450, etc.` | ❌ ACTIVE | Stale prices |

### Category B: MEDIUM (Test Scripts)
| Location | Type | Value | Status | Impact |
|----------|------|-------|--------|--------|
| `test_adapter_quote.py` | Adapter | `0x86D1A...` | ⚠️ OK | Test only |
| `check_failed_quotes.py` | Adapter | `0x0560672...` | ⚠️ OLD | Wrong tests |
| `fund-adapter-sepolia.js` | Adapter | `0x86D1A...` | ⚠️ OK | Script only |

### Category C: LOW (Documentation)
| Location | Type | Value | Status | Impact |
|----------|------|-------|--------|--------|
| `FUND_ADAPTERS_MANUAL.md` | Adapter | Multiple | ⚠️ STALE | Confusing |
| `HARDCODE_AUDIT_NOV8.md` | .env template | Multiple | ⚠️ STALE | Wrong guide |
| `README.md` | Adapter | `0x7cafe...` | ⚠️ STALE | Outdated |

---

## 🎓 LESSONS LEARNED

### 1. Configuration Management
- **Problem:** Hardcoded values in multiple locations
- **Solution:** Single source of truth (`.env` + `contracts.json`)
- **Prevention:** Pre-deployment checklist requiring config review

### 2. Oracle Migration
- **Problem:** Deployed new oracle but didn't update all references
- **Solution:** Automated migration script that updates all configs
- **Prevention:** Integration tests checking oracle addresses match

### 3. Fallback Strategies
- **Problem:** Fallback prices hardcoded and stale
- **Solution:** Use external API or fail loudly (no silent fallbacks)
- **Prevention:** Monitoring alerts when fallbacks are used

### 4. Documentation Sync
- **Problem:** Docs reference old/wrong addresses
- **Solution:** Generate docs from config files (single source of truth)
- **Prevention:** CI check that verifies doc addresses match deployed addresses

---

## ✅ VERIFICATION STEPS

After applying all fixes:

```bash
# 1. Verify Amoy adapter oracle
cast call <NEW_AMOY_ADAPTER> "priceOracle()" --rpc-url amoy
# Should return Pyth oracle address, NOT 0x0000...0001

# 2. Test Amoy quote
cast call <NEW_AMOY_ADAPTER> \
  "getQuote(address,address,uint256)" \
  <USDC> <WPOL> 1000000 \
  --rpc-url amoy
# Should return quote based on real WPOL price (~$0.55)

# 3. Test backend Amoy price
curl http://localhost:5001/quote \
  -d '{"chainId":80002,"tokenIn":"USDC","tokenOut":"WMATIC","amountIn":"1"}' \
  -H "Content-Type: application/json"
# Should NOT see "Using FALLBACK price" warning

# 4. Test actual swap
# Use frontend to swap 1 USDC → WMATIC on Amoy
# Should succeed with quote ≈ 1.8 WMATIC
```

---

## 📞 NEXT ACTIONS

**IMMEDIATE (Do Now):**
1. ✅ Update Sepolia adapter in frontend (DONE)
2. ❌ Deploy Pyth oracle to Amoy
3. ❌ Deploy Pyth-enabled adapter to Amoy
4. ❌ Update Amoy adapter in frontend

**SHORT TERM (This Week):**
5. ❌ Replace hardcoded fallbacks with API fallback
6. ❌ Add monitoring alerts for fallback usage
7. ❌ Update all test scripts to use ENV vars
8. ❌ Update all documentation

**LONG TERM (Future):**
9. ❌ Automated config sync script
10. ❌ Integration tests for oracle consistency
11. ❌ CI checks for hardcoded values
12. ❌ Deployment checklist automation

---

**Report Generated:** November 8, 2025  
**Status:** 🚨 CRITICAL HARDCODED VALUES FOUND  
**Action Required:** Deploy Pyth oracle and adapter to Amoy ASAP
