# ZeroToll 🚀

**True Gasless DeFi with Dynamic Fee System**

> Next-generation DeFi protocol enabling **true gasless swaps** where users pay ZERO gas.
> Swap tokens without native gas. Pay a small service fee from your input token. Fully on-chain.

> Powered by **ERC-4337 Account Abstraction**, **EIP-712 Signatures**, **ERC-2612 Permit**, and our **Self-Hosted VerifyingPaymasterV07**.

---

## ✨ What is ZeroToll?

ZeroToll is a **gasless DEX** that eliminates gas friction in DeFi through **intent-based signatures and self-hosted paymaster sponsorship**.

### Fee Model

| Feature | Description |
|---------|-------------|
| **Fee** | 2x gas cost, paid from INPUT token |
| **Transparency** | Fee shown upfront before swap |
| **Treasury** | Fees collected for LP rewards (Phase 4) |
| **Oracle** | Real-time Pyth Network prices |

### 🎯 Core Innovation: Self-Hosted ERC-4337 Paymaster

**How ZeroToll Gasless Works:**
1. User signs **ERC-2612 Permit** (approves token transfer) - NO GAS
2. User signs **EIP-712 SwapIntent** (authorizes the swap) - NO GAS  
3. ZeroToll Relayer calculates **2x gas fee** from input token
4. Our **VerifyingPaymasterV07** sponsors ALL gas costs
5. **RouterV3** executes swap and sends fee to Treasury

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

## 📊 Deployed Contracts

### RouterV3 + Treasury

| Network | RouterV3 | Treasury |
|---------|----------|----------|
| **Sepolia** | `0xB54e95a30E4Aa355380798313E0791833C7F0BFF` | `0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10` |
| **Amoy** | `0xD83D377E4698317731b2953854c01d39C60815d7` | `0xD6a7294445F34d0F7244b2072696106904ea807B` |

### Self-Hosted Paymaster

| Network | Address |
|---------|---------|
| **Sepolia** | `0xaf7e002447b790f212ea435f9387509cd1ef0054` |
| **Amoy** | `0xaad1211a722ee04b6980724586b6b5b7b0c86fee` |

### zTokens (ERC-2612 Permit)

| Token | Sepolia | Amoy |
|-------|---------|------|
| **zUSDC** | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` |
| **zETH** | `0x8153FA09Be1689D44C343f119C829F6702A8720b` | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` |
| **zPOL** | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` |
| **zLINK** | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` |

---

## ✅ Verified Gasless Transactions

| Network | Transaction | Status |
|---------|-------------|--------|
| **Amoy** | [0x463469b0...](https://amoy.polygonscan.com/tx/0x463469b0eba526a2abf2ca4049a11fc280716d8840d1c35d2aa8869501b03edf) | ✅ Success |
| **Sepolia** | [0x9ea3743d...](https://sepolia.etherscan.io/tx/0x9ea3743dd77cb83ec50ec23ba7faef56b7fd052931bee737d7b6bb16995d0ce8) | ✅ Success |

**Gas spent by user: ZERO** - All gas sponsored by ZeroToll Paymaster!

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

### Phase 3: Smart Wallet Compatibility 🔵 PLANNED

**Goal**: add wallet-native smart account UX and experimental custom EIP-7702 without replacing ZeroToll's ERC-4337 paymaster as the core gasless engine

| Mode | Role in product | Sponsor control |
|------|-----------------|-----------------|
| **ERC-4337 + ZeroToll Paymaster** | Primary ZeroToll gasless path | ✅ ZeroToll-controlled |
| **Wallet-native smart account** | Optional batch UX for compatible wallets | ⚠️ Wallet-controlled |
| **Custom EIP-7702 delegation** | Experimental path for embedded / programmatic wallets | ✅ Possible, wallet-dependent |

**Planned outcomes**:
- keep ZeroToll-sponsored gasless on ERC-4337
- support wallet-native batching where available
- support custom EIP-7702 only on wallets that expose low-level authorization signing
- avoid treating MetaMask-style smart accounts as equivalent to ZeroToll-sponsored gasless economics

**Current compatibility target**: ✅ Ethereum Sepolia, ✅ Polygon Amoy

📄 [ZeroToll Gasless Strategy](./docs/ZEROTOLL_GASLESS_STRATEGY.md)
📄 [EIP-7702 Implementation Plan](./docs/EIP7702_IMPLEMENTATION_PLAN.md)

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
- ✅ See intent before execution (Phase 3 fixes this)

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
| Account Abstraction | ERC-4337 (primary), wallet-native smart accounts, optional custom EIP-7702 |
| Networks | Polygon Amoy, Ethereum Sepolia |

---

## 📜 License

MIT License

---

**Built with ❤️ for the Polygon Buildathon**

*"Making DeFi accessible to everyone, one gasless swap at a time."*
