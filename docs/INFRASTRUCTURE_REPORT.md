# ZeroToll Infrastructure Report

**Generated:** December 15, 2025

---

## SEPOLIA (chainId: 11155111)

### 📦 Routers

| Contract | Address | Status | Usage |
|----------|---------|--------|-------|
| **RouterV3** | `0xB54e95a30E4Aa355380798313E0791833C7F0BFF` | ✅ Deployed | ✅ **ACTIVE** (gasless swaps with fee) |
| RouterV2 | `0x577560699EF88e99f15d04df57c9552056d2a10D` | ✅ Deployed | ⚠️ DEPRECATED |
| RouterHub | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` | ✅ Deployed | ⚠️ Legacy |

**RouterV3 Liquidity:**
- zUSDC: 500.00
- zETH: 500.00
- zPOL: 500.00
- zLINK: 500.00

### 💰 Treasury

| Contract | Address | Status |
|----------|---------|--------|
| **Treasury** | `0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10` | ✅ ACTIVE |

Fee Distribution: 80% LP Rewards | 15% Operations | 5% Reserve

### 🔌 Adapters

| Contract | Address | Status | Usage |
|----------|---------|--------|-------|
| SmartDexAdapter | `0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa` | ✅ Deployed | ✅ Primary |
| ZeroTollAdapter | `0x4E6A591459F0724E19f9B06A584B26fFB724a2a3` | ✅ Deployed | ✅ Test mode |
| MockDexAdapter | `0x86D1AA2228F3ce649d415F19fC71134264D0E84B` | ✅ Deployed | ⚠️ Test only |

### ⛽ Paymaster (ERC-4337)

| Contract | Address | EntryPoint Deposit |
|----------|---------|-------------------|
| VerifyingPaymasterV07 | `0xaf7e002447b790f212ea435f9387509cd1ef0054` | 0.20 ETH |

### 🪙 zTokens (ERC-2612 Permit)

| Token | Address |
|-------|---------|
| zUSDC | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` |
| zETH | `0x8153FA09Be1689D44C343f119C829F6702A8720b` |
| zPOL | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` |
| zLINK | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` |

---

## AMOY (chainId: 80002)

### 📦 Routers

| Contract | Address | Status | Usage |
|----------|---------|--------|-------|
| **RouterV3** | `0xD83D377E4698317731b2953854c01d39C60815d7` | ✅ Deployed | ✅ **ACTIVE** (gasless swaps with fee) |
| RouterV2 | `0xc75df1943d6EFE04b422b9bB45509782609Fc67a` | ✅ Deployed | ⚠️ DEPRECATED |
| RouterHub | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` | ✅ Deployed | ⚠️ Legacy |

**RouterV3 Liquidity:**
- zUSDC: 500.00
- zETH: 500.00
- zPOL: 500.00
- zLINK: 500.00

### 💰 Treasury

| Contract | Address | Status |
|----------|---------|--------|
| **Treasury** | `0xD6a7294445F34d0F7244b2072696106904ea807B` | ✅ ACTIVE |

Fee Distribution: 80% LP Rewards | 15% Operations | 5% Reserve

### 🔌 Adapters

| Contract | Address | Status | Usage |
|----------|---------|--------|-------|
| SmartDexAdapter | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` | ✅ Deployed | ✅ Primary |
| ZeroTollAdapter | `0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87` | ✅ Deployed | ✅ Test mode |
| MockDexAdapter | `0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1` | ✅ Deployed | ⚠️ Test only |

### ⛽ Paymaster (ERC-4337)

| Contract | Address | EntryPoint Deposit |
|----------|---------|-------------------|
| VerifyingPaymasterV07 | `0xaad1211a722ee04b6980724586b6b5b7b0c86fee` | 0.91 POL |

### 🪙 zTokens (ERC-2612 Permit)

| Token | Address |
|-------|---------|
| zUSDC | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` |
| zETH | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` |
| zPOL | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` |
| zLINK | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` |

---

## 👛 Wallets & Accounts

| Wallet | Address | Sepolia | Amoy |
|--------|---------|---------|------|
| Deployer | `0x330A86eE67bA0Da0043EaD201866A32d362C394c` | 0.50 ETH ✅ | 2.60 POL ✅ |
| Relayer | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` | 0.009 ETH ⚠️ | 0.92 POL ✅ |
| Bundler | `0xd4ab7c32fce0d28882052a83de467b9be2dbfc8e` | 5.43 ETH ✅ | 18.65 POL ✅ |
| Smart Account | `0x2caF80daf45581E017aaC929812b92Ad954Be2E8` | 0.00 ETH | 0.00 POL |

---

## Summary

### ✅ Active Contracts (Currently Used)

| Component | Purpose |
|-----------|---------|
| RouterV3 | Gasless swaps with 2x gas fee |
| Treasury | Collects fees for LP rewards |
| VerifyingPaymasterV07 | Sponsors gas for users |
| SmartDexAdapter | Primary swap execution |
| ZeroTollAdapter | Test mode swaps |
| zTokens | ERC-2612 permit tokens |

### ⚠️ Deprecated/Legacy (Not Used)

| Component | Reason |
|-----------|--------|
| RouterV2 | Replaced by RouterV3 with fee support |
| RouterHub | Legacy cross-chain routing (not active) |
| MockDexAdapter | Test only |

### 💡 Recommendations

- ⚠️ Fund Sepolia relayer (currently 0.009 ETH - low)
- Consider depositing more to paymasters for high-volume usage

---

## Fee System (Phase 2B)

- **Fee Calculation:** 2x estimated gas cost
- **Fee Source:** Deducted from INPUT token
- **Distribution:** 80% LP Rewards | 15% Operations | 5% Reserve
- **Treasury Contracts:** Collect and distribute fees

---

## Quick Reference

```
# Sepolia
RouterV3:   0xB54e95a30E4Aa355380798313E0791833C7F0BFF
Treasury:   0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10
Paymaster:  0xaf7e002447b790f212ea435f9387509cd1ef0054

# Amoy
RouterV3:   0xD83D377E4698317731b2953854c01d39C60815d7
Treasury:   0xD6a7294445F34d0F7244b2072696106904ea807B
Paymaster:  0xaad1211a722ee04b6980724586b6b5b7b0c86fee

# Relayer
EOA:        0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A
Smart Acc:  0x2caF80daf45581E017aaC929812b92Ad954Be2E8
```
