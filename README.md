# ZeroToll 🚀

**True Gasless DeFi with ERC-4337 Account Abstraction**

> Next-generation DeFi protocol enabling **true gasless swaps** where users pay ZERO gas.
> Swap tokens without native gas. Pay fees in ANY token. Fully on-chain.

> Powered by **ERC-4337 Account Abstraction**, **EIP-712 Signatures**, **ERC-2612 Permit**, and **Pimlico Paymaster**.

---

## ✨ What is ZeroToll?

ZeroToll is a **next-generation gasless DEX** that eliminates the gas friction problem in DeFi through **intent-based signatures and paymaster sponsorship**.

### Three Swap Modes

| Mode | Description | User Pays Gas? |
|------|-------------|----------------|
| **Traditional** | User signs tx, pays gas | YES |
| **EIP-7702 Gasless** | Smart Account + Paymaster | NO (Paymaster pays) |
| **Pimlico Intent Gasless** | ERC-2612 Permit + Relayer | NO (Relayer pays) |

### 🎯 Core Innovation: ERC-4337 + EIP-712 + ERC-2612

**How Pimlico Intent Gasless Works:**
1. User signs **ERC-2612 Permit** (approves token transfer) - NO GAS
2. User signs **EIP-712 SwapIntent** (authorizes the swap) - NO GAS  
3. Relayer's **Smart Account** (ERC-4337) bundles and executes the swap
4. **Pimlico Paymaster** sponsors ALL gas costs

```
User (EOA)                    Relayer (Smart Account)
    |                                |
    | 1. Sign Permit (ERC-2612)      |
    | 2. Sign SwapIntent (EIP-712)   |
    |------------------------------->|
    |                                | 3. Bundle into UserOperation
    |                                | 4. Submit to Pimlico Bundler
    |                                | 5. Pimlico Paymaster pays gas
    |                                | 6. Execute on-chain
    |<-------------------------------|
    | Tokens swapped, $0 gas paid    |
```

### Key Features

- ⚡ **True Gasless Swaps**: Sign 2 messages, pay ZERO gas - Pimlico sponsors everything
- 🎫 **ERC-2612 Permit**: Gasless token approvals via signatures (zTokens)
- 🔄 **Permit2 Support**: Gasless approvals for standard tokens (USDC, WETH, LINK)
- 📝 **EIP-712 Intents**: Typed structured data for secure swap authorization
- 🤖 **ERC-4337 Smart Accounts**: Relayer executes on behalf of users
- 🔮 **LIVE Oracle Prices**: Real-time Pyth Network integration (NO hardcoded values!)
- 🌐 **Multi-Chain**: Polygon Amoy + Ethereum Sepolia testnets
- 🔐 **Fully On-Chain**: All transactions verifiable on block explorers

---

## 🎯 The Problem We Solve

Traditional DeFi has a **gas friction problem** that blocks mass adoption:

1. **Users need native tokens** (ETH, POL) just to pay transaction fees
2. **New users get stuck**: "I have USDC but can't swap it because I need ETH first"
3. **Cross-chain is painful**: Need native tokens on EVERY chain you use
4. **Poor UX**: Having to buy native tokens from centralized exchanges defeats DeFi's purpose

**ZeroToll Solution:**
> Sign 2 messages (Permit + SwapIntent) → Relayer executes swap → Pimlico pays gas → You pay $0!

---

## 🚀 Quick Start

### For Testing the DApp

```bash
# 1. Start all services (Backend + Frontend)
./start-zerotoll.sh

# Wait ~60 seconds for frontend compilation
# Then open: http://localhost:3000

# 2. When done, stop everything
./stop-zerotoll.sh
```

### Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | http://localhost:3000 | Landing page with overview |
| Swap | http://localhost:3000/swap | Gasless token swaps |
| Faucet | http://localhost:3000/faucet | Get zTokens for testing |
| Pool | http://localhost:3000/pool | Liquidity pool landing page |
| Pool Dashboard | http://localhost:3000/pool/dashboard | Full pool management UI |
| Docs | http://localhost:3000/docs | Architecture documentation |
| Market | http://localhost:3000/market | Token market data |
| History | http://localhost:3000/history | Transaction history |

### Get Testnet Tokens

- **zTokens (for gasless)**: Use the in-app Faucet at `/faucet`
- **Amoy POL**: https://faucet.polygon.technology
- **Sepolia ETH**: https://sepoliafaucet.com
- **USDC**: https://faucet.circle.com

