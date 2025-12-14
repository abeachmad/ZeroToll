# Phase 2: Self-Hosted Paymaster Implementation Plan

> **Created:** December 14, 2025  
> **Updated:** December 14, 2025  
> **Status:** Steps 1-2, 5, 7 COMPLETE - Paymasters deployed and funded!  
> **Goal:** Replace Pimlico with self-hosted bundler + paymaster to reduce costs by 50%

---

## Overview

Replace Pimlico's bundler and paymaster with our own self-hosted stack while maintaining the same user experience (2 signatures, zero gas).

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT (Pimlico)                            │
├─────────────────────────────────────────────────────────────────┤
│  User → Sign Permit/Intent → Pimlico Bundler → Pimlico Paymaster│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2 (Self-Hosted)                        │
├─────────────────────────────────────────────────────────────────┤
│  User → Sign Permit/Intent → Policy Server → Infinitism Bundler │
│                                    ↓                            │
│                          VerifyingPaymaster (pays gas)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Deploy VerifyingPaymaster Contract ✅ DONE

**Networks:** Sepolia + Amoy

**Prerequisites:**
- VerifyingPaymaster.sol exists at `packages/contracts/contracts/VerifyingPaymaster.sol`
- Need to deploy BasePaymaster.sol first (dependency)

**Tasks:**
1. [x] Check if BasePaymaster.sol exists, create if needed ✅ EXISTS
2. [x] Create deployment script `scripts/deploy-verifying-paymaster.js` ✅ CREATED
3. [x] Deploy to Sepolia ✅ `0xB9F49b6d8e7af756dE755C254683B4aAAaCF27cF`
4. [x] Deploy to Amoy ✅ `0xe28fdf6B360235B2195f73C756aE3E051A7fA1Ed`
5. [ ] Verify contracts on block explorers (optional - no API key)
6. [x] Update `docs/CURRENT_CONTRACTS.md` with addresses ✅

**Deployment Parameters:**
- `_entryPoint`: `0x0000000071727De22E5E9d8BAf0edAc6f37da032` (v0.7)
- `_verifySigner`: Policy server's signer address (from `.env`)

---

### Step 2: Fund Paymaster ✅ DONE

**Tasks:**
1. [x] Send initial ETH to Sepolia paymaster ✅ 0.3 ETH deposited
2. [x] Send initial POL to Amoy paymaster ✅ 5 POL deposited
3. [x] Call `paymaster.deposit()` to deposit to EntryPoint ✅
4. [x] Verify deposit via `entryPoint.balanceOf(paymaster)` ✅

**Script:** `npx hardhat run scripts/fund-paymaster.js --network <network>` ✅ CREATED

**Minimum Balances:**
- Sepolia: 0.1 ETH minimum, refill at 0.05 ETH
- Amoy: 5 POL minimum, refill at 2 POL

---

### Step 3: Configure & Start Infinitism Bundler ⬜

**Location:** `bundler-infinitism/`

**Tasks:**
1. [ ] Update `bundler.config.json` with correct settings
2. [ ] Ensure bundler has funded wallet (`bundler.key`)
3. [ ] Test bundler startup on Sepolia
4. [ ] Test bundler startup on Amoy
5. [ ] Create systemd service or PM2 config for production

**Config Updates Needed:**
```json
{
  "networks": {
    "amoy": {
      "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      "beneficiary": "<RELAYER_ADDRESS>",
      "rpcUrl": "<AMOY_RPC>",
      "chainId": 80002
    },
    "sepolia": {
      "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      "beneficiary": "<RELAYER_ADDRESS>",
      "rpcUrl": "<SEPOLIA_RPC>",
      "chainId": 11155111
    }
  }
}
```

**Bundler Endpoints:**
- Sepolia: `http://localhost:3000/rpc` (or configured port)
- Amoy: `http://localhost:3001/rpc` (separate instance)

---

### Step 4: Update Policy Server ⬜

**Location:** `backend/policy-server/server.js`

**Tasks:**
1. [ ] Add paymaster addresses to config
2. [ ] Update UserOp hash calculation for v0.7 format
3. [ ] Add endpoint to check paymaster balance
4. [ ] Test signature generation

**Env Variables Needed:**
```env
# Policy Server
SIGNER_PRIVATE_KEY=<policy_signer_key>
ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Paymasters (to be filled after deployment)
SEPOLIA_PAYMASTER=<deployed_address>
AMOY_PAYMASTER=<deployed_address>

# Rate Limits
MAX_SWAPS_PER_DAY=100
MAX_SWAPS_PER_HOUR=20
```

---

### Step 5: Create Self-Hosted Relayer ✅ DONE

**New File:** `backend/self-hosted-relayer.mjs` ✅ CREATED

**Tasks:**
1. [x] Create new relayer that uses Infinitism bundler instead of Pimlico
2. [x] Integrate with policy server for UserOp signing
3. [x] Support both Sepolia and Amoy
4. [ ] Add fallback to Pimlico if self-hosted fails
5. [x] Add `/swap` and `/swap-with-permit` endpoints

**Key Differences from Pimlico Relayer:**
| Aspect | Pimlico | Self-Hosted |
|--------|---------|-------------|
| Bundler URL | `api.pimlico.io` | `localhost:3000` |
| Paymaster | Pimlico's | VerifyingPaymaster |
| Signing | Pimlico handles | Policy server signs |
| UserOp format | Pimlico SDK | Manual construction |

