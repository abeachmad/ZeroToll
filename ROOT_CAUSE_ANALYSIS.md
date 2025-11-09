# ROOT CAUSE ANALYSIS - FAILED SWAPS

## Executive Summary

**2 Failed Transactions Analyzed:**
1. ❌ Sepolia: 0.001 WETH → USDC (`0xc9d4e0cb...`)
2. ❌ Amoy: 1 USDC → WMATIC (`0x5dfaa7ca...`)

**4 Successful Transactions for Comparison:**
1. ✅ Sepolia: 3 USDC → WETH (`0x6f8412dc...`)
2. ✅ Sepolia: 4 USDC → WETH (`0xb83b36f1...`)
3. ✅ Amoy: 2 WMATIC → USDC (`0xde89d387...`)
4. ✅ Amoy: 1 WMATIC → USDC (`0x52526a30...`)

---

## Root Causes Identified

### 1. AMOY Failure - **ADAPTER HAS NO WMATIC RESERVES** ❌

**Evidence:**
```python
Adapter (0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301) WMATIC balance: 0.0 WMATIC
```

**Failure Reason:**
- User tried to swap 1 USDC → WMATIC
- Adapter needs to send WMATIC to user
- **Adapter has 0 WMATIC** → Cannot fulfill swap
- Transaction reverted: "Adapter call failed"

**Pattern Analysis:**
- ✅ **WMATIC → USDC swaps SUCCESS** (adapter had USDC)
- ❌ **USDC → WMATIC swaps FAIL** (adapter has NO WMATIC)

**Solution:**
```bash
# Fund Amoy adapter with WMATIC reserves
Transfer 100 WMATIC → 0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301
```

---

### 2. SEPOLIA Failure - **UNKNOWN (All checks pass!)** ⚠️

**Evidence:**
```python
Adapter quote: 3.438912 USDC (sufficient ✅)
Min Out required: 3.257601 USDC
Adapter USDC balance: 10.0 USDC (sufficient ✅)
User WETH allowance: 0.001 WETH (sufficient ✅)
```

**All Pre-Checks PASS:**
- ✅ Adapter has enough USDC reserves (10.0 USDC)
- ✅ Quote is above minOut (3.438 > 3.257)
- ✅ User approved WETH to RouterHub (0.001 WETH)

**But Transaction Still REVERTED!**

**Hypotheses:**
1. **RouterHub PUSH pattern issue?**
   - RouterHub pulls WETH from user → transfers to adapter → adapter swaps → returns USDC to RouterHub → RouterHub sends to user
   - Maybe adapter didn't receive WETH from RouterHub?

2. **Adapter swap() function parameter mismatch?**
   - Backend encodes: `swap(tokenIn, tokenOut, amountIn, minOut, recipient, deadline)`
   - Maybe adapter expects different recipient? (RouterHub vs User)

3. **Gas estimation failed = call would revert**
   - Backend log: `WARNING - Gas estimation failed: execution reverted: Adapter call failed`
   - Means if we simulated the call, it WOULD revert

**Need to Investigate:**
- Check RouterHub event logs from failed TX
- Check internal transactions (did WETH reach adapter?)
- Decode revert reason from transaction

---

## Pattern Analysis

### Successful Swaps Pattern:
```
Sepolia:
  USDC → WETH ✅ ✅  (Adapter had WETH reserves)

Amoy:
  WMATIC → USDC ✅ ✅  (Adapter had USDC reserves)
```

### Failed Swaps Pattern:
```
Sepolia:
  WETH → USDC ❌  (Adapter HAD USDC but still failed!)

Amoy:
  USDC → WMATIC ❌  (Adapter had NO WMATIC)
```

**Observation:**
- Swaps where adapter PROVIDES reserves: **Some succeed, some fail**
- Swaps where adapter RECEIVES tokens: **Always succeed** (if they have output reserves)

**Hypothesis:**
- Issue might be with RouterHub → Adapter token flow (PUSH pattern)
- When user sends WETH, maybe RouterHub doesn't successfully transfer to adapter?

---

## Backend Log Analysis

