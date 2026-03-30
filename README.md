# ZeroToll 🚀

**Gasless DeFi with Native Output and Confidential Intents**

> ZeroToll is a gasless execution protocol that lets users swap without holding native gas, with fees recovered from token flow instead of upfront ETH/POL.

> Today the repo ships two active tracks:
> - **ZeroToll Gasless**: ERC-4337 + self-hosted paymaster, including native ETH delivery on Sepolia
> - **Confidential Gasless Intent**: Sepolia-only staged confidential settlement using browser-side CoFHE encryption, on-chain escrow, and native ETH finalization

> Powered by **ERC-4337 Account Abstraction**, **EIP-712 Signatures**, **ERC-2612 Permit**, **Permit2**, **Self-Hosted VerifyingPaymasterV07**, and **Fhenix CoFHE / @cofhe/sdk**.

---

## ✨ What is ZeroToll?

ZeroToll is a **gasless DEX / execution layer** that removes the native-gas barrier in DeFi through **intent-based signatures and self-hosted paymaster sponsorship**.

As of 2026-03-31, the active repo supports:

- **ERC-4337 gasless swaps** on Sepolia and Amoy
- **Native output delivery** on Sepolia, so a user can swap from ERC-20 into native `ETH`
- **Confidential Gasless Intent** on Sepolia with real browser-side CoFHE encryption and on-chain staged finalization

### Fee Model

| Feature | Description |
|---------|-------------|
| **Fee** | 2x gas cost, paid from INPUT token |
| **Transparency** | Fee shown upfront before swap |
| **Treasury** | Fees collected for LP rewards (Phase 4) |
| **Oracle** | Real-time Pyth Network prices |

### 🎯 Core Innovation: Self-Hosted ERC-4337 Paymaster

**How ZeroToll Gasless Works:**
1. User signs **ERC-2612 Permit** or **Permit2** spending authorization, depending on the token
2. User signs **EIP-712 SwapIntent** (authorizes the swap) - NO GAS  
3. ZeroToll Relayer calculates **2x gas fee** from input token
4. Our **VerifyingPaymasterV07** sponsors ALL gas costs
5. **RouterV3** executes swap, sends fee to Treasury, and can unwrap wrapped output into native `ETH`

For the confidential track, the user flow is intentionally staged:

1. Browser encrypts a private execution threshold with CoFHE
2. ZeroToll submits a confidential intent into `ConfidentialIntentEscrow`
3. Sponsored execution runs through the active venue
4. On-chain decryption is requested
5. Settlement is finalized as either:
   - native/token delivery to the user
   - or refund on failure

---

## 💰 Economic Model

### Why Self-Hosted Paymaster?

| Approach | Cost per 1M Swaps | Control |
|----------|-------------------|---------|
| **Pimlico Paymaster** | ~$1,000 (vendor fees) | ❌ None |
| **ZeroToll Self-Hosted** | ~$500 (gas only) | ✅ Full |
| **Savings** | **50%** | - |

### Fee Economics

```
Example: 10,000 gasless swaps/day @ $100 avg swap

Gas cost per swap:     $0.003
Fee collected (2x):    $0.006
Daily gas cost:        $30
Daily fee revenue:     $60
Monthly profit:        $900

At scale (100K swaps/day):
Monthly gas cost:      $9,000
Monthly fee revenue:   $18,000
Monthly profit:        $9,000
```

---

## 🚀 Quick Start

```bash
# Start official local stack (MongoDB + Backend + Relayer + Delegation API + Frontend)
bash ./start-zerotoll.sh

# Open: http://localhost:3000

# Stop everything
bash ./stop-zerotoll.sh
```

The same lifecycle commands are also available through the root `package.json`:

- `npm run start:local`
- `npm run status:local`
- `npm run stop:local`

### Official Local Runtime

`bash ./start-zerotoll.sh` is the current canonical local entry point for this repo.

| Service | Port | Description |
|---------|------|-------------|
| MongoDB | 27017 | Transaction history storage |
| Python Backend | 8000 | FastAPI server for quotes, history, config, and EIP-7702 routes |
| ZeroToll Relayer | 3002 | ERC-4337 / paymaster relayer and gasless execution |
| Delegation API | 3003 | Delegation metadata and signing helpers |
| Frontend | 3000 | React app |

Support utilities now live under `scripts/`. Legacy utilities such as `archive/legacy-services/root-scripts/start-services.sh`, `backend/legacy/`, `archive/legacy-services/`, `archive/experiments/`, and `archive/vendor/` are still present in the repo, but they are not part of the official `start-zerotoll.sh` runtime path.

