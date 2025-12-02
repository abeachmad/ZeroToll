# ZeroToll 🚀

**True Gasless DeFi with ERC-4337 Account Abstraction**

> Next-generation DeFi protocol enabling **true gasless swaps** where users pay ZERO gas.
> Swap tokens without native gas. Pay fees in ANY token. Fully on-chain.

> Powered by **ERC-4337 Account Abstraction**, **EIP-712 Signatures**, **ERC-2612 Permit**, and **Pimlico Paymaster**.

---

## ✨ What is ZeroToll?

ZeroToll is a **next-generation gasless DEX** that eliminates the gas friction problem in DeFi through **intent-based signatures and paymaster sponsorship**:

### 🎯 Core Innovation: ERC-4337 + EIP-712 + ERC-2612

**How It Works:**
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
- 🎫 **ERC-2612 Permit**: Gasless token approvals via signatures
- 📝 **EIP-712 Intents**: Typed structured data for secure swap authorization
- 🤖 **ERC-4337 Smart Accounts**: Relayer executes on behalf of users
- 💰 **Any-Token Fees**: Pay swap fees in USDC, DAI, WETH, or the token you're swapping
- 🔮 **LIVE Oracle Prices**: Real-time Pyth Network integration (NO hardcoded values!)
- 🌐 **Multi-Chain**: Polygon Amoy + Ethereum Sepolia testnets
- 🔐 **Fully On-Chain**: All transactions verifiable on block explorers

---

## 🎯 The Problem We Solve

Traditional DeFi has a **gas friction problem** that blocks mass adoption:

1. **Users need native tokens** (ETH, POL, MATIC) just to pay transaction fees
2. **New users get stuck**: "I have USDC but can't swap it because I need ETH first"
3. **Cross-chain is painful**: Need native tokens on EVERY chain you use
4. **Poor UX**: Having to buy native tokens from centralized exchanges defeats DeFi's purpose

**Real Example:**
> "I want to swap 100 USDC to DAI on Polygon, but I need to buy MATIC from Coinbase first just to pay $0.50 in gas fees."

**ZeroToll Solution:**
> Upgrade your EOA to smart account (EIP-7702) → Swap 100 USDC to DAI → Pay $0 gas (paymaster sponsors) → Fee deducted from output

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

That's it! No complex setup needed. 🎉

### Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | http://localhost:3000 | Landing page with overview |
| Swap | http://localhost:3000/swap | Gasless token swaps |
| Pool | http://localhost:3000/pool | Liquidity pool landing page |
| Pool Dashboard | http://localhost:3000/pool/dashboard | Full pool management UI |
| Docs | http://localhost:3000/docs | Architecture documentation |
| Market | http://localhost:3000/market | Token market data |
| History | http://localhost:3000/history | Transaction history |

### Get Testnet Tokens

- **Amoy POL**: https://faucet.polygon.technology
- **Sepolia ETH**: https://sepoliafaucet.com
- **USDC**: https://faucet.circle.com

---

## 📊 Deployed Contracts

### Polygon Amoy (ChainID: 80002) - GASLESS WORKING ✅

