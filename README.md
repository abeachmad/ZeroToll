# ZeroToll 🚀

**Gasless DeFi with EIP-7702 Smart Accounts**

> Next-generation DeFi protocol enabling **true gasless swaps** with EIP-7702 account upgrades.
> Swap tokens without native gas. Pay fees in ANY token. Fully on-chain.

> Powered by **EIP-7702**, **Pyth Network oracles**, and **ERC-4337 Account Abstraction**.

---

> **Polygon Buildathon Submission** - Advanced DeFi Track

---

## ✨ What is ZeroToll?

ZeroToll is a **next-generation gasless DEX** that eliminates the gas friction problem in DeFi through **EIP-7702 smart account upgrades**:

### 🎯 Core Innovation: EIP-7702 + Pimlico Paymaster

**Phase 1 (Current)**: ✅ Pimlico-powered gasless swaps - **WORKING**
**Phase 2 (Planned)**: Self-hosted paymaster with full control
**Phase 3 (Future)**: Community liquidity pool - LPs earn from gas fees

### Key Features

- ⚡ **EIP-7702 Smart Accounts**: Upgrade your EOA to smart account in one click
- 🆓 **True Gasless Swaps**: Zero native tokens required - paymaster sponsors gas
- 💰 **Any-Token Fees**: Pay swap fees in USDC, DAI, WETH, or the token you're swapping
- 🔮 **LIVE Oracle Prices**: Real-time Pyth Network integration (NO hardcoded values!)
- 🌐 **Multi-Chain**: Polygon Amoy + Ethereum Sepolia testnets
- 🌉 **Cross-Chain Swaps**: Bridge tokens between chains with gasless UX (SushiXSwap-style)
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

### Polygon Amoy (ChainID: 80002) - EIP-7702 WORKING ✅

| Contract | Address | Explorer |
|----------|---------|----------|
| RouterHub | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` | [View](https://amoy.polygonscan.com/address/0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881) |
| MockDEXAdapter | `0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1` | [View](https://amoy.polygonscan.com/address/0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1) |
| USDC | `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582` | [View](https://amoy.polygonscan.com/address/0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582) |
| WPOL | `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` | [View](https://amoy.polygonscan.com/address/0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9) |
| Smart Account | `0xEef74EB6f5eA5f869115846E9771A8551f9e4323` | [View](https://amoy.polygonscan.com/address/0xEef74EB6f5eA5f869115846E9771A8551f9e4323) |

**Adapter Liquidity**: ~11 WPOL + ~39 USDC

### Ethereum Sepolia (ChainID: 11155111) - EIP-7702 WORKING ✅

| Contract | Address | Explorer |
|----------|---------|----------|
| RouterHub | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` | [View](https://sepolia.etherscan.io/address/0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84) |
| MockDEXAdapter | `0x86D1AA2228F3ce649d415F19fC71134264D0E84B` | [View](https://sepolia.etherscan.io/address/0x86D1AA2228F3ce649d415F19fC71134264D0E84B) |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | [View](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) |
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | [View](https://sepolia.etherscan.io/address/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14) |

**Adapter Liquidity**: ~0.1 WETH + ~53 USDC

### Cross-Chain Bridge Adapters

| Network | MockLayerZeroAdapter | Explorer |
|---------|---------------------|----------|
| Polygon Amoy | `0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50` | [View](https://amoy.polygonscan.com/address/0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50) |
| Ethereum Sepolia | `0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C` | [View](https://sepolia.etherscan.io/address/0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C) |

---

## ✅ Proven Gasless Transactions

EIP-7702 gasless swaps are **WORKING** on both Polygon Amoy and Ethereum Sepolia!

### Polygon Amoy

| Swap | TX Hash | Explorer |
|------|---------|----------|
| 0.5 USDC → WPOL | `0xf1d28ea5d2fc1dd8fd6fed93df6dfa65d9d5e1daf4551696a3cd8eca83893e28` | [View](https://amoy.polygonscan.com/tx/0xf1d28ea5d2fc1dd8fd6fed93df6dfa65d9d5e1daf4551696a3cd8eca83893e28) |
| 0.3 USDC → WPOL | `0x3cab5a0a0d66478689ee5d5c8c045ef837912b211e05987879608cda41bba891` | [View](https://amoy.polygonscan.com/tx/0x3cab5a0a0d66478689ee5d5c8c045ef837912b211e05987879608cda41bba891) |
| 1.0 WPOL → USDC | `0x4d75400d9914ffb9846cfec825fd00fec67311155407dff6775c1897d3e1aa36` | [View](https://amoy.polygonscan.com/tx/0x4d75400d9914ffb9846cfec825fd00fec67311155407dff6775c1897d3e1aa36) |

### Ethereum Sepolia

| Swap | TX Hash | Explorer |
|------|---------|----------|
| 1 USDC → WETH | `0x97ad117e29444d9ff26e15ea1d25667a803a25086347f814ab8f2621553f1019` | [View](https://sepolia.etherscan.io/tx/0x97ad117e29444d9ff26e15ea1d25667a803a25086347f814ab8f2621553f1019) |
| 1 USDC → WETH | `0x0efe5fefdb17eb7fd393ed02bb5785f4f8db7ee64567eb226cd4c89dff0ed76b` | [View](https://sepolia.etherscan.io/tx/0x0efe5fefdb17eb7fd393ed02bb5785f4f8db7ee64567eb226cd4c89dff0ed76b) |
| 0.0005 WETH → USDC | `0x829f63cee7df4e8d919a97a5cea57868734a48828072b627cba622e6a431452a` | [View](https://sepolia.etherscan.io/tx/0x829f63cee7df4e8d919a97a5cea57868734a48828072b627cba622e6a431452a) |

**Gas spent by user: ZERO** - All gas sponsored by Pimlico paymaster on both networks!

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
- ✅ EIP-7702 account upgrade flow
- ✅ Gasless swaps via Pimlico paymaster
- ✅ Regular swaps (user pays gas) as fallback
- ✅ Multi-chain support (Amoy + Sepolia)
- ✅ 13+ successful gasless transactions verified

**Why Pimlico First?**
- Launch in days instead of weeks
- No infrastructure management
- Free tier for testing (1,000 UserOps/month)
- Focus on UX, not DevOps

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
| Backend | FastAPI (Python 3.9+), web3.py, MongoDB |
| Frontend | React 18, Tailwind CSS, wagmi, viem, RainbowKit |
| Oracles | Pyth Network |
| Account Abstraction | EIP-7702, ERC-4337, Pimlico |
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

## 📊 Status

| Metric | Value |
|--------|-------|
| Version | 2.3.0 |
| Status | ✅ Testnet Live (Amoy + Sepolia) |
| EIP-7702 | ✅ Working (25+ verified TX) |
| Cross-Chain | ✅ Working (Amoy ↔ Sepolia) |
| Pool Dashboard | ✅ Live (Futuristic UI) |
| Docs Page | ✅ Interactive Architecture Guide |
| Last Updated | November 28, 2025 |

---

**⭐ If you find ZeroToll useful, please star this repository! ⭐**
