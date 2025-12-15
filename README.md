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
| **Treasury** | Fees collected for LP rewards (Phase 3) |
| **Oracle** | Real-time Pyth Network prices |

### 🎯 Core Innovation: Self-Hosted ERC-4337 Paymaster

**How ZeroToll Gasless Works:**
1. User signs **ERC-2612 Permit** (approves token transfer) - NO GAS
2. User signs **EIP-712 SwapIntent** (authorizes the swap) - NO GAS  
3. ZeroToll Relayer calculates **2x gas fee** from input token
4. Our **VerifyingPaymasterV07** sponsors ALL gas costs
5. **RouterV3** executes swap and sends fee to Treasury

```
User (EOA)                    ZeroToll Relayer (port 3002)
    |                                |
    | 1. Sign Permit (ERC-2612)      |
    | 2. Sign SwapIntent (EIP-712)   |
    |------------------------------->|
    |                                | 3. Calculate fee (2x gas)
    |                                | 4. Build UserOperation
    |                                | 5. Sign with VerifyingPaymasterV07
    |                                | 6. RouterV3 executes + fee to Treasury
    |<-------------------------------|
    | Tokens swapped, $0 gas paid    |
    | Small fee deducted from input  |
```

---

## � Ecocnomic Model

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

### Phase 3 Fee Distribution (Planned)

| Allocation | Percentage | Purpose |
|------------|------------|---------|
| LP Rewards | 80% | Community pool liquidity providers |
| Operations | 15% | Infrastructure, development |
| Reserve | 5% | Emergency fund |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB 7.0+ (auto-started by script)
- pnpm

### Start All Services

```bash
# Start everything (MongoDB + Backend + Relayer + Frontend)
./start-zerotoll.sh

# Wait ~60 seconds for frontend compilation
# Then open: http://localhost:3000

# Stop everything
./stop-zerotoll.sh
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| MongoDB | 27017 | Transaction history storage |
| Python Backend | 8000 | API server, Pyth oracle quotes |
| ZeroToll Relayer | 3002 | **Self-Hosted Paymaster** + fee calculation |
| Frontend | 3000 | React app |

### Get Testnet Tokens

- **zTokens (for gasless)**: Use the in-app Faucet at `/faucet`
- **Amoy POL**: https://faucet.polygon.technology
- **Sepolia ETH**: https://sepoliafaucet.com

---

## 📊 Deployed Contracts

### RouterV3 + Treasury (Fee System)

| Network | RouterV3 | Treasury |
|---------|----------|----------|
| **Sepolia** | `0xB54e95a30E4Aa355380798313E0791833C7F0BFF` | `0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10` |
| **Amoy** | `0xD83D377E4698317731b2953854c01d39C60815d7` | `0xD6a7294445F34d0F7244b2072696106904ea807B` |

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
| Relayer EOA | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` |
| Smart Account | `0x2caF80daf45581E017aaC929812b92Ad954Be2E8` |

### zTokens (ERC-2612 Permit)

| Token | Sepolia | Amoy | Decimals |
|-------|---------|------|----------|
| **zUSDC** | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` | 6 |
| **zETH** | `0x8153FA09Be1689D44C343f119C829F6702A8720b` | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` | 18 |
| **zPOL** | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` | 18 |
| **zLINK** | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` | 18 |

---

## ✅ Verified Gasless Transactions

**Self-hosted paymaster with fee system working on both networks!**

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
- Policy server for UserOp signing
- **RouterV3** with fee support
- **Treasury** contracts for fee collection
- **2x gas cost** fee model (transparent, shown upfront)
- **Pyth Oracle** for real-time price feeds
- Full control over gas sponsorship (no third-party fees)

### Phase 3: Community Pool 🔵 PLANNED

**Goal**: Fully decentralized, sustainable, community-owned paymaster

```
┌─────────────────────────────────────────┐
│ Community Paymaster Liquidity Pool      │
├─────────────────────────────────────────┤
│ 1. PaymasterVault (ERC-4626)           │
│    - LPs deposit POL/ETH                │
│    - Earn yield from swap fees          │
│                                         │
│ 2. Treasury                            │
│    - Collects swap fees (2x gas)        │
│    - Distributes 80% to LPs             │
│                                         │
│ 3. GasRefiller (Automation)            │
│    - Auto-refills paymaster deposit     │
└─────────────────────────────────────────┘
```

**LP Economics (Projected)**:
```
Pool Size: $10,000
Daily Swaps: 10,000
Daily Fees: $60
Monthly LP Rewards (80%): $1,440
Annual APR: ~173%
```

---

## 🏗️ Architecture

### Smart Contracts

| Contract | Purpose |
|----------|---------|
| **VerifyingPaymasterV07** | Self-hosted paymaster for gas sponsorship |
| **ZeroTollRouterV3** | Router with fee support |
| **ZeroTollTreasury** | Fee collection for LP rewards |
| **zTokens** | ERC-2612 compliant test tokens |

### Backend Services

| Service | File | Purpose |
|---------|------|---------|
| API Server | `backend/server.py` | Quotes, history, stats |
| ZeroToll Relayer | `backend/phase2-relayer.mjs` | Self-hosted paymaster + fee calculation |
| Pyth Oracle | `backend/pyth_rest_oracle.py` | Real-time price feeds |

---

## 📁 Project Structure

```
ZeroToll/
├── packages/contracts/        # Solidity smart contracts
├── backend/
│   ├── server.py             # Python API server
│   ├── phase2-relayer.mjs    # Self-hosted paymaster relayer
│   └── pyth_rest_oracle.py   # Pyth price feeds
├── frontend/                  # React frontend
├── docs/
│   ├── INFRASTRUCTURE_REPORT.md
│   └── HOW_GASLESS_SWAPS_WORK.md
├── start-zerotoll.sh         # 🚀 Start all services
├── stop-zerotoll.sh          # 🛑 Stop all services
└── README.md
```

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity 0.8.24, Hardhat, OpenZeppelin v5.0 |
| Backend | FastAPI (Python), Node.js (Relayer) |
| Frontend | React 18, Tailwind CSS, wagmi, viem |
| Database | MongoDB 7.0 |
| Oracles | Pyth Network (real-time prices) |
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
