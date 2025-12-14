# ZeroToll Current Contract Addresses

> **Last Updated:** December 4, 2025  
> **Status:** All contracts verified and operational

---

## THREE SWAP MODES

| Mode | Description | User Pays Gas? |
|------|-------------|----------------|
| Traditional | User signs tx, pays gas | YES |
| EIP-7702 Gasless | Smart Account + Paymaster | NO (Paymaster pays) |
| Pimlico Intent Gasless | ERC-2612 Permit + Relayer | NO (Relayer pays) |

---

## MODE 1: TRADITIONAL SWAP

User pays gas, uses RouterHub.

| Network | Contract | Address |
|---------|----------|---------|
| Sepolia | RouterHub | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` |
| Sepolia | MockDEXAdapter | `0x86D1AA2228F3ce649d415F19fC71134264D0E84B` |
| Amoy | RouterHub | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` |
| Amoy | MockDEXAdapter | `0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1` |

**Flow:** User → RouterHub.executeRoute() → Adapter.swap()

---

## MODE 2: EIP-7702 GASLESS (Smart Account)

Uses RouterHub + Paymaster, user signs but doesn't pay.

| Network | Contract | Address |
|---------|----------|---------|
| Sepolia | RouterHub | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` |
| Sepolia | SmartDexAdapter | `0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa` |
| Amoy | RouterHub | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` |
| Amoy | SmartDexAdapter | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` |

**Flow:** User signs → Smart Account → Bundler → Paymaster pays → RouterHub.executeRoute()

---

## MODE 3: PIMLICO INTENT GASLESS (ERC-2612 Permit)

Uses ZeroTollRouterV2, user only signs messages.

| Network | Contract | Address |
|---------|----------|---------|
| **Sepolia** | **ZeroTollRouterV2** | `0x577560699EF88e99f15d04df57c9552056d2a10D` |
| Sepolia | ZeroTollAdapter | `0x4E6A591459F0724E19f9B06A584B26fFB724a2a3` |
| **Amoy** | **ZeroTollRouterV2** | `0xc75df1943d6EFE04b422b9bB45509782609Fc67a` |
| Amoy | ZeroTollAdapter | `0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87` |

**Flow:** User signs permit + intent → Relayer → Smart Account → ZeroTollRouterV2.executeSwapWithPermit()

---

## TOKENS (ERC-2612 Permit Support)

### Sepolia

| Token | Address | Decimals |
|-------|---------|----------|
| zUSDC | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` | 6 |
| zETH | `0x8153FA09Be1689D44C343f119C829F6702A8720b` | 18 |
| zPOL | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` | 18 |
| zLINK | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` | 18 |

### Amoy

| Token | Address | Decimals |
|-------|---------|----------|
| zUSDC | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` | 6 |
| zETH | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` | 18 |
| zPOL | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` | 18 |
| zLINK | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` | 18 |

---

## SMART ACCOUNT & RELAYER

| Component | Address |
|-----------|---------|
| Relayer EOA | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` |
| Smart Account (Sepolia) | `0x2caF80daf45581E017aaC929812b92Ad954Be2E8` |
| Smart Account (Amoy) | `0x43370460D26b10de805D4CdfE4d331aDb7219fFe` |

> **Note**: Smart Account addresses are deterministically derived from the relayer's private key. The "execution reverted" message shown in block explorers for ERC-4337 transactions is normal - it refers to the EntryPoint's postOp phase, not the actual swap. If tokens were transferred correctly, the swap succeeded.

---

## QUICK REFERENCE

| Contract Type | Sepolia | Amoy |
|---------------|---------|------|
| RouterHub | `0x8Bf6...4e84` | `0x49AD...4881` |
| **ZeroTollRouterV2** | `0x5775...a10D` | `0xc75d...c67a` |
| SmartDexAdapter | `0x5c2d...Bffa` | `0x8Bf6...4e84` |
| ZeroTollAdapter | `0x4E6A...2a3` | `0x30bb...C87` |

---

## EXPLORER LINKS

### Sepolia
- [ZeroTollRouterV2](https://sepolia.etherscan.io/address/0x577560699EF88e99f15d04df57c9552056d2a10D)
- [RouterHub](https://sepolia.etherscan.io/address/0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84)
- [Smart Account](https://sepolia.etherscan.io/address/0x2caF80daf45581E017aaC929812b92Ad954Be2E8)

### Amoy
- [ZeroTollRouterV2](https://amoy.polygonscan.com/address/0xc75df1943d6EFE04b422b9bB45509782609Fc67a)
- [RouterHub](https://amoy.polygonscan.com/address/0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881)