---

### Step 6: Update Frontend ⬜

**Location:** `frontend/src/hooks/useIntentGasless.js`

**Tasks:**
1. [ ] Add `submitSwapSelfHosted()` function
2. [ ] Or update existing functions to accept `paymaster: 'pimlico' | 'self-hosted'`
3. [ ] Update Swap.jsx to allow selecting paymaster

**Optional:** Keep Pimlico as fallback option in UI

---

### Step 7: Gas Tank Monitor ✅ DONE

**New File:** `backend/gas-tank-monitor.mjs` ✅ CREATED

**Tasks:**
1. [x] Create script to monitor paymaster balances
2. [x] Auto-refill when below threshold
3. [x] Send alerts (Discord/Telegram) when low
4. [x] Run as cron job or PM2 process (PM2 ready)

**Logic:**
```javascript
const THRESHOLDS = {
  sepolia: { min: 0.05, refill: 0.2 },  // ETH
  amoy: { min: 2, refill: 5 }           // POL
};

async function checkAndRefill(network) {
  const balance = await getPaymasterBalance(network);
  if (balance < THRESHOLDS[network].min) {
    await refillPaymaster(network, THRESHOLDS[network].refill);
    await sendAlert(`Refilled ${network} paymaster`);
  }
}
```

---

### Step 8: Testing ⬜

**Test Cases:**
1. [ ] Deploy paymaster to Sepolia - verify on Etherscan
2. [ ] Fund paymaster - verify EntryPoint deposit
3. [ ] Start bundler - verify RPC responds
4. [ ] Policy server signs UserOp - verify signature
5. [ ] End-to-end swap on Sepolia - gasless works
6. [ ] End-to-end swap on Amoy - gasless works
7. [ ] Rate limiting works - blocks after limit
8. [ ] Gas tank refills - auto-refill triggers

---

### Step 9: Production Deployment ⬜

**Tasks:**
1. [ ] Deploy bundler to production server
2. [ ] Deploy policy server to production
3. [ ] Set up monitoring/alerts
4. [ ] Update frontend to use production endpoints
5. [ ] Document runbooks for operations

---

## File Changes Summary

| File | Action | Status |
|------|--------|--------|
| `packages/contracts/contracts/core/BasePaymaster.sol` | Exists | ✅ Already exists |
| `packages/contracts/scripts/deploy-verifying-paymaster.js` | Create | ✅ Created |
| `packages/contracts/scripts/fund-paymaster.js` | Create | ✅ Created |
| `backend/self-hosted-relayer.mjs` | Create | ✅ Created |
| `backend/gas-tank-monitor.mjs` | Create | ✅ Created |
| `.env.example` | Update | ✅ Updated with Phase 2 vars |
| `backend/policy-server/server.js` | Update | ⬜ Pending |
| `bundler-infinitism/bundler.config.json` | Update | ⬜ Pending |
| `frontend/src/hooks/useIntentGasless.js` | Update | ⬜ Pending |
| `docs/CURRENT_CONTRACTS.md` | Update | ✅ Updated |
| `.env` | Create | ✅ Created with paymaster addresses |
| `backend/check-balances.mjs` | Create | ✅ Created |
| `backend/fund-sepolia-paymaster.mjs` | Create | ✅ Created |

---

## Contract Addresses ✅ DEPLOYED

| Contract | Sepolia | Amoy |
|----------|---------|------|
| VerifyingPaymaster | `0xB9F49b6d8e7af756dE755C254683B4aAAaCF27cF` | `0xe28fdf6B360235B2195f73C756aE3E051A7fA1Ed` |
| Policy Signer | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` |
| Deposit | 0.3 ETH | 5 POL |

---

## Environment Variables (To Be Added)

```env
# Self-Hosted Paymaster
SEPOLIA_VERIFYING_PAYMASTER=
AMOY_VERIFYING_PAYMASTER=
POLICY_SIGNER_PRIVATE_KEY=
POLICY_SIGNER_ADDRESS=

# Bundler
BUNDLER_SEPOLIA_URL=http://localhost:3000/rpc
BUNDLER_AMOY_URL=http://localhost:3001/rpc

# Gas Tank
GAS_TANK_PRIVATE_KEY=
ALERT_WEBHOOK_URL=
```

---

## Rollback Plan

If self-hosted fails, revert to Pimlico:
1. Update `pimlico-v3-relayer.mjs` to use Pimlico endpoints
2. No contract changes needed
3. Frontend works with either backend

---

## Success Criteria

- [ ] Gasless swap works on Sepolia with self-hosted stack
- [ ] Gasless swap works on Amoy with self-hosted stack
- [ ] User experience identical to Pimlico (2 signatures, zero gas)
- [ ] Cost per swap reduced by ~50%
- [ ] Paymaster auto-refills when low
- [ ] Monitoring alerts working

---

## Notes

- EntryPoint v0.7: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- VerifyingPaymaster is simpler than ZeroTollPaymaster - good for MVP
- Can upgrade to ZeroTollPaymaster later for advanced fee handling
- Keep Pimlico as fallback during transition period
