# Phase 3 Deployment Log

## Session: January 26, 2026

### Objective
Deploy EIP-7702 ZeroTollDelegate contract to enable gasless swaps with 50% gas savings.

---

## Pre-Deployment Checklist

✅ **Contract Ready**
- ZeroTollDelegate.sol written and reviewed
- Supports EIP-7702 delegation
- Native token output (unwrap WETH/WPOL)
- EIP-712 intent verification
- Nonce-based replay protection

✅ **Configuration Updated**
- RouterV3 addresses configured:
  - Amoy: `0xD83D377E4698317731b2953854c01d39C60815d7`
  - Sepolia: `0xB54e95a30E4Aa355380798313E0791833C7F0BFF`
- Treasury addresses configured:
  - Amoy: `0xD6a7294445F34d0F7244b2072696106904ea807B`
  - Sepolia: `0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10`
- WETH/WPOL addresses configured

✅ **Deployment Script Ready**
- `packages/contracts/scripts/deploy-zerotoll-delegate.js`
- Saves deployment info to JSON
- Verifies on block explorer

✅ **Relayer Code Ready**
- `backend/eip7702-relayer.mjs`
- Supports EIP-7702 transactions
- Health check and nonce functions

---

## Deployment Steps

### Step 1: Deploy to Polygon Amoy

```bash
cd packages/contracts
npx hardhat run scripts/deploy-zerotoll-delegate.js --network amoy
```

**Expected Output:**
- ZeroTollDelegate address
- Domain separator
- Transaction hash
- Block number
- Verification status

**Status:** ⏳ Pending

---

### Step 2: Deploy to Ethereum Sepolia

```bash
npx hardhat run scripts/deploy-zerotoll-delegate.js --network sepolia
```

**Expected Output:**
- ZeroTollDelegate address
- Domain separator
- Transaction hash
- Block number
- Verification status

**Status:** ⏳ Pending

---

### Step 3: Update Configuration

**Files to Update:**
1. `backend/eip7702-relayer.mjs` - Add delegate addresses
2. `frontend/src/config/contracts.json` - Add delegate addresses
3. `docs/PHASE3_ACTION_PLAN.md` - Mark deployment complete

**Status:** ⏳ Pending

---

### Step 4: Test Deployment

```bash
# Test health check
node backend/eip7702-relayer.mjs health 80002
node backend/eip7702-relayer.mjs health 11155111

# Test nonce retrieval
node backend/eip7702-relayer.mjs nonce 80002 0xYOUR_ADDRESS
node backend/eip7702-relayer.mjs nonce 11155111 0xYOUR_ADDRESS
```

**Status:** ⏳ Pending

---

## Deployment Results

### Polygon Amoy (Chain ID: 80002)

| Item | Value |
|------|-------|
| ZeroTollDelegate | ⏳ Pending |
| Domain Separator | ⏳ Pending |
| Transaction Hash | ⏳ Pending |
| Block Number | ⏳ Pending |
| Gas Used | ⏳ Pending |
| Verification | ⏳ Pending |
| Explorer URL | ⏳ Pending |

### Ethereum Sepolia (Chain ID: 11155111)

| Item | Value |
|------|-------|
| ZeroTollDelegate | ⏳ Pending |
| Domain Separator | ⏳ Pending |
| Transaction Hash | ⏳ Pending |
| Block Number | ⏳ Pending |
| Gas Used | ⏳ Pending |
| Verification | ⏳ Pending |
| Explorer URL | ⏳ Pending |

---

## Post-Deployment Tasks

- [ ] Update backend configuration
- [ ] Update frontend configuration
- [ ] Test EIP-7702 swaps
- [ ] Measure gas savings
- [ ] Update documentation
- [ ] Commit and push to GitHub

---

## Notes

- EIP-7702 provides ~50% gas savings vs ERC-4337
- Delegate contract is immutable (no upgrades)
- Fee cap enforced at 1% of swap amount
- Native token output supported via WETH/WPOL unwrap

---

**Next Action:** Deploy to Amoy
**Command:** `cd packages/contracts && npx hardhat run scripts/deploy-zerotoll-delegate.js --network amoy`
