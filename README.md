# ZeroToll 🚀

**True Gasless DeFi with Self-Hosted ERC-4337 Paymaster**

> Next-generation DeFi protocol enabling **true gasless swaps** where users pay ZERO gas.
> Swap tokens without native gas. Pay fees in ANY token. Fully on-chain.

> Powered by **ERC-4337 Account Abstraction**, **EIP-712 Signatures**, **ERC-2612 Permit**, and our **Self-Hosted VerifyingPaymasterV07**.

---

## ✨ What is ZeroToll?

ZeroToll is a **gasless DEX** that eliminates gas friction in DeFi through **intent-based signatures and self-hosted paymaster sponsorship**.

### Swap Modes

| Mode | Description | User Pays Gas? |
|------|-------------|----------------|
| **Traditional** | User signs tx, pays gas | YES |
| **ZeroToll Gasless** | ERC-2612 Permit + Self-Hosted Paymaster | NO (Paymaster pays) |

### 🎯 Core Innovation: Self-Hosted ERC-4337 Paymaster

**How ZeroToll Gasless Works:**
1. User signs **ERC-2612 Permit** (approves token transfer) - NO GAS
2. User signs **EIP-712 SwapIntent** (authorizes the swap) - NO GAS
3. ZeroToll Relayer bundles into **UserOperation**
4. Our **VerifyingPaymasterV07** sponsors ALL gas costs
5. **Pimlico Bundler** submits to blockchain (infrastructure only)

```
User (EOA)                    ZeroToll Relayer (port 3002)
    |                                |
    | 1. Sign Permit (ERC-2612)      |
    | 2. Sign SwapIntent (EIP-712)   |
    |------------------------------->|
    |                                | 3. Build UserOperation
    |                                | 4. Sign with VerifyingPaymasterV07
    |                                | 5. Submit via Pimlico Bundler
    |                                | 6. Our Paymaster pays gas
    |<-------------------------------|
    | Tokens swapped, $0 gas paid    |
```

### Key Features

- ⚡ **True Gasless Swaps**: Sign 2 messages, pay ZERO gas
- 💎 **Self-Hosted Paymaster**: Full control, no third-party fees
- 🎫 **ERC-2612 Permit**: Gasless token approvals via signatures (zTokens)
- 🔄 **Permit2 Support**: Gasless approvals for standard tokens
- 📝 **EIP-712 Intents**: Typed structured data for secure swap authorization
- 🤖 **ERC-4337 Smart Accounts**: Relayer executes on behalf of users
- 🔮 **LIVE Oracle Prices**: Real-time Pyth Network integration
- 🌐 **Multi-Chain**: Polygon Amoy + Ethereum Sepolia testnets


---

## 🚀 Quick Start

### Start All Services

```bash
# Start everything (Backend + Relayer + Frontend)
./start-zerotoll.sh

# Wait ~60 seconds for frontend compilation
# Then open: http://localhost:3000

# Stop everything
./stop-zerotoll.sh
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Python Backend | 8000 | API server, Pyth oracle quotes |
| ZeroToll Relayer | 3002 | **Self-Hosted Paymaster** - gasless tx handler |
| Delegation API | 3003 | Legacy delegation support |
| Frontend | 3000 | React app |

### Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | http://localhost:3000 | Landing page |
| Swap | http://localhost:3000/swap | Gasless token swaps |
| Faucet | http://localhost:3000/faucet | Get zTokens for testing |
| History | http://localhost:3000/history | Transaction history |
| Market | http://localhost:3000/market | Token market data |

### Get Testnet Tokens

- **zTokens (for gasless)**: Use the in-app Faucet at `/faucet`
- **Amoy POL**: https://faucet.polygon.technology
- **Sepolia ETH**: https://sepoliafaucet.com

---

## 📊 Deployed Contracts

### Self-Hosted Paymaster (VerifyingPaymasterV07)

| Network | Address | Explorer |
|---------|---------|----------|
| **Sepolia** | `0xaf7e002447b790f212ea435f9387509cd1ef0054` | [View](https://sepolia.etherscan.io/address/0xaf7e002447b790f212ea435f9387509cd1ef0054) |
| **Amoy** | `0xaad1211a722ee04b6980724586b6b5b7b0c86fee` | [View](https://amoy.polygonscan.com/address/0xaad1211a722ee04b6980724586b6b5b7b0c86fee) |

### Infrastructure

| Component | Address |
|-----------|---------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| Smart Account Factory | `0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985` |
| Policy Signer | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` |
| Smart Account | `0x2caF80daf45581E017aaC929812b92Ad954Be2E8` |

### ZeroToll Router V2