Additional implementation notes and historical writeups now live under `docs/`, with older root-level notes archived in `docs/archive/root-notes/`.

Two root-level sandbox frontends, `frontend-nextjs-broken/` and `frontend-cra-backup/`, are intentionally left as gitignored local-only directories. They are not part of the official repo structure or runtime path. See `docs/LOCAL_SANDBOXES.md`.

---

## 📌 Current Status

Updated: `2026-03-31`

### Primary live path

- **ZeroToll Gasless** is still the main product path
- It uses **ERC-4337 + ZeroToll paymaster**
- On Sepolia it can deliver **native ETH** directly after internal wrapped settlement

### Confidential buildathon path

- **Confidential Gasless Intent** is live on **Sepolia**
- Browser-side encryption uses `@cofhe/sdk`
- Settlement runs through **ConfidentialIntentEscrow**
- Final delivery can unwrap to **native ETH**

Current confirmed confidential paths:

- `USDC -> ETH`: **live adapter-backed** through `SmartDexAdapter`
- `zUSDC -> ETH`: **live inventory-backed** confidential demo path on escrow

Important caveats:

- **Permit2 inputs** such as `USDC` are gasless only after a **one-time Permit2 approval**
- **ERC-2612 inputs** such as `zUSDC` are approval-free from step zero
- The confidential path is **real and on-chain**, but still **demo-oriented** and not yet a production-ready private router
- `zUSDC -> ETH` currently proves the staged confidential lifecycle, but it still settles through an **inventory-backed** path rather than a direct venue adapter

---

## 📊 Deployed Contracts

### RouterV3 + Treasury

| Network | RouterV3 | Treasury |
|---------|----------|----------|
| **Sepolia** | `0xEDEB7F0a335BdAeA933421701Ed49726649815fF` | `0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10` |
| **Amoy** | `0xD83D377E4698317731b2953854c01d39C60815d7` | `0xD6a7294445F34d0F7244b2072696106904ea807B` |

### Self-Hosted Paymaster

| Network | Address |
|---------|---------|
| **Sepolia** | `0xaf7e002447b790f212ea435f9387509cd1ef0054` |
| **Amoy** | `0xaad1211a722ee04b6980724586b6b5b7b0c86fee` |

### Confidential Intent Escrow

| Network | Address | Notes |
|---------|---------|-------|
| **Sepolia** | `0xF85F5f45dc1fDC63379d1C10B7EA5cc194cFFbe1` | Active confidential staged settlement contract |

### zTokens (ERC-2612 Permit)

| Token | Sepolia | Amoy |
|-------|---------|------|
| **zUSDC** | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` |
| **zETH** | `0x8153FA09Be1689D44C343f119C829F6702A8720b` | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` |
| **zPOL** | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` |
| **zLINK** | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` |

---

## ✅ Verified Transactions