### Failed Sepolia Swap (0xc9d4e0cb...):
```log
2025-11-08 18:44:12,525 - pyth_oracle_service - INFO - 💰 Pyth price: WETH = $3445.77
2025-11-08 18:44:13,072 - pyth_oracle_service - INFO - 💰 Pyth price: USDC = $1.00
✅ Quote calculated with Pyth Oracle

amtIn: 1000000000000000 (0.001 WETH)
minOut: 3257601 (3.257601 USDC)
✅ Parameters correct

2025-11-08 18:44:22,223 - web3_tx_builder - WARNING - Gas estimation failed: execution reverted: Adapter call failed
❌ Gas estimation FAILED → Transaction WILL revert

2025-11-08 18:44:22,482 - web3_tx_builder - INFO - Transaction sent: 0xc9d4e0cb...
2025-11-08 18:44:33,741 - web3_tx_builder - ERROR - Transaction reverted
❌ Confirmed reverted
```

### Failed Amoy Swap (0x5dfaa7ca...):
```log
2025-11-08 18:49:10,610 - pyth_oracle_service - WARNING - No oracle for chain 80002, using fallback
2025-11-08 18:49:10,610 - pyth_oracle_service - WARNING - ⚠️  Using FALLBACK price for WMATIC: $0.55
⚠️ Using FALLBACK prices (Amoy oracle not deployed)

amtIn: 1000000 (1.0 USDC with 6 decimals)
minOut: 1718380900000000000 (1.718381 WMATIC)
✅ Parameters look reasonable

2025-11-08 18:49:28,451 - web3_tx_builder - WARNING - Gas estimation failed: execution reverted: Adapter call failed
❌ Gas estimation FAILED

2025-11-08 18:49:32,472 - web3_tx_builder - ERROR - Transaction reverted
❌ Confirmed reverted
```

**Common Factor:**
- **BOTH failed transactions had "Gas estimation failed: Adapter call failed"**
- This means when backend simulates the call, it detects it will revert
- Backend still sends TX anyway (with fallback gas 500000)

---

## Immediate Action Items

### Priority 1: Fix Amoy Adapter Reserves
```bash
# This is CONFIRMED root cause
cd /home/abeachmad/ZeroToll/packages/contracts

# Fund Amoy adapter with WMATIC
npx hardhat run scripts/fund-amoy-adapter.js --network amoy
```

**Script to create:**
```javascript
// Transfer 100 WMATIC to adapter
const ADAPTER = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301";
const WMATIC = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9";

const wmatic = await ethers.getContractAt("IERC20", WMATIC);
await wmatic.transfer(ADAPTER, ethers.parseEther("100"));
```

### Priority 2: Investigate Sepolia RouterHub Flow
```bash
# Check internal transactions
curl "https://api-sepolia.etherscan.io/api?module=account&action=txlistinternal&txhash=0xc9d4e0cb8695b07f2ec120f0beb36cf277e43093b713e5e203d2096cc88b19c7"

# Or manually inspect:
https://sepolia.etherscan.io/tx/0xc9d4e0cb8695b07f2ec120f0beb36cf277e43093b713e5e203d2096cc88b19c7/advanced#internal
```

**Questions to Answer:**
1. Did RouterHub successfully pull WETH from user?
2. Did RouterHub transfer WETH to adapter?
3. Did adapter execute swap?
4. At which step did it revert?

### Priority 3: Deploy Pyth Oracle to Amoy
```bash
# Currently using fallback prices ($0.55 WMATIC)
# Should use real Pyth prices

cd /home/abeachmad/ZeroToll/packages/contracts
node scripts/deploy-pyth-oracle-amoy.js
```

---

## Long-Term Solutions

1. **Pre-Fund Adapters with Both Tokens**
   - Sepolia adapter needs: WETH, USDC, LINK
   - Amoy adapter needs: WMATIC, USDC

2. **Add Reserve Checks in Backend**
   - Before quoting, check if adapter has enough output token
   - Reject quote if adapter reserves insufficient

3. **Improve Error Messages**
   - "Adapter call failed" is too vague
   - Decode actual revert reason from adapter

4. **Add Monitoring**
   - Alert when adapter reserves drop below threshold
   - Auto-refill adapters when needed

---

## Files to Check Next

1. `packages/contracts/contracts/RouterHub.sol` - Line ~50-100 (executeRoute function)
2. `packages/contracts/contracts/adapters/MockDEXAdapter.sol` - Line 79-130 (swap function)
3. Check Sepolia TX internal calls via Etherscan
4. Check if there's a revert reason in transaction receipt

