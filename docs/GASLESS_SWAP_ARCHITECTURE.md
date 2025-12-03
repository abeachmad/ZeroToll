# ZeroToll Gasless Swap System - Comprehensive Architecture Plan

> This document outlines the complete architecture for the ZeroToll gasless swap system, including UI/UX design, token architecture, approval flows, router logic, and implementation phases.

## Table of Contents

1. [UI/UX Design](#1-uiux-design)
2. [Token Architecture](#2-token-architecture)
3. [Approval Flow Logic](#3-approval-flow-logic)
4. [Router Fallback Chain](#4-router-fallback-chain)
5. [Smart Contract Architecture](#5-smart-contract-architecture)
6. [Backend Services](#6-backend-services)
7. [Frontend Components](#7-frontend-components)
8. [Implementation Phases](#8-implementation-phases)
9. [Summary](#9-summary)

---

## 1. UI/UX Design

### Swap Mode Selection (Top of Swap Interface)

```
┌─────────────────────────────────────────────┐
│  Swap Mode:                                 │
│  ○ Traditional  ○ Relayer  ○ Pimlico       │
└─────────────────────────────────────────────┘
```

| Mode | Description |
|------|-------------|
| **Traditional** (default) | User pays gas, standard ERC-20 approve |
| **Relayer** | Backend EOA pays gas, uses existing RouterHub system |
| **Pimlico** | ERC-4337 paymaster sponsors gas, uses ZeroTollRouterV2 |

### Token List with Gasless Indicators

```
┌─────────────────────────────────────────────┐
│ Select Token                                │
├─────────────────────────────────────────────┤
│ zUSDC  ⚡ ERC-2612 permit                   │
│ zETH   ⚡ ERC-2612 permit                   │
│ zPOL   ⚡ ERC-2612 permit                   │
│ zLINK  ⚡ ERC-2612 permit                   │
│ USDC   🔄 Permit2                           │
│ WETH   🔄 Permit2                           │
│ LINK   🔄 Permit2                           │
│ USDT   ⚠️ Requires approval                 │
└─────────────────────────────────────────────┘
```

### Legend

| Icon | Meaning | User Experience |
|------|---------|-----------------|
| ⚡ | ERC-2612 native permit | Fully gasless - sign message only |
| 🔄 | Permit2 supported | Fully gasless - sign message only |
| ⚠️ | Requires approval | One-time approval tx needed, then gasless |

---

## 2. Token Architecture

### New zTokens (ERC-2612 Compliant)

| Token | Decimals | Pyth Price Feed | Purpose |
|-------|----------|-----------------|---------|
| zUSDC | 6 | USDC/USD | Mirrors USDC price |
| zETH | 18 | ETH/USD | Mirrors ETH/WETH price |
| zPOL | 18 | POL/USD | Mirrors POL/WPOL price |
| zLINK | 18 | LINK/USD | Mirrors LINK price |

### zToken Contract Features

- Full ERC-20 compliance
- ERC-2612 `permit()` function for gasless approvals
- Mintable by owner (for testnet distribution)
- No hardcoded prices - all pricing via Pyth oracle

### Existing Tokens (Keep)

| Token | Permit Support | Notes |
|-------|---------------|-------|
| USDC | Permit2 | Real testnet USDC |
| WETH | Permit2 | Wrapped ETH |
| WPOL | Permit2 | Wrapped POL |
| LINK | Permit2 | Chainlink token |

### Removed Tokens

- ~~ZTA~~ (replaced by zTokens)
- ~~ZTB~~ (replaced by zTokens)

---

## 3. Approval Flow Logic

```
User selects Pimlico mode + Token
           │
           ▼
┌─────────────────────────┐
│ Check: ERC-2612 permit? │
└───────────┬─────────────┘
            │
     Yes ───┴─── No
      │          │
      ▼          ▼
  Sign permit  ┌─────────────────────┐
  (gasless)    │ Check: Permit2?     │
      │        └──────────┬──────────┘
      │                   │
      │            Yes ───┴─── No
      │             │          │
      │             ▼          ▼
      │        Sign Permit2   Check allowance
      │        (gasless)           │
      │             │              │
      │             │       Has allowance?
      │             │         │
      │             │    Yes ─┴─ No
      │             │     │      │
      │             │     │      ▼
      │             │     │   Approve tx
      │             │     │   (user pays)
      │             │     │      │
      └─────────────┴─────┴──────┘
                    │
                    ▼
            Execute Gasless Swap
            (Pimlico pays gas)
```

### Approval Priority

1. **ERC-2612 permit** → Best experience, fully gasless
2. **Permit2** → Fully gasless after one-time Permit2 approval
3. **Traditional approve** → User pays for approval, then gasless swaps

---

## 4. Router Fallback Chain

### All Modes Use Same Router Priority

```
Swap Request
     │
     ▼
┌─────────────────────────┐
│ 1. Check Uniswap Pool   │
│    (real DEX liquidity) │
└───────────┬─────────────┘
            │
    Found ──┴── Not Found
      │              │
      ▼              ▼
  Use Uniswap   ┌─────────────────────────┐
                │ 2. Check SmartDexAdapter │
                │    (Pyth oracle pricing) │
                └───────────┬─────────────┘
                            │
                    Found ──┴── Not Found
                      │              │
                      ▼              ▼
                Use SmartDex   ┌─────────────────────────┐
                               │ 3. Use ZeroTollAdapter   │
                               │    (Pyth oracle, zTokens)│
                               └─────────────────────────┘
```

### Network-Specific Optimization

| Network | Router Chain | Reason |
|---------|--------------|--------|
| Mainnet/Polygon | Uniswap → SmartDex → ZeroToll | Full DEX liquidity available |
| Testnets (Sepolia/Amoy) | SmartDex → ZeroToll | Sparse Uniswap liquidity |

---

## 5. Smart Contract Architecture

### Contracts to Deploy

| Contract | Purpose | Oracle | Status |
|----------|---------|--------|--------|
| ZeroTollRouterV2 | Main router with fallback logic | - | Deployed |
| SmartDexAdapter | Real token swaps | Pyth | Deployed |
| ZeroTollAdapter | zToken swaps (rename MockDex) | Pyth | To Update |
| zUSDC | ERC-2612 test token | - | To Deploy |
| zETH | ERC-2612 test token | - | To Deploy |
| zPOL | ERC-2612 test token | - | To Deploy |
| zLINK | ERC-2612 test token | - | To Deploy |

### Pyth Price Feed IDs

```solidity
// Already available on Sepolia & Amoy
bytes32 constant ETH_USD  = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
bytes32 constant USDC_USD = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;
bytes32 constant POL_USD  = 0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68571c6d7e8a8e8a8e8a8e8a8e;
bytes32 constant LINK_USD = 0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221;
```

---

## 6. Backend Services

### Relayer Mode (Existing)

| Component | File | Description |
|-----------|------|-------------|
| Relayer | `backend/relayer.mjs` | EOA pays gas |
| Router | RouterHub | Existing adapter system |
| Status | No changes needed | Working as-is |

### Pimlico Mode (Enhanced)

| Component | File | Description |
|-----------|------|-------------|
| Relayer | `backend/pimlico-v3-relayer.mjs` | Pimlico paymaster |
| Chains | Sepolia + Amoy | Multi-chain support |
| Features | Permit detection | Handles permit/permit2/traditional |

---

## 7. Frontend Components

### Files to Modify

| File | Changes |
|------|---------|
| `Swap.jsx` | Move gasless toggle to top, add mode indicators |
| `useIntentGasless.js` | Add permit type detection logic |
| `useTokenList.js` | Add permit support flags to tokens |
| `contracts.json` | Add zToken addresses |
| `tokenlists/*.json` | Add zTokens with permit flags |

### Token List Schema Update

```json
{
  "symbol": "zUSDC",
  "name": "ZeroToll USDC",
  "address": "0x...",
  "decimals": 6,
  "logoURI": "https://...",
  "permitType": "erc2612",
  "pythPriceId": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
}
```

### Permit Type Values

| Value | Meaning |
|-------|---------|
| `erc2612` | Native ERC-2612 permit support |
| `permit2` | Uniswap Permit2 support |
| `none` | Traditional approve only |

---

## 8. Implementation Phases

### Phase 1: zToken Contracts ✅ COMPLETE

- [x] Create ERC-2612 zToken contract template (`packages/contracts/contracts/tokens/ZeroTollToken.sol`)
- [x] Create ZeroTollAdapter with Pyth oracle (`packages/contracts/contracts/adapters/ZeroTollAdapter.sol`)
- [x] Create deployment script (`packages/contracts/scripts/deploy-ztokens.js`)
- [x] Create token list update script (`packages/contracts/scripts/update-tokenlist-ztokens.js`)
- [x] Create contracts.json update script (`packages/contracts/scripts/update-contracts-json.js`)
- [x] Deploy zUSDC, zETH, zPOL, zLINK to Sepolia
- [x] Deploy zUSDC, zETH, zPOL, zLINK to Amoy
- [x] Update frontend configs (contracts.json, token lists)

**Deployed Addresses:**

| Contract | Sepolia | Amoy |
|----------|---------|------|
| ZeroTollAdapter | 0x4E6A591459F0724E19f9B06A584B26fFB724a2a3 | 0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87 |
| zUSDC | 0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C | 0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD |
| zETH | 0x8153FA09Be1689D44C343f119C829F6702A8720b | 0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9 |
| zPOL | 0x63c31C4247f6AA40B676478226d6FEB5707649D6 | 0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d |
| zLINK | 0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C | 0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1 |

### Phase 2: Frontend UI ✅ COMPLETE

- [x] Move gasless toggle to top of swap interface (2-way: Relayer/Pimlico)
- [x] No selection = Traditional mode (user pays gas)
- [x] Selected mode shows bright green border and "✓ Active" indicator
- [x] Click again to deselect (toggle behavior)
- [x] Add permit type indicators (⚡🔄⚠️) to token list
- [x] Update token selection dropdowns with permit indicators
- [x] Fix INPUT mode message to only show in Relayer mode
- [x] Create Faucet page for zTokens (`/faucet`)
- [x] Add Faucet links to navigation (Home, Swap pages)

### Phase 3: Router Integration ✅ COMPLETE

- [x] Update ZeroTollRouterV2 with fallback chain logic (primaryAdapter → fallbackAdapter)
- [x] Deploy updated ZeroTollRouterV2 to Sepolia and Amoy
- [x] Configure adapters: SmartDexAdapter (primary) → ZeroTollAdapter (fallback)
- [x] Update frontend contracts.json with new router addresses

**New Router Addresses:**

| Network | ZeroTollRouterV2 |
|---------|------------------|
| Sepolia | 0x3f260E97be2528D7568dE495F908e04BC8722ec5 |
| Amoy | 0x8DABA829Fe6ACf7f3B9d98d52889beE5CcfEa3fD |

**Adapter Fallback Chain:**
1. SmartDexAdapter (tries Uniswap V3 → internal pool)
2. ZeroTollAdapter (Pyth oracle pricing, zTokens)

### Phase 4: Permit2 Support ✅ COMPLETE

- [x] Add Permit2 contract address to contracts.json (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)
- [x] Implement permit type detection in useIntentGasless hook (`getPermitType()`)
- [x] Add `isERC2612Token()` and `isPermit2Token()` helper functions
- [x] Implement Permit2 signature flow (`signPermit2()`, `submitSwapWithPermit2()`)
- [x] Add `getPermit2Allowance()` to check existing Permit2 approvals
- [x] Update token lists with `permitType` field for all tokens
- [x] Update router addresses in useIntentGasless hook

**Permit Type Detection:**
```javascript
getPermitType(tokenAddress) // Returns: 'erc2612' | 'permit2' | 'none'
```

**Token Permit Types:**
| Token | Sepolia | Amoy | Permit Type |
|-------|---------|------|-------------|
| zUSDC, zETH, zPOL, zLINK | ✅ | ✅ | ERC-2612 |
| USDC, WETH, LINK | ✅ | ✅ | Permit2 |
| WMATIC | - | ✅ | Permit2 |
| PYUSD | ✅ | - | None |

### Phase 5: Testing & Polish ✅ COMPLETE

- [x] Update Swap.jsx to use `getPermitType()` for permit detection
- [x] Support both ERC-2612 and Permit2 in `handlePimlicoGasless()`
- [x] Add fallback to traditional swap for unsupported tokens
- [x] ZTA/ZTB tokens replaced by zTokens (zUSDC, zETH, zPOL, zLINK)
- [x] Update documentation (this file)

**Gasless Flow in Pimlico Mode:**
```
User selects Pimlico mode + Token
           │
           ▼
    getPermitType(token)
           │
    ┌──────┴──────┐
    │             │
 erc2612      permit2
    │             │
    ▼             ▼
submitSwap   submitSwap
WithPermit   WithPermit2
    │             │
    └──────┬──────┘
           │
           ▼
    Gasless Swap!
```

---

## 9. Summary

### Feature Comparison Table

| Feature | Traditional | Relayer | Pimlico |
|---------|-------------|---------|---------|
| Gas Payer | User | Relayer EOA | Pimlico Paymaster |
| Approval | Standard approve | Standard approve | Permit/Permit2/Approve |
| Router | ZeroTollRouterV2 | RouterHub | ZeroTollRouterV2 |
| Oracle | Pyth | Pyth | Pyth |
| zTokens | ✅ | ✅ | ✅ (best experience) |
| Real Tokens | ✅ | ✅ | ✅ (with indicators) |

### Key Design Decisions

1. **No toggle = Traditional mode** - Intuitive default behavior
2. **All tokens visible** - With indicators instead of filtering
3. **zTokens replace ZTA/ZTB** - Real oracle prices, ERC-2612 native
4. **Pyth oracle everywhere** - No hardcoded prices
5. **Router fallback chain** - Maximize liquidity sources

---

## Document History

| Date | Version | Changes |
|------|---------|---------|
| 2024-12-03 | 1.0 | Initial comprehensive plan |
| 2024-12-03 | 2.0 | Phase 1-5 complete: zTokens, ZeroTollAdapter, Router fallback, Permit2, UI updates |

---

*This document serves as the reference architecture for the ZeroToll gasless swap system implementation.*