| Flow | Network | Transaction | Status |
|------|---------|-------------|--------|
| **ZeroToll Gasless (ERC-4337)** | **Sepolia** | [0x51cea4d6...](https://sepolia.etherscan.io/tx/0x51cea4d64be4ab84f17512a8615514f89e627dba49367890bbcfec660f7f8115) | ✅ User receives native ETH |
| **Confidential USDC -> ETH** | **Sepolia** | [0x586d309a...](https://sepolia.etherscan.io/tx/0x586d309a8fb1d246aad79057ce2e1437d2bca6c2a83ba2261921199d5a51da70) | ✅ Finalized through SmartDexAdapter |
| **Confidential zUSDC -> ETH** | **Sepolia** | [0x5c426034...](https://sepolia.etherscan.io/tx/0x5c426034e235ef3bac8827747e820c1dc5764858453cc7b6cb44947b246b37a5) | ✅ Finalized through inventory-backed escrow path |

**Important:** sponsored execution gas is paid by ZeroToll, but **Permit2 setup approval** is still a user-paid one-time transaction when required. ERC-2612 inputs remain approval-free from step zero.

These verified links are the most useful judge-facing proof points today:

- **Main gasless path**: user swaps into native `ETH` without holding native gas up front
- **Confidential USDC -> ETH**: browser-side CoFHE encryption + on-chain staged settlement + native `ETH` finalization
- **Confidential zUSDC -> ETH**: approval-free encrypted input path + on-chain staged settlement + native `ETH` finalization

---

## 🗺️ Development Phases

### Phase 1: MVP ✅ COMPLETE
- Intent-based gasless swaps (ERC-4337 + EIP-712 + ERC-2612)
- Pimlico bundler + paymaster integration
- zTokens with ERC-2612 Permit
- Multi-chain support (Amoy + Sepolia)

### Phase 2: Self-Hosted Paymaster + Fee System ✅ COMPLETE
- Deployed **VerifyingPaymasterV07** on both networks
- **RouterV3** with fee support + **Treasury** contracts
- **2x gas cost** fee model (transparent, shown upfront)
- **Pyth Oracle** for real-time price feeds
- Full control over gas sponsorship (no third-party fees)

### Phase 3: Confidential Intents + Wallet Compatibility 🟡 IN PROGRESS

**Goal**: keep ERC-4337 as the core sponsor engine, while adding confidential execution on Sepolia and preserving optional wallet-native smart account UX

| Mode | Role in product | Sponsor control |
|------|-----------------|-----------------|
| **ERC-4337 + ZeroToll Paymaster** | Primary ZeroToll gasless path | ✅ ZeroToll-controlled |
| **Confidential Gasless Intent** | Sepolia buildathon path | ✅ ZeroToll-controlled |
| **Wallet-native smart account** | Optional batch UX for compatible wallets | ⚠️ Wallet-controlled |
| **Custom EIP-7702 delegation** | Experimental path for embedded / programmatic wallets | ✅ Possible, wallet-dependent |

**Live now**:
- ERC-4337 gasless remains the main ZeroToll path
- native ETH delivery works on Sepolia
- confidential staged settlement works on Sepolia
- `USDC -> ETH` confidential uses `SmartDexAdapter`
- `zUSDC -> ETH` confidential currently uses inventory-backed escrow settlement

**Still in progress**:
- remove inventory-backed confidential mixed-pair path
- replace plaintext helper assumptions in the confidential submit path
- make the confidential live path fully proof-oriented instead of partially demo-oriented
- keep smart-wallet and custom EIP-7702 support clearly secondary to the paymaster engine

**Current compatibility target**: ✅ Ethereum Sepolia, ✅ Polygon Amoy

📄 [ZeroToll Gasless Strategy](./docs/ZEROTOLL_GASLESS_STRATEGY.md)
📄 [EIP-7702 Implementation Plan](./docs/EIP7702_IMPLEMENTATION_PLAN.md)
📄 [ZeroToll x Fhenix Buildathon Fit](./docs/FHENIX_BUILDATHON_FIT.md)
📄 [ZeroToll Fhenix Direct Integration](./docs/ZEROTOLL_FHENIX_DIRECT_INTEGRATION.md)

### Phase 4: Community Pool 🔵 PLANNED

**Goal**: Fully decentralized, sustainable, community-owned paymaster

| Allocation | Percentage | Purpose |
|------------|------------|---------|
| LP Rewards | 80% | Community pool liquidity providers |
| Operations | 15% | Infrastructure, development |
| Reserve | 5% | Emergency fund |

**LP Economics (Projected)**:
- Pool Size: $10,000
- Daily Fees: $60
- Monthly LP Rewards (80%): $1,440
- Annual APR: ~173%

---

## 🔒 Security & Trust Model

### On-Chain Security Guarantees

| Protection | Implementation |
|------------|----------------|
| **Fee Cap** | Maximum 1% of swap amount (enforced in RouterV3) |
| **Slippage Protection** | `minAmountOut` verified on-chain |
| **No Replay Attacks** | Nonce + deadline in signed intent |
| **Intent Integrity** | EIP-712 signature verification |

### What Relayer CANNOT Do

- ❌ Steal user funds (signature verification)
- ❌ Charge excessive fees (1% cap in contract)
- ❌ Execute at worse price (minAmountOut protection)
- ❌ Modify intent (signature invalidation)
- ❌ Replay transactions (nonce protection)

### What Relayer CAN Do

- ✅ Choose not to execute (liveness, not security)
- ✅ See public intent data on the normal ERC-4337 path
- ⚠️ In confidential mode, the relayer still sees public metadata, but the private threshold is hidden and enforced through staged settlement

📄 [Full Trust Model & Security Analysis](./docs/TRUST_MODEL.md)

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin v5.0 |
| Backend | FastAPI (Python), Node.js (Relayer) |
| Frontend | React 18, Tailwind CSS, wagmi, viem |
| Database | MongoDB 7.0 |
| Oracles | Pyth Network (real-time prices) |
| Private Compute | Fhenix CoFHE, `@cofhe/sdk` |
| Account Abstraction | ERC-4337 (primary), wallet-native smart accounts, optional custom EIP-7702 |
| Networks | Polygon Amoy, Ethereum Sepolia |

---

## 📜 License

MIT License

---

**Built for gasless + confidential DeFi execution**

*"Making DeFi accessible without native gas, then making execution more private where it matters."*