---

## 📊 Deployed Contracts

> **Authoritative Reference**: See [docs/CURRENT_CONTRACTS.md](./docs/CURRENT_CONTRACTS.md) for complete contract details.

### Polygon Amoy (ChainID: 80002) ✅ GASLESS WORKING

| Contract | Address | Explorer |
|----------|---------|----------|
| **ZeroTollRouterV2** | `0xc75df1943d6EFE04b422b9bB45509782609Fc67a` | [View](https://amoy.polygonscan.com/address/0xc75df1943d6EFE04b422b9bB45509782609Fc67a) |
| RouterHub | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` | [View](https://amoy.polygonscan.com/address/0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881) |
| SmartDexAdapter | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` | [View](https://amoy.polygonscan.com/address/0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84) |
| ZeroTollAdapter | `0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87` | [View](https://amoy.polygonscan.com/address/0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87) |
| MockDEXAdapter | `0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1` | [View](https://amoy.polygonscan.com/address/0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1) |

### Ethereum Sepolia (ChainID: 11155111) ✅ GASLESS WORKING

| Contract | Address | Explorer |
|----------|---------|----------|
| **ZeroTollRouterV2** | `0x577560699EF88e99f15d04df57c9552056d2a10D` | [View](https://sepolia.etherscan.io/address/0x577560699EF88e99f15d04df57c9552056d2a10D) |
| RouterHub | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` | [View](https://sepolia.etherscan.io/address/0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84) |
| SmartDexAdapter | `0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa` | [View](https://sepolia.etherscan.io/address/0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa) |
| ZeroTollAdapter | `0x4E6A591459F0724E19f9B06A584B26fFB724a2a3` | [View](https://sepolia.etherscan.io/address/0x4E6A591459F0724E19f9B06A584B26fFB724a2a3) |
| MockDEXAdapter | `0x86D1AA2228F3ce649d415F19fC71134264D0E84B` | [View](https://sepolia.etherscan.io/address/0x86D1AA2228F3ce649d415F19fC71134264D0E84B) |
| Smart Account | `0x2caF80daf45581E017aaC929812b92Ad954Be2E8` | [View](https://sepolia.etherscan.io/address/0x2caF80daf45581E017aaC929812b92Ad954Be2E8) |

### zTokens (ERC-2612 Permit - Best Gasless Experience)

| Token | Sepolia | Amoy | Decimals |
|-------|---------|------|----------|
| **zUSDC** | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` | 6 |
| **zETH** | `0x8153FA09Be1689D44C343f119C829F6702A8720b` | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` | 18 |
| **zPOL** | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` | 18 |
| **zLINK** | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` | 18 |

These tokens support **100% gasless swaps** - no approval transaction needed!

---

## ✅ Proven Gasless Transactions

**All three swap modes are WORKING on both Sepolia and Amoy!**

### Latest Verified Transactions

| Network | Mode | Transaction |
|---------|------|-------------|
| **Sepolia** | Pimlico Intent Gasless | [0x4fd9d44...](https://sepolia.etherscan.io/tx/0x4fd9d44370ef3a1f532476b5d84480be1d461b9468173bbea9dd759459d70e19) ✅ |
| **Amoy** | Pimlico Intent Gasless | [0x6db7e41...](https://amoy.polygonscan.com/tx/0x6db7e4162ee0a38ba0d3c4c211f6d4a29984d028ab5d1e2b230a027b087af148) ✅ |

**Gas spent by user: ZERO** - All gas sponsored by Pimlico paymaster!

### Gasless Architecture

| Component | Standard | Purpose |
|-----------|----------|---------|
| **Smart Account** | ERC-4337 | Relayer's account that executes swaps |
| **Swap Intent** | EIP-712 | Typed signature authorizing the swap |
| **Token Permit** | ERC-2612 | Gasless token approval via signature |
| **Paymaster** | ERC-4337 | Pimlico sponsors all gas costs |

### How Users Experience It

1. **Select a zToken** (zUSDC, zETH, zPOL, zLINK)
2. **Toggle "Pimlico Gasless"** ON
3. **Click Execute** - MetaMask asks for 2 signatures (NO gas prompts!)
4. **Done** - Tokens swapped, user paid $0

---

## 🗺️ Roadmap

### Phase 1: MVP with Pimlico ✅ COMPLETE

**Goal**: Launch gasless swaps FAST, validate user demand

**Features**:
- ✅ Intent-based gasless swaps (ERC-4337 + EIP-712 + ERC-2612)
- ✅ Gasless swaps via Pimlico paymaster
- ✅ zTokens (zUSDC, zETH, zPOL, zLINK) with ERC-2612 Permit
- ✅ Permit2 support for standard tokens (USDC, WETH, LINK)
- ✅ Regular swaps (user pays gas) as fallback
- ✅ Multi-chain support (Amoy + Sepolia)
- ✅ ZeroTollRouterV2 with adapter fallback chain
- ✅ Pyth oracle integration for real-time pricing

**Technical Stack**:
- **ERC-4337**: Account Abstraction for Smart Accounts
- **EIP-712**: Typed structured data signing for SwapIntent
- **ERC-2612**: Permit standard for gasless token approvals
- **Pimlico**: Bundler + Verifying Paymaster

**Why This Architecture?**
- Works on ALL chains (no EIP-7702 dependency)
- Users sign messages, never send transactions
- Pimlico sponsors 100% of gas costs
- Simple UX: 2 signatures = swap complete

---

### Phase 2: Self-Hosted Paymaster 🔄 PLANNED

**Goal**: Reduce costs, gain control, prepare for decentralization

**Architecture**:
```
┌─────────────────────────────────────────┐
│ ZeroToll Self-Hosted Paymaster Stack    │
├─────────────────────────────────────────┤
│ 1. Bundler (Infinitism - exists)        │
│ 2. ZeroTollPaymaster (contract exists)  │
│ 3. Policy Server (built)                │
│ 4. Gas Tank (new - auto-refill)         │
└─────────────────────────────────────────┘
```

**Benefits**:
- Keep 100% of fees (no vendor cut)
- Full control over sponsorship logic
- Privacy - no third-party tracking

**Cost Savings**:
- Pimlico: $0.001 per UserOp → $1,000 for 1M swaps
- Self-hosted: $50/month + gas → ~$500 for 1M swaps
- **Savings: 50%** 💰

---

### Phase 3: Community Liquidity Pool 🔵 FUTURE

**Goal**: Fully decentralized, sustainable, community-owned paymaster

**Architecture**:
```
┌─────────────────────────────────────────┐
│ Community Paymaster Liquidity Pool      │
├─────────────────────────────────────────┤
│ 1. PaymasterVault (ERC-4626)           │
│    - LPs deposit POL/ETH                │
│    - Earn yield from gas fees           │
│    - Withdraw anytime                   │
│                                         │
│ 2. GasRefiller (Automation)            │
│    - Converts swap fees → native token │
│    - Auto-refills paymaster             │
│                                         │
│ 3. Rewards Distributor                 │
│    - Distributes $ZEROTOLL tokens       │
│    - Bonus for long-term LPs            │
└─────────────────────────────────────────┘
```

**Economic Model**:
```
Example: 10,000 gasless swaps/day

Gas cost per swap: $0.001
Daily gas cost: $10
Monthly gas cost: $300

Fee collected (0.5% on $100 avg swap): $0.50
Daily fee revenue: $5,000
Monthly fee revenue: $150,000

LP Pool needed: $1,000 (covers 3 months gas)
Protocol takes 80%: $120,000
LPs get 20%: $30,000
LP APR: 3,000% 🤯
```

**Benefits**:
- ✅ **Fully decentralized** - No single point of failure
- ✅ **Sustainable** - Community funds itself
- ✅ **Competitive moat** - First decentralized gasless DEX
- ✅ **Token utility** - $ZEROTOLL for rewards

---

## 🏗️ Architecture

### Smart Contracts (`packages/contracts/`)

- **ZeroTollRouterV2**: Main router for gasless swaps with permit support
- **RouterHub**: Multi-DEX routing engine with adapter whitelisting
- **SmartDexAdapter**: Primary adapter with Uniswap V3 + internal pool fallback
- **ZeroTollAdapter**: Fallback adapter for zToken swaps with Pyth oracle
- **MockDEXAdapter**: Testnet DEX simulator
- **zTokens**: ERC-2612 compliant test tokens (zUSDC, zETH, zPOL, zLINK)

### Backend Services (`backend/`)

- **FastAPI Server**: Quote generation, swap execution
- **Pyth Price Integration**: Real-time oracle price feeds
- **Pimlico Relayer**: ERC-4337 gasless transaction handling (`pimlico-v3-relayer.mjs`)

### Frontend (`frontend/`)

- **Tech Stack**: React + Tailwind CSS + wagmi + viem + RainbowKit
- **Swap Modes**: Traditional, EIP-7702 Gasless, Pimlico Intent Gasless
- **Token Indicators**: ⚡ ERC-2612 | 🔄 Permit2 | ⚠️ Requires approval
- **Faucet Page**: Get zTokens for testing gasless swaps

---

## 📁 Project Structure

```
ZeroToll/
├── packages/
│   ├── contracts/          # Solidity smart contracts
│   │   ├── contracts/
│   │   │   ├── ZeroTollRouterV2.sol
│   │   │   ├── RouterHub.sol
│   │   │   ├── adapters/
│   │   │   │   ├── SmartDexAdapter.sol
│   │   │   │   ├── ZeroTollAdapter.sol
│   │   │   │   └── MockDEXAdapter.sol
│   │   │   └── tokens/ZeroTollToken.sol
│   │   └── scripts/
│   └── relayer/            # Route planning service
├── backend/                # Python FastAPI + Node.js relayer
│   ├── server.py
│   ├── pimlico-v3-relayer.mjs
│   └── pyth_oracle_service.py
├── frontend/               # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Swap.jsx
│   │   │   └── Faucet.jsx
│   │   ├── hooks/
│   │   │   └── useIntentGasless.js
│   │   └── providers/
├── docs/
│   ├── CURRENT_CONTRACTS.md    # Authoritative contract reference
│   └── GASLESS_SWAP_ARCHITECTURE.md
├── start-zerotoll.sh       # 🚀 START all services
├── stop-zerotoll.sh        # 🛑 STOP all services
└── README.md
```

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [docs/CURRENT_CONTRACTS.md](./docs/CURRENT_CONTRACTS.md) | **Authoritative contract addresses** |
| [docs/GASLESS_SWAP_ARCHITECTURE.md](./docs/GASLESS_SWAP_ARCHITECTURE.md) | Complete architecture plan |
| [EIP7702_GASLESS_SUCCESS.md](./EIP7702_GASLESS_SUCCESS.md) | Proof of working gasless swaps |
| [HOW_GASLESS_SWAPS_WORK.md](./HOW_GASLESS_SWAPS_WORK.md) | Technical explanation |
| [CREDENTIALS_SETUP.md](./CREDENTIALS_SETUP.md) | API keys and wallet setup |
| [SERVICE_MANAGEMENT.md](./SERVICE_MANAGEMENT.md) | Managing services |

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin v5.0 |
| Backend | FastAPI (Python), Node.js (Pimlico Relayer) |
| Frontend | React 18, Tailwind CSS, wagmi, viem, RainbowKit |
| Oracles | Pyth Network |
| Account Abstraction | ERC-4337, Pimlico Bundler + Paymaster |
| Signatures | EIP-712 (SwapIntent), ERC-2612 (Permit), Permit2 |
| Networks | Polygon Amoy, Ethereum Sepolia |

---

## 🔒 Security

### Current Measures

- ✅ OpenZeppelin battle-tested contracts
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Adapter whitelisting (only owner can add DEXes)
- ✅ SafeERC20 for all token transfers
- ✅ Emergency token recovery functions
- ✅ Input validation and slippage protection

### Before Mainnet

- ⏳ Third-party security audit
- ⏳ Bug bounty program
- ⏳ Multi-sig governance

---

## 🤝 Contributing

1. Fork the Repository
2. Create a Feature Branch: `git checkout -b feature/amazing-feature`
3. Commit Changes: `git commit -m 'Add amazing feature'`
4. Push to Branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

MIT License - See [LICENSE](./LICENSE) file for details.

---

## 🔗 Links

- **GitHub**: https://github.com/abeachmad/ZeroToll
- **Polygon Amoy Explorer**: https://amoy.polygonscan.com/
- **Ethereum Sepolia Explorer**: https://sepolia.etherscan.io/
- **Pyth Network**: https://pyth.network/

---

## 🙏 Acknowledgments

- **Polygon** - Polygon Buildathon and testnet infrastructure
- **Pimlico** - ERC-4337 bundler and paymaster services
- **OpenZeppelin** - Secure smart contract libraries
- **Pyth Network** - Real-time oracle price feeds

---

**Built with ❤️ for the Polygon Buildathon**

*"Making DeFi accessible to everyone, one gasless swap at a time."*