| Contract | Address | Explorer |
|----------|---------|----------|
| RouterHub | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` | [View](https://amoy.polygonscan.com/address/0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881) |
| **ZeroTollRouterV2** | `0xa28aB456a0434335c6953fd3A32A15A5cB12FE1A` | [View](https://amoy.polygonscan.com/address/0xa28aB456a0434335c6953fd3A32A15A5cB12FE1A) |
| **SmartDexAdapter** | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` | [View](https://amoy.polygonscan.com/address/0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84) |
| MockDEXAdapter | `0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1` | [View](https://amoy.polygonscan.com/address/0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1) |
| **ZTA (Gasless Token)** | `0x3Bead37cD9fB0E1621C8Cc2c58Ab0753085cF109` | [View](https://amoy.polygonscan.com/address/0x3Bead37cD9fB0E1621C8Cc2c58Ab0753085cF109) |
| **ZTB (Gasless Token)** | `0x9e2eE39aDaE9A4985d1aC1Fbb55830e00F686668` | [View](https://amoy.polygonscan.com/address/0x9e2eE39aDaE9A4985d1aC1Fbb55830e00F686668) |
| USDC | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | [View](https://amoy.polygonscan.com/address/0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582) |
| WPOL | `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` | [View](https://amoy.polygonscan.com/address/0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9) |

**Adapter Liquidity**: 100k ZTA + 100k ZTB (internal pool)

### Ethereum Sepolia (ChainID: 11155111) - GASLESS WORKING ✅

| Contract | Address | Explorer |
|----------|---------|----------|
| RouterHub | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` | [View](https://sepolia.etherscan.io/address/0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84) |
| **ZeroTollRouterV2** | `0xd475255Ae38C92404f9740A19F93B8D2526A684b` | [View](https://sepolia.etherscan.io/address/0xd475255Ae38C92404f9740A19F93B8D2526A684b) |
| **SmartDexAdapter** | `0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa` | [View](https://sepolia.etherscan.io/address/0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa) |
| MockDEXAdapter | `0x86D1AA2228F3ce649d415F19fC71134264D0E84B` | [View](https://sepolia.etherscan.io/address/0x86D1AA2228F3ce649d415F19fC71134264D0E84B) |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [View](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | [View](https://sepolia.etherscan.io/address/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14) |
| **ZTA (Gasless Token)** | `0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf` | [View](https://sepolia.etherscan.io/address/0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf) |
| **ZTB (Gasless Token)** | `0x8fb844251af76AF090B005643D966FC52852100a` | [View](https://sepolia.etherscan.io/address/0x8fb844251af76AF090B005643D966FC52852100a) |
| **Pimlico Smart Account** | `0x2caF80daf45581E017aaC929812b92Ad954Be2E8` | [View](https://sepolia.etherscan.io/address/0x2caF80daf45581E017aaC929812b92Ad954Be2E8) |

**Adapter Liquidity**: ~0.1 WETH + ~53 USDC

### Gasless Test Tokens (ERC-2612 Permit)

**Ethereum Sepolia:**
| Token | Address | Features |
|-------|---------|----------|
| **ZTA** | `0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf` | ERC-2612 Permit, Faucet (1000 tokens) |
| **ZTB** | `0x8fb844251af76AF090B005643D966FC52852100a` | ERC-2612 Permit, Faucet (1000 tokens) |

**Polygon Amoy:**
| Token | Address | Features |
|-------|---------|----------|
| **ZTA** | `0x3Bead37cD9fB0E1621C8Cc2c58Ab0753085cF109` | ERC-2612 Permit, Faucet (1000 tokens) |
| **ZTB** | `0x9e2eE39aDaE9A4985d1aC1Fbb55830e00F686668` | ERC-2612 Permit, Faucet (1000 tokens) |

These tokens support **100% gasless swaps** - no approval transaction needed!

### Cross-Chain Bridge Adapters

| Network | MockLayerZeroAdapter | Explorer |
|---------|---------------------|----------|
| Polygon Amoy | `0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50` | [View](https://amoy.polygonscan.com/address/0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50) |
| Ethereum Sepolia | `0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C` | [View](https://sepolia.etherscan.io/address/0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C) |

---

## ✅ Proven Gasless Transactions

**ERC-4337 + EIP-712 + ERC-2612** gasless swaps are **WORKING** on Ethereum Sepolia!

### Gasless Architecture

| Component | Standard | Purpose |
|-----------|----------|---------|
| **Smart Account** | ERC-4337 | Relayer's account that executes swaps |
| **Swap Intent** | EIP-712 | Typed signature authorizing the swap |
| **Token Permit** | ERC-2612 | Gasless token approval via signature |
| **Paymaster** | ERC-4337 | Pimlico sponsors all gas costs |

### How Users Experience It

1. **Select ZTA or ZTB** token on Sepolia
2. **Toggle "Pimlico Gasless"** ON
3. **Click Execute** - MetaMask asks for 2 signatures (NO gas prompts!)
4. **Done** - Tokens swapped, user paid $0

### Ethereum Sepolia (Intent-Based Gasless)

| Swap | TX Hash | Explorer |
|------|---------|----------|
| ZTA → ZTB | Via Pimlico UserOperation | [View on Etherscan](https://sepolia.etherscan.io/) |

**Gas spent by user: ZERO** - All gas sponsored by Pimlico paymaster!

### Legacy Transactions (Polygon Amoy)

| Swap | TX Hash | Explorer |
|------|---------|----------|
| 0.5 USDC → WPOL | `0xf1d28ea5d2fc1dd8fd6fed93df6dfa65d9d5e1daf4551696a3cd8eca83893e28` | [View](https://amoy.polygonscan.com/tx/0xf1d28ea5d2fc1dd8fd6fed93df6dfa65d9d5e1daf4551696a3cd8eca83893e28) |
| 0.3 USDC → WPOL | `0x3cab5a0a0d66478689ee5d5c8c045ef837912b211e05987879608cda41bba891` | [View](https://amoy.polygonscan.com/tx/0x3cab5a0a0d66478689ee5d5c8c045ef837912b211e05987879608cda41bba891) |

### Cross-Chain Gasless Swaps 🌉

| Route | Source TX | Destination TX |
|-------|-----------|----------------|
| Amoy USDC → Sepolia USDC | [View](https://amoy.polygonscan.com/tx/0x80be9211adb9221404d0890553e39464f22b9047b26d419578ab622c033382af) | [View](https://sepolia.etherscan.io/tx/0x462f1ff9d7778f99e47605e3286dc46dc0ad73c9e9883c8a732eaaeacf73f1bb) |

**Cross-chain architecture**: SushiXSwap-style with MockLayerZeroAdapter - gasless on source chain!

See [EIP7702_GASLESS_SUCCESS.md](./EIP7702_GASLESS_SUCCESS.md) for full transaction list.

---

## 🗺️ Roadmap

### Phase 1: MVP with Pimlico ✅ COMPLETE

**Goal**: Launch gasless swaps FAST, validate user demand

**Features**:
- ✅ Intent-based gasless swaps (ERC-4337 + EIP-712 + ERC-2612)
- ✅ Gasless swaps via Pimlico paymaster
- ✅ ZTA/ZTB test tokens with ERC-2612 Permit
- ✅ Regular swaps (user pays gas) as fallback
- ✅ Multi-chain support (Amoy + Sepolia)
- ✅ ZeroTollRouterV2 + SmartDexAdapter deployed

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

## 💰 Why Adapters Need Funds

**MockDEXAdapter** simulates a DEX for testnet purposes. It needs token reserves to:

1. **Execute swaps** - When a user swaps USDC → POL, the adapter must have POL to send back
2. **Provide liquidity** - Acts as a liquidity pool with token pairs
3. **Simulate real DEX behavior** - In production, replaced by UniswapV2/V3 adapters

### How to Fund Adapters

**Option 1: Using Scripts**
```bash
cd packages/contracts
npx hardhat run scripts/fund-from-relayer.js --network amoy
npx hardhat run scripts/fund-from-relayer.js --network sepolia
```

**Option 2: Manual Transfer**
- Send USDC to adapter address
- Send WPOL/WETH to adapter address

---

## 🏗️ Architecture

### Smart Contracts (`packages/contracts/`)

**Deployed & Working**:
- **RouterHub**: Multi-DEX routing engine with adapter whitelisting
- **MockDEXAdapter**: Testnet DEX simulator with Pyth oracle integration
- **MultiTokenPythOracle**: Real-time price feeds from Pyth Network

**Contracts (Not Yet Deployed)**:
- ZeroTollPaymaster - ERC-4337 paymaster (Phase 2)
- FeeSink, FeeVault4626, FeeRebalancer - Fee infrastructure (Phase 3)

### Backend Services (`backend/`)

- **FastAPI Server**: Quote generation, swap execution
- **Pyth Price Integration**: Real-time oracle price feeds
- **EIP-7702 Routes**: Gasless transaction handling
- **MongoDB**: Swap history persistence

### Frontend (`frontend/`)

- **Tech Stack**: React + Tailwind CSS + wagmi + viem + RainbowKit
- **Pages**: Home, Swap, History, Market, Pool, Pool Dashboard, Docs
- **EIP-7702 Features**: Smart account upgrade, gasless mode toggle
- **Pool Landing**: Educational page explaining liquidity pools with CTA to dashboard
- **Pool Dashboard**: Futuristic dark-mode UI with neon accents, APY stats, fee charts
- **Docs Page**: Interactive architecture documentation with tabbed navigation

---

## 📁 Project Structure

```
ZeroToll/
├── packages/
│   ├── contracts/          # Solidity smart contracts
│   │   ├── contracts/
│   │   │   ├── RouterHub.sol
│   │   │   ├── adapters/MockDEXAdapter.sol
│   │   │   └── oracles/MultiTokenPythOracle.sol
│   │   └── scripts/
│   ├── relayer/            # Route planning service
│   └── subgraph/           # The Graph indexing (pending)
├── backend/                # Python FastAPI server
│   ├── server.py
│   ├── eip7702_routes.py
│   └── pyth_oracle_service.py
├── frontend/               # React frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── providers/
│   └── package.json
├── start-zerotoll.sh       # 🚀 START all services
├── stop-zerotoll.sh        # 🛑 STOP all services
└── README.md
```

---

## 📖 Documentation

### In-App Documentation

Access interactive documentation directly in the app at **http://localhost:3000/docs**:
- Overview & Key Features
- System Architecture
- How Gasless Swaps Work
- Cross-Chain Architecture
- Liquidity Pools
- Security & Audits

### Technical Documents

| Document | Purpose |
|----------|---------|
| [EIP7702_GASLESS_SUCCESS.md](./EIP7702_GASLESS_SUCCESS.md) | Proof of working gasless swaps with TX hashes |
| [CROSSCHAIN_GASLESS_SWAPS.md](./docs/CROSSCHAIN_GASLESS_SWAPS.md) | Cross-chain architecture documentation |
| [SECURITY.md](./SECURITY.md) | Security policy and best practices |
| [WHY_WRAPPED_TOKENS.md](./WHY_WRAPPED_TOKENS.md) | Why WETH/WPOL instead of native tokens |
| [HOW_GASLESS_SWAPS_WORK.md](./HOW_GASLESS_SWAPS_WORK.md) | Technical explanation of gasless flow |
| [CREDENTIALS_SETUP.md](./CREDENTIALS_SETUP.md) | Setup guide for API keys and wallets |
| [SERVICE_MANAGEMENT.md](./SERVICE_MANAGEMENT.md) | Managing backend/frontend services |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Quick command reference |

---

## 🚨 Known Limitations (Testnet)

1. **MockDEXAdapter**: Simulates DEX behavior (mainnet would use Uniswap/QuickSwap)
2. **Simplified Routing**: Single-path routing (mainnet would use multi-hop)
3. **Testnet Liquidity**: Limited token availability on testnets
4. **Pimlico Dependency**: Currently relies on Pimlico for gas sponsorship

**Production deployment would include:**
- Real DEX integrations (Uniswap V3, Curve, Balancer)
- Multi-hop routing optimization
- Self-hosted paymaster infrastructure
- Real LayerZero/CCIP integration (currently using MockLayerZeroAdapter)

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin v5.0 |
| Backend | FastAPI (Python), Node.js (Pimlico Relayer) |
| Frontend | React 18, Tailwind CSS, wagmi, viem, RainbowKit |
| Oracles | Pyth Network |
| Account Abstraction | ERC-4337, Pimlico Bundler + Paymaster |
| Signatures | EIP-712 (SwapIntent), ERC-2612 (Permit) |
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

**Report Security Issues**: Please email security@zerotoll.xyz

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
- **Hardhat** - Ethereum development environment

---

**Built with ❤️ for the Polygon Buildathon**

*"Making DeFi accessible to everyone, one gasless swap at a time."*

---

**⭐ If you find ZeroToll useful, please star this repository! ⭐**