| Network | Address | Explorer |
|---------|---------|----------|
| **Sepolia** | `0x577560699EF88e99f15d04df57c9552056d2a10D` | [View](https://sepolia.etherscan.io/address/0x577560699EF88e99f15d04df57c9552056d2a10D) |
| **Amoy** | `0xc75df1943d6EFE04b422b9bB45509782609Fc67a` | [View](https://amoy.polygonscan.com/address/0xc75df1943d6EFE04b422b9bB45509782609Fc67a) |

### zTokens (ERC-2612 Permit - 100% Gasless)

| Token | Sepolia | Amoy | Decimals |
|-------|---------|------|----------|
| **zUSDC** | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` | 6 |
| **zETH** | `0x8153FA09Be1689D44C343f119C829F6702A8720b` | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` | 18 |
| **zPOL** | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` | 18 |
| **zLINK** | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` | 18 |


---

## ✅ Verified Gasless Transactions

**Self-hosted paymaster working on both networks!**

| Network | Transaction | Status |
|---------|-------------|--------|
| **Amoy** | [0xd5d0965f...](https://amoy.polygonscan.com/tx/0xd5d0965f93ddca41780cf166490ee049a9349294bbce215c74b0aeb69ce15e19) | ✅ Success |
| **Amoy** | [0x429d3da7...](https://amoy.polygonscan.com/tx/0x429d3da7cc9e7206a1a748a7147dc613135bb85af2c6e6de4e0c2af11d0b3a3b) | ✅ Success |
| **Sepolia** | [0x4fd9d44...](https://sepolia.etherscan.io/tx/0x4fd9d44370ef3a1f532476b5d84480be1d461b9468173bbea9dd759459d70e19) | ✅ Success |

**Gas spent by user: ZERO** - All gas sponsored by ZeroToll Paymaster!

---

## 🗺️ Development Phases

### Phase 1: MVP with Pimlico ✅ COMPLETE

- Intent-based gasless swaps (ERC-4337 + EIP-712 + ERC-2612)
- Pimlico bundler + paymaster integration
- zTokens with ERC-2612 Permit
- Multi-chain support (Amoy + Sepolia)

### Phase 2: Self-Hosted Paymaster ✅ COMPLETE

- Deployed VerifyingPaymasterV07 on both networks
- Policy server for UserOp signing
- Full control over gas sponsorship
- No third-party paymaster fees

**Architecture:**
```
User signs permit + intent (NO GAS)
        ↓
ZeroToll Relayer (port 3002)
        ↓
VerifyingPaymasterV07 signs UserOp
        ↓
Pimlico Bundler submits to blockchain
        ↓
Our Paymaster pays gas from EntryPoint deposit
```
Benefits:

Keep 100% of fees (no vendor cut)
Full control over sponsorship logic
Privacy - no third-party tracking
Cost Savings:

Pimlico: $0.001 per UserOp → $1,000 for 1M swaps
Self-hosted: $50/month + gas → ~$500 for 1M swaps
Savings: 50% 💰

### Phase 3: Community Pool 🔵 PLANNED
Goal: Fully decentralized, sustainable, community-owned paymaster

Architecture:

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
Economic Model:

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
Benefits:

✅ Fully decentralized - No single point of failure
✅ Sustainable - Community funds itself
✅ Competitive moat - First decentralized gasless DEX
✅ Token utility - $ZEROTOLL for rewards
---

## 🏗️ Architecture

### Smart Contracts

- **VerifyingPaymasterV07**: Self-hosted paymaster for gas sponsorship
- **ZeroTollRouterV2**: Main router for gasless swaps with permit support
- **RouterHub**: Multi-DEX routing engine
- **zTokens**: ERC-2612 compliant test tokens

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| API Server | `backend/server.py` | Quotes, history, stats |
| ZeroToll Relayer | `backend/phase2-relayer.mjs` | Self-hosted paymaster handler |
| Pyth Oracle | `backend/pyth_rest_oracle.py` | Real-time price feeds |

### Frontend

- React 18 + Tailwind CSS + wagmi + viem
- Token indicators: ⚡ ERC-2612 | 🔄 Permit2 | ⚠️ Requires approval
- Gasless toggle for ZeroToll mode


---

## 📁 Project Structure

```
ZeroToll/
├── packages/contracts/     # Solidity smart contracts
├── backend/
│   ├── server.py          # Python API server
│   ├── phase2-relayer.mjs # Self-hosted paymaster relayer
│   └── pyth_rest_oracle.py
├── frontend/              # React frontend
├── docs/
│   ├── PHASE2_TECHNICAL_REPORT.md
│   └── CURRENT_CONTRACTS.md
├── start-zerotoll.sh      # 🚀 Start all services
├── stop-zerotoll.sh       # 🛑 Stop all services
└── README.md
```

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [docs/PHASE2_TECHNICAL_REPORT.md](./docs/PHASE2_TECHNICAL_REPORT.md) | Complete Phase 2 technical details |
| [docs/CURRENT_CONTRACTS.md](./docs/CURRENT_CONTRACTS.md) | Authoritative contract addresses |
| [CREDENTIALS_SETUP.md](./CREDENTIALS_SETUP.md) | API keys and wallet setup |
| [SERVICE_MANAGEMENT.md](./SERVICE_MANAGEMENT.md) | Managing services |

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin v5.0 |
| Backend | FastAPI (Python), Node.js (Relayer) |
| Frontend | React 18, Tailwind CSS, wagmi, viem |
| Oracles | Pyth Network |
| Account Abstraction | ERC-4337, VerifyingPaymasterV07 |
| Bundler | Pimlico (infrastructure only) |
| Signatures | EIP-712 (SwapIntent), ERC-2612 (Permit) |
| Networks | Polygon Amoy, Ethereum Sepolia |

---

## 🔒 Security

- ✅ OpenZeppelin battle-tested contracts
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Policy signer validation for paymaster
- ✅ SafeERC20 for all token transfers
- ✅ Input validation and slippage protection

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

- **Polygon Amoy Explorer**: https://amoy.polygonscan.com/
- **Ethereum Sepolia Explorer**: https://sepolia.etherscan.io/
- **Pyth Network**: https://pyth.network/

---

**Built with ❤️ for the Polygon Buildathon**

*"Making DeFi accessible to everyone, one gasless swap at a time."*
