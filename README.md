# ZeroToll 🚀# ZeroToll 🚀# ZeroToll 🚀



**Gasless DeFi with LIVE Oracle Prices - Zero Hardcoded Values**



> Multi-testnet DeFi protocol enabling gasless token swaps with ANY-token fee payments.  **Swap tokens without gas. Pay fees in ANY token. Fully on-chain.****Zero native gas. Smarter cross-chain swaps with AI-powered routing.**

> Powered by Pyth Network oracles, ERC-4337 Account Abstraction, and smart routing.



---

> **Polygon Buildathon Submission** - Advanced DeFi Track  > **Polygon Buildathon Submission** - Advanced DeFi Track  

## ✨ What is ZeroToll?

> A gasless token swap protocol powered by relayer infrastructure and smart routing> Enabling gasless cross-chain DeFi with intelligent route optimization and LP yield generation

ZeroToll eliminates the gas friction problem in DeFi:



- ⚡ **No Native Gas Required**: Swap without ETH/POL - pay fees in ANY token

- 🔮 **LIVE Oracle Prices**: Real-time Pyth Network integration (NO hardcoded values!)---ZeroToll is a next-generation DeFi protocol that eliminates gas friction across 4 testnets. Users execute swaps and bridges without native tokens, paying fees in ANY token via ERC-4337 Account Abstraction. AI-powered routing finds optimal multi-DEX paths, while LPs earn yield from protocol fees through an ERC-4626 vault.

- 🌐 **Multi-Testnet**: Ethereum Sepolia + Polygon Amoy support

- 🔄 **Smart Routing**: Optimized swap paths across multiple DEX adapters

- 🏦 **On-Chain Settlement**: Fully verifiable, permissionless architecture

## 🎯 The Problem## ✨ Key Features

**Problem Solved:**  

Users no longer need to buy native tokens (ETH/MATIC) just to pay transaction fees. Swap your USDC → WETH and pay the swap fee in USDC itself!



---Traditional DeFi has a **gas friction problem**:- ⚡ **Gasless Transactions**: No ETH/MATIC required. ERC-4337 paymaster + relayer network fronts gas costs



## 🚀 Quick Start (2 Commands!)- 🤖 **AI Route Optimization**: Multi-DEX aggregation with intelligent path selection saves 10-50 bps vs. single-DEX



### For Testing the DApp1. **Users need native tokens** (ETH, POL, MATIC) just to pay transaction fees- 🌐 **Multi-Chain Support**: Seamless swaps across Sepolia, Amoy, Arbitrum Sepolia, Optimism Sepolia



```bash2. **New users get stuck**: "I have USDC but can't swap it because I need ETH first"- � **Any-Token Fees**: Pay swap fees in USDC, DAI, WETH, or the token you're swapping

# 1. Start all services (MongoDB + Backend + Frontend)

./start-zerotoll.sh3. **Cross-chain is painful**: Need native tokens on EVERY chain you use- 🏦 **LP Yield Vault**: ERC-4626 compliant vault with automatic fee rebalancing and APR tracking



# Wait ~60 seconds for frontend compilation4. **Poor UX**: Having to buy native tokens from centralized exchanges defeats DeFi's purpose- � **Fully On-Chain**: All transactions verifiable on block explorers (critical for DeFi trust)

# Then open: http://localhost:3000



# 2. When done, stop everything

./stop-zerotoll.sh**Real Example**: ## 🏗️ Architecture

```

> "I want to swap 100 USDC to DAI on Polygon, but I need to buy MATIC from Coinbase first just to pay $0.50 in gas fees."

That's it! No complex setup needed. 🎉

### Smart Contracts (`packages/contracts/`)

---

This friction **blocks mass adoption** of DeFi.

## 📊 What's Currently Working

**Core Infrastructure**

### ✅ PRODUCTION READY (Testnet)

---- **RouterHub**: Multi-DEX routing engine with adapter whitelisting and slippage protection

**Deployed Contracts:**

- **Sepolia Testnet**- **ZeroTollPaymaster**: ERC-4337 paymaster enabling gasless transactions via relayer network

  - RouterHub: `0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd`

  - MockDEXAdapter (with Pyth): `0x23e2B44bC22F9940F9eb00C6C674039ed291821F`## 💡 The Solution: ZeroToll- **FeeSink**: Fee collection hub with automatic treasury routing

  - MultiTokenPythOracle: `0x1240c97bc33f7635b8e25C721fF6D05d2bfC44Db`

  

- **Polygon Amoy Testnet**

  - RouterHub: `0x5335f887E69F4B920bb037062382B9C17aA52ec6`ZeroToll eliminates gas friction through a **relayer-powered architecture**:**Advanced Features**

  - MockDEXAdapter (with Pyth): `0x2Ed51974196EC8787a74c00C5847F03664d66Dc5`

  - MultiTokenPythOracle: `0x14BfA9bdf75a2c8049C826B63EeEf6ED7F52E838`- **FeeVault4626**: ERC-4626 compliant yield vault for LPs (60% fees → LPs, 40% → treasury)



**Features Live:**- ✅ **No native tokens required** - Users only need the tokens they want to swap- **FeeRebalancer**: Auto-converts collected fee tokens to USDC for vault deposits

- ✅ Token swaps with LIVE Pyth Network prices (ETH/USD, POL/USD, USDC/USD)

- ✅ ANY-token fee payments (pay swap fees in USDC, WETH, WPOL, etc.)- ✅ **Relayers pay gas upfront** - Transaction fees paid by relayer infrastructure- **DEX Adapters**: UniswapV2Adapter, UniswapV3Adapter, MockDEXAdapter for low liquidity scenarios

- ✅ Smart routing with whitelisted adapters

- ✅ Slippage protection- ✅ **Fees deducted from swap** - Users pay fees in the tokens they're already swapping- **Bridge Adapters**: MockBridgeAdapter for cross-chain message passing

- ✅ On-chain price verification

- ✅ Zero hardcoded values (100% oracle-powered)- ✅ **Fully on-chain** - All transactions verifiable on block explorers



---- ✅ **Multi-chain support** - Works across Polygon Amoy & Ethereum Sepolia testnets### Backend Services (`backend/`)



## 🏗️ Architecture



### Smart Contracts (`packages/contracts/`)**Simple Example**:- **FastAPI Server**: Quote generation, swap execution, transaction relaying



**Core Infrastructure:**```- **Web3 Transaction Builder**: Builds, signs, and sends REAL blockchain transactions (no more mocks!)

```

RouterHubTraditional DEX:- **Route Planner Client**: Communicates with TypeScript route service for multi-DEX optimization

├─ Multi-DEX routing engine

├─ Adapter whitelistingUser needs: 100 USDC + 2 MATIC (for gas) → Get 95 DAI- **Pyth Price Integration**: Real-time oracle price feeds with 15-second batch optimization

├─ Slippage protection

└─ Fee collectionProblem: Where do I get MATIC?- **MongoDB**: Swap history persistence with explorer URL tracking



MockDEXAdapter (Testnet)

├─ Queries MultiTokenPythOracle

├─ Uses LIVE Pyth Network pricesZeroToll:### Relayer Services (`packages/relayer/`)

├─ Simulates DEX swaps

└─ Zero hardcoded prices ✅User needs: 100 USDC only → Get 95 DAI (fee deducted from output)



MultiTokenPythOracleSolution: Relayer pays gas, user pays fee in tokens!- **Route Planner**: Multi-DEX aggregation scoring routes by price + gas + slippage

├─ Integrates with Pyth Network

├─ Supports multiple price feeds```- **Pyth Batcher**: Optimizes oracle updates with content-based caching

├─ Real-time price updates

└─ Cryptographically verified prices- **Intent Executor**: (Future) Full ERC-4337 bundler integration

```

---

**Oracle Integration:**

- Sepolia Pyth: `0xDd24F84d36BF92C65F92307595335bdFab5Bbd21`### AI Intelligence (`packages/ai/`)

- Amoy Pyth: `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729`

- Price Feeds: ETH/USD, POL/USD, USDC/USD (all from [Pyth Network](https://pyth.network))## 🏗️ How It Works (For Everyone)



### Backend (`backend/`)- **Route Scorer**: ONNX-based ML model for route ranking



**Python FastAPI Service:**### The Players- **Risk Guard**: Slippage and MEV risk assessment

```python

# Real-time oracle price queries- **(Pending)** Express service with `/scoreRoutes` and `/riskScore` endpoints

PythOracleService

├─ Queries MultiTokenPythOracle on-chainThink of ZeroToll like a restaurant delivery service:

├─ Returns LIVE prices for swap quotes

└─ No manual price updates needed ✅### Subgraph (`packages/subgraph/`)



# Swap execution| Role | What They Do | Example |

server.py

├─ /api/quote - Get swap quote|------|--------------|---------|- **Entities**: GasSponsoredEvent, FeeToVault, AIRouteChosen

├─ /api/swap - Execute swap

├─ /api/stats - Protocol stats| 👤 **User** | Wants to swap tokens (but has no gas) | You want to swap 100 USDC → DAI |- **Metrics**: Gas saved, refund rate, TVL, APR, AI win-rate

└─ MongoDB for history tracking

```| 🚚 **Relayer** | Delivers your transaction (pays gas upfront) | Like Uber Eats paying for gas to deliver your food |- **(Pending)** Deployment to The Graph Studio



### Frontend (`frontend/`)| 🎯 **RouterHub** | The "kitchen" that processes swaps | Coordinates the actual token exchange |



**React + Tailwind + wagmi:**| 🔄 **Adapter** | Connects to DEXes (Uniswap, etc.) | Gets the best rate from different exchanges |### Frontend (`frontend/`)

```

src/| 👷 **Deployer** | Built the system (one-time setup) | Like the restaurant owner who built the kitchen |

├── pages/

│   ├── Home.jsx          # Landing page- **Tech Stack**: React + Tailwind CSS + wagmi + viem + RainbowKit

│   ├── Swap.jsx          # Main swap interface

│   ├── History.jsx       # Transaction history### The Flow (Step-by-Step)- **Pages**: 

│   └── Market.jsx        # Price feeds

├── components/  - Home: Protocol introduction

│   ├── ConnectButton     # Wallet connection

│   ├── LiveMetrics       # Real-time stats```  - Swap: Quote generation with AI route badge

│   └── FeeModeExplainer  # ANY-token fee explanation

└── providers/STEP 1: User Requests Swap  - Vault: LP deposit/withdraw with TVL/APR metrics

    └── Web3Provider      # RainbowKit + wagmi

```┌─────────────────────────────────────┐  - Portfolio: Swap history with CSV export



---│ User (0x5a87...)                    │  - Market: Token prices and liquidity data



## 🧪 Testing Guide│ "I want to swap 1 USDC → POL"       │- **Components**: ConnectButton, AIRouteBadge, LiveMetrics, FeeModeExplainer



### Prerequisites│ (Has USDC, but NO POL for gas!)     │



1. **MetaMask** installed with testnet networks added└─────────────────────────────────────┘## 🚀 Quick Start

2. **Testnet Tokens** from faucets:

   - Sepolia ETH: https://sepoliafaucet.com            │

   - Amoy POL: https://faucet.polygon.technology

   - USDC: https://faucet.circle.com            │ HTTP Request to Backend### For Users (Testing the DApp)

   - WETH/WPOL: Wrap your native tokens

            ▼

### Step-by-Step Testing

STEP 2: Backend Processes1. **Get Testnet Tokens**

**1. Start the Application**

```bash┌─────────────────────────────────────┐   - Faucets: [Sepolia](https://sepoliafaucet.com) | [Amoy](https://faucet.polygon.technology) | [Arbitrum](https://faucet.arbitrum.io) | [Optimism](https://app.optimism.io/faucet)

./start-zerotoll.sh

# Wait for "✅ Backend ready"│ Backend Server                      │   - Get USDC from [Circle Faucet](https://faucet.circle.com/) or [Aave Staging](https://staging.aave.com/faucet/)

# Frontend compiles in ~30-60 seconds

```│ - Calculates best route             │



**2. Connect Wallet**│ - Encodes transaction               │2. **Start the Application**

- Open http://localhost:3000

- Click "Connect Wallet"│ - Signs with Relayer key            │   ```bash

- Select MetaMask

- Switch to Sepolia or Amoy network└─────────────────────────────────────┘   # Quick start (both backend + frontend)



**3. Execute a Swap**            │   ./start-zerotoll.sh

- Navigate to "Swap" page

- Select: WETH → USDC (Sepolia) or WPOL → USDC (Amoy)            │ Submit Transaction   

- Enter amount: 0.1 WETH

- Click "Get Quote"            ▼   # Or manually:

- **Verify price matches Pyth Network** (https://pyth.network/price-feeds/crypto-eth-usd)

- Click "Approve WETH" (if needed)STEP 3: Relayer Submits TX   # Terminal 1 - Backend

- Click "Execute Swap"

- Confirm in MetaMask┌─────────────────────────────────────┐   cd backend && python server.py

- Wait for confirmation

│ Relayer Wallet (0xf304...)          │   

**4. Verify on Block Explorer**

- Sepolia: https://sepolia.etherscan.io│ - Pays gas fee (0.001 POL)          │   # Terminal 2 - Frontend

- Amoy: https://amoy.polygonscan.com

- Check your address for the swap transaction│ - Calls RouterHub contract          │   cd frontend && npm start

- Verify USDC balance increased

│ - On-chain transaction starts!      │   ```

**5. Check Transaction History**

- Navigate to "History" page└─────────────────────────────────────┘

- See your completed swap

            │3. **Test a Swap**

---

            │ executeRoute()   - Open http://localhost:3000

## 📁 Project Structure

            ▼   - Connect wallet (MetaMask recommended)

```

ZeroToll/STEP 4: RouterHub Coordinates   - Switch to Sepolia network

├── packages/

│   └── contracts/          # Solidity smart contracts┌─────────────────────────────────────┐   - Try swapping: 10 USDC → DAI

│       ├── contracts/

│       │   ├── RouterHub.sol│ RouterHub Contract (0x63db...)      │   - Click "Execute Swap"

│       │   ├── adapters/MockDEXAdapter.sol

│       │   └── oracles/MultiTokenPythOracle.sol│ ① Takes 1 USDC from user            │   - **CRITICAL**: Verify transaction on [Sepolia Etherscan](https://sepolia.etherscan.io)

│       └── scripts/        # Deployment scripts

├── backend/                # Python FastAPI server│ ② Sends 1 USDC to Adapter           │

│   ├── server.py

│   ├── pyth_oracle_service.py│ ③ Calls Adapter.swap()              │4. **Test Vault Deposits**

│   └── requirements.txt

├── frontend/               # React frontend│ ④ Receives ~1 POL back              │   - Navigate to "Vault" page

│   ├── src/

│   │   ├── pages/│ ⑤ Sends POL to relayer              │   - Deposit 100 USDC

│   │   ├── components/

│   │   └── providers/└─────────────────────────────────────┘   - Earn yield from protocol fees

│   └── package.json

├── start-zerotoll.sh      # 🚀 START all services            │   - Withdraw anytime (ERC-4626 standard)

├── stop-zerotoll.sh       # 🛑 STOP all services

└── README.md              # This file            │ swap()

```

            ▼### For Developers (Full Deployment)

---

STEP 5: Adapter Executes Swap

## 📝 Documentation

┌─────────────────────────────────────┐**Prerequisites**: Node.js 18+, Python 3.9+, Hardhat, MongoDB

| Document | Purpose |

|----------|---------|│ MockDEXAdapter (0x7caF...)          │

| [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) | Latest deployment info & migration summary |

| [ZERO_HARDCODE_AUDIT_FINAL.md](./ZERO_HARDCODE_AUDIT_FINAL.md) | Comprehensive code audit & fixes |│ - Receives 1 USDC                   │1. **Clone & Install**

| [NATIVE_TOKEN_SOLUTION.md](./NATIVE_TOKEN_SOLUTION.md) | Why we use wrapped tokens (architecture decision) |

| [WHY_WRAPPED_TOKENS.md](./WHY_WRAPPED_TOKENS.md) | Technical deep dive into ERC20 vs native |│ - Swaps USDC → POL (1:1 rate)       │   ```bash

| [LIVE_TEST_GUIDE.md](./LIVE_TEST_GUIDE.md) | Detailed testing instructions |

| [CLEANUP_SUMMARY.md](./CLEANUP_SUMMARY.md) | File cleanup & simplification (Nov 9, 2025) |│ - Sends 1 POL back to RouterHub     │   git clone https://github.com/yourusername/ZeroToll.git

| [SECURITY.md](./SECURITY.md) | Security best practices |

└─────────────────────────────────────┘   cd ZeroToll

---

            │   pnpm install  # Installs all workspace packages

## 🔧 Development Setup (Advanced)

            │ Result   ```

### Prerequisites

```bash            ▼

# Required

Node.js 18+STEP 6: User Gets Tokens!2. **Configure Environment**

Python 3.9+

MongoDB┌─────────────────────────────────────┐   ```bash

Hardhat

│ ✅ Success!                          │   cp .env.example .env

# Optional

pnpm (or npm/yarn)│ User received: ~1 POL               │   # Edit .env with your keys:

```

│ Gas paid by: Relayer                │   # - PRIVATE_KEY_DEPLOYER (needs testnet ETH)

### Manual Installation

│ User paid: Only USDC (no gas!)      │   # - RELAYER_PRIVATE_KEY (will sign transactions)

**1. Clone Repository**

```bash│ Transaction: Verified on-chain      │   # - RPC URLs (Alchemy recommended)

git clone https://github.com/abeachmad/ZeroToll.git

cd ZeroToll└─────────────────────────────────────┘   # - Block explorer API keys

```

```   ```

**2. Install Contract Dependencies**

```bash

cd packages/contracts

npm install### Why This Architecture?3. **Check Balances**

```

   ```bash

**3. Install Backend Dependencies**

```bash**Q: Why can't users swap directly?**     chmod +x scripts/check-balances.sh

cd ../../backend

python3 -m venv venvA: They don't have native tokens (POL/ETH) to pay gas fees!   ./scripts/check-balances.sh

source venv/bin/activate

pip install -r requirements.txt   # Ensure deployer has ~0.5 ETH on each chain

```

**Q: Why does the relayer help?**     ```

**4. Install Frontend Dependencies**

```bashA: Relayers have native tokens and submit transactions on behalf of users. They get compensated through fees.

cd ../frontend

yarn install4. **Deploy Contracts**

```

**Q: Why RouterHub as middleman?**     ```bash

**5. Configure Environment**

```bashA: For security, fee management, and supporting multiple DEX adapters. It's the trusted coordinator.   chmod +x deploy-zerotoll.sh

# Backend .env file

cd ../backend   ./deploy-zerotoll.sh

cp .env.example .env

# Edit .env with your values:**Q: Why does Adapter send tokens back to RouterHub instead of directly to user?**     # Select option 1: Deploy to all networks

# - SEPOLIA_PYTH_ORACLE=0x1240c97...

# - AMOY_PYTH_ORACLE=0x14BfA9...A: Architecture design - RouterHub manages all token flows, tracks fees, and ensures security. Think of it as the "escrow manager".   # This deploys to Sepolia, Amoy, Arbitrum Sepolia, Optimism Sepolia

# - Private keys for testing

```   ```



**6. Start Services (Manual)****Q: Is this really gasless for users?**  

```bash

# Terminal 1 - MongoDBA: YES! Users only approve token spending (1 signature). Relayer pays ALL gas costs.5. **Update Configuration**

sudo mongod --dbpath /data/db --logpath /tmp/mongodb.log --bind_ip 127.0.0.1 --fork

   ```bash

# Terminal 2 - Backend

cd backend---   node scripts/update-contract-addresses.js

source venv/bin/activate

uvicorn server:app --host 0.0.0.0 --port 8000 --reload   # Auto-updates frontend/src/config/contracts.json



# Terminal 3 - Frontend## 🏗️ Technical Architecture   # Copy displayed addresses to backend/.env

cd frontend

yarn start   ```



# Or use the automated script:### Core Components

./start-zerotoll.sh

```6. **Start Services**



---#### 1. Smart Contracts (On-Chain)   ```bash



## 🎯 Key Technical Achievements   # Backend



### 1. Zero Hardcoded Values ✅**RouterHub** - The Central Coordinator   cd backend

**Before:** Adapters had hardcoded prices (e.g., `2000 * 1e8` for ETH)  

**After:** All prices fetched from Pyth Network in real-time- Address (Amoy): `0x63db4Ac855DD552947238498Ab5da561cce4Ac0b`   pip install -r requirements.txt



### 2. Live Oracle Integration ✅- Address (Sepolia): `0x1449279761a3e6642B02E82A7be9E5234be00159`   python server.py  # Runs on :8000

**Implementation:**

```solidity- Role: Manages token flows, whitelists adapters, enforces security   

// MultiTokenPythOracle.sol

function getPrice(address token) external view returns (uint256) {- Key Functions:   # Frontend

    bytes32 priceId = tokenToPriceFeed[token];

    PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);  - `executeRoute()` - Main swap execution   cd frontend

    return uint256(uint64(price.price));  // LIVE from Pyth Network ✅

}  - `whitelistAdapter()` - Owner adds trusted DEX adapters   npm install

```

  - `recoverERC20()` - Emergency token recovery   npm start  # Runs on :3000

### 3. Smart Adapter Migration ✅

- OLD adapters used TestnetPriceOracle (manual prices)   

- NEW adapters use MultiTokenPythOracle (Pyth Network)

- Funds rescued from old adapters via owner `withdrawFunds()`**MockDEXAdapter** - DEX Interface   # Route Planner (optional)

- NEW adapters whitelisted and funded

- Address (Amoy): `0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`   cd packages/relayer

### 4. Clean Codebase ✅

- Removed 56 obsolete files (70% reduction)- Address (Sepolia): `0x2Ed51974196EC8787a74c00C5847F03664d66Dc5`   npm install

- 2 simple scripts: `start-zerotoll.sh` + `stop-zerotoll.sh`

- 12 essential docs (clear purpose for each)- Role: Simulates DEX swaps (1:1 rate for testing)   npm start  # Runs on :3001



---- Key Functions:   ```



## 🚨 Known Limitations (Testnet)  - `swap()` - Executes token swap, returns to RouterHub



1. **MockDEXAdapter**: Simulates DEX behavior (mainnet would use Uniswap/QuickSwap)  - Holds token reserves (13 USDC + native tokens)7. **Run E2E Tests**

2. **Simplified Routing**: Single-path routing (mainnet would use multi-hop)

3. **Testnet Liquidity**: Limited token availability on testnets   ```bash

4. **No Paymaster Yet**: Users still pay gas (ERC-4337 integration planned)

> **Note**: MockDEXAdapter simulates a DEX for testnet. In production, we'd use UniswapV2Adapter or UniswapV3Adapter that call real DEX contracts.   # Follow E2E_TESTING_CHECKLIST.md

**These are intentional testnet simplifications. Production deployment would include:**

- Real DEX integrations (Uniswap V3, Curve, Balancer)   # Verify ALL transactions appear on block explorers

- Multi-hop routing optimization

- ERC-4337 Paymaster for true gasless transactions**Other Contracts** (Advanced Features)   ```

- Cross-chain bridges (LayerZero/Axelar integration)

- `FeeSink` - Collects protocol fees

---

- `FeeEscrow` - Holds fees for distribution**Full deployment guide**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🤝 Contributing

- `AssetRegistry` - Token whitelist management

This project was built for the Polygon Buildathon. Contributions welcome!

- `ZeroTollPaymaster` - ERC-4337 paymaster (future: Account Abstraction)## 📊 Deployed Contracts

### Development Workflow

```bash

# 1. Create feature branch

git checkout -b feature/your-feature#### 2. Backend Services (Off-Chain)> **Status**: 🟡 Pending Deployment (scripts ready)



# 2. Make changes

# 3. Test locally

./start-zerotoll.sh**FastAPI Server** (`backend/server.py`)### After Deployment, Addresses Will Be:

# Run tests

- REST API for swap quotes and execution

# 4. Commit

git add .- Endpoints:**Ethereum Sepolia (ChainID: 11155111)**

git commit -m "feat: your feature description"

  - `POST /api/swap/execute` - Execute swap transaction- RouterHub: `TBD`

# 5. Push

git push origin feature/your-feature  - `GET /api/swap/quote` - Get swap quote- FeeSink: `TBD`



# 6. Create Pull Request on GitHub  - `GET /api/swap/history` - Transaction history- FeeVault4626: `TBD`

```

- Responsibilities:- FeeRebalancer: `TBD`

---

  - Build transaction data- UniswapV2Adapter: `TBD`

## 📜 License

  - Sign with relayer private key- Explorer: https://sepolia.etherscan.io

MIT License - See LICENSE file for details

  - Submit to blockchain

---

  - Track transaction status**Polygon Amoy (ChainID: 80002)**

## 🙏 Acknowledgments

- RouterHub: `TBD`

- **Pyth Network**: Real-time oracle price feeds

- **Polygon**: Amoy testnet infrastructure**Route Planner** (`backend/route_client.py`)- FeeSink: `TBD`

- **Ethereum**: Sepolia testnet infrastructure

- **OpenZeppelin**: Secure smart contract libraries- Calculates optimal swap routes- FeeVault4626: `TBD`

- **RainbowKit**: Wallet connection UX

- **Hardhat**: Smart contract development framework- Manages adapter addresses- FeeRebalancer: `TBD`



---- Handles multi-hop routing (future)- QuickSwapAdapter: `TBD`



## 📞 Support- Explorer: https://amoy.polygonscan.com



- **Documentation**: See `/docs` folder and markdown files in root**Blockchain Service** (`backend/real_blockchain_service.py`)

- **Issues**: https://github.com/abeachmad/ZeroToll/issues

- **Discussion**: GitHub Discussions- Direct Web3 interactions**Arbitrum Sepolia (ChainID: 421614)**



---- Transaction building and signing- RouterHub: `TBD`



## 🎉 Quick Links- Gas estimation- FeeSink: `TBD`



- 🌐 **Live Demo**: http://localhost:3000 (after running `./start-zerotoll.sh`)- Event monitoring- FeeVault4626: `TBD`

- 📊 **Pyth Network Prices**: https://pyth.network/price-feeds

- 🔍 **Sepolia Explorer**: https://sepolia.etherscan.io- UniswapV3Adapter: `TBD`

- 🔍 **Amoy Explorer**: https://amoy.polygonscan.com

- 💧 **Faucets**: #### 3. Frontend (User Interface)- Explorer: https://sepolia.arbiscan.io

  - Sepolia: https://sepoliafaucet.com

  - Amoy: https://faucet.polygon.technology

  - USDC: https://faucet.circle.com

**React Application** (`frontend/`)**Optimism Sepolia (ChainID: 11155420)**

---

- Tech Stack: React + Tailwind CSS + wagmi + RainbowKit- RouterHub: `TBD`

**Built with ❤️ for the Polygon Buildathon**

- Pages:- FeeSink: `TBD`

*Last Updated: November 9, 2025*

  - **Home** - Protocol introduction- FeeVault4626: `TBD`

  - **Swap** - Main swap interface- UniswapV3Adapter: `TBD`

  - **History** - Transaction history with explorer links- Explorer: https://sepolia-optimism.etherscan.io

  - **Market** - Token prices and data

- Features:**Previous Deployment (Legacy)**

  - Wallet connection (MetaMask, WalletConnect)- Amoy RouterHub: `0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127`

  - Real-time price quotes- Sepolia RouterHub: `0x19091A6c655704c8fb55023635eE3298DcDf66FF`

  - Transaction status tracking

  - Multi-chain network switching### Running the Application



#### 4. Wallet Management```bash

# Quick start (recommended)

**Deployer Wallet**cd /home/abeachmad/ZeroToll

- Address: `0x330A86eE67bA0Da0043EaD201866A32d362C394c`bash start-dev.sh

- Role: Deployed all smart contracts (one-time)

- Owns: RouterHub, Adapters, Fee contracts# Or manually:

- Key Location: `packages/contracts/.env` → `PRIVATE_KEY_DEPLOYER`# Terminal 1: Backend

cd backend

**Relayer Wallet**./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 &

- Address: `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A`

- Role: Submits transactions, pays gas fees# Terminal 2: Frontend

- Has: Native tokens (POL/ETH) + USDC reservescd frontend

- Key Location: `backend/.env` → `RELAYER_PRIVATE_KEY`yarn start

```

**User Wallet** (Testing)

- Address: `0x5a87A3c738cf99DB95787D51B627217B6dE12F62`### Access the App

- Role: Test user with USDC tokens- Frontend: http://localhost:3000

- Has: 10 USDC on both Amoy & Sepolia- Backend API: http://localhost:8000

- Key Location: Provided for testing only

### Test the Features

---

1. **Connect Wallet**: Click "Connect Wallet" and select MetaMask

## 📊 Live Deployment2. **Get Testnet Tokens**:

   - Polygon Amoy POL: https://faucet.polygon.technology/

### ✅ Currently Deployed (Fully Working)   - Ethereum Sepolia ETH: https://sepoliafaucet.com/

3. **Test Price Calculation**:

**Polygon Amoy Testnet** (ChainID: 80002)   - ETH → POL: 0.01 ETH = ~205 POL (real Pyth prices)

- RouterHub: [`0x63db4Ac855DD552947238498Ab5da561cce4Ac0b`](https://amoy.polygonscan.com/address/0x63db4Ac855DD552947238498Ab5da561cce4Ac0b)   - LINK → POL: 30 LINK = ~3896 POL

- MockDEXAdapter: [`0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`](https://amoy.polygonscan.com/address/0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7)4. **Test Fee Modes**: NATIVE, INPUT, OUTPUT, STABLE

- Deployer: [`0x330A86eE67bA0Da0043EaD201866A32d362C394c`](https://amoy.polygonscan.com/address/0x330A86eE67bA0Da0043EaD201866A32d362C394c)5. **Test Native Unwrap**: Select POL or ETH as output

- Version: v1.3

- Status: ✅ **LIVE & FUNDED**### Documentation

- Adapter Reserves: 13 USDC + 14.7 WPOL

📚 **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Complete documentation index

**Ethereum Sepolia Testnet** (ChainID: 11155111)

- RouterHub: [`0x1449279761a3e6642B02E82A7be9E5234be00159`](https://sepolia.etherscan.io/address/0x1449279761a3e6642B02E82A7be9E5234be00159)Quick links:

- MockDEXAdapter: [`0x2Ed51974196EC8787a74c00C5847F03664d66Dc5`](https://sepolia.etherscan.io/address/0x2Ed51974196EC8787a74c00C5847F03664d66Dc5)- **[QUICK_START.md](QUICK_START.md)**: Setup and testing guide

- Deployer: [`0x330A86eE67bA0Da0043EaD201866A32d362C394c`](https://sepolia.etherscan.io/address/0x330A86eE67bA0Da0043EaD201866A32d362C394c)- **[TESTING_GUIDE.md](TESTING_GUIDE.md)**: Complete test checklist

- Version: v1.2.1- **[STATUS.md](STATUS.md)**: Current deployment status

- Status: ✅ **LIVE & FUNDED**- **[DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md)**: Contract addresses

- Adapter Reserves: 13 USDC + 0.05 WETH

## Brand Assets

### Recent Transactions (Proof of Functionality)

- Logo: `/apps/web/public/logo.svg`

**Adapter Funding Transactions:**- Logo mark: `/apps/web/public/logo-mark.svg`

- Amoy USDC Transfer: [`0x23e5b8a7...`](https://amoy.polygonscan.com/tx/0x23e5b8a721036fd9bf9cccd5f64df2aa648f33a1788930ba7f1df62cff01bb66)- Favicon: `/apps/web/public/favicon.svg`

- Amoy WPOL Transfer: [`0x51f8ad04...`](https://amoy.polygonscan.com/tx/0x51f8ad0405c2544238cf3d71fd8c834352e255892261969028edfab831a1bc29)

- Sepolia USDC Transfer: [`0xc39a78bd...`](https://amoy.polygonscan.com/tx/0xc39a78bddfa5155116029e195e76eef65ba3c34f77de5f73205a5b379b20d9ad)**Colors:**

- Sepolia WETH Transfer: [`0x0c80608b...`](https://sepolia.etherscan.io/tx/0x0c80608b4e772daddf8615990dd194316a876bb5d4a3555e0c19687b45a89f42)- Midnight Ink: `#0B0D12`

- Electric Violet: `#7A4DFF`

All contracts verified on block explorers! ✅- Aquamarine: `#44E0C6`

- Off-White: `#F5F7FA`

---

## Networks

## 🚀 Quick Start (Testing)

- **Polygon Amoy**: ChainID 80002 (testnet)

### Prerequisites- **Ethereum Sepolia**: ChainID 11155111 (testnet)



- Node.js 18+ and Python 3.9+## Tech Stack

- Git and basic terminal knowledge

- MetaMask or similar Web3 wallet- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin

- **Backend**: FastAPI (Python), MongoDB

### 1. Clone the Repository- **Frontend**: React, Tailwind CSS, wagmi, viem, RainbowKit

- **Relayer**: Node.js, viem

```bash- **Indexing**: The Graph

git clone https://github.com/abeachmad/ZeroToll.git

cd ZeroToll## License

```

MIT

### 2. Install Dependencies

## Links

```bash

# Install all packages (monorepo)- [Polygon Docs](https://docs.polygon.technology)

pnpm install- [ERC-4337 Docs](https://eips.ethereum.org/EIPS/eip-4337)

- [The Graph](https://thegraph.com)

# Or npm/yarn

npm install---

# yarn install

```---



### 3. Set Up Environment Variables## Current Features



```bash### ✅ Working

# Backend environment- Real-time price quotes from Pyth oracle

cd backend- All 4 fee modes (NATIVE, INPUT, OUTPUT, STABLE)

cp .env.example .env- Native token support (POL, ETH) with auto wrap/unwrap

- Cross-chain routing (Amoy ↔ Sepolia)

# Edit .env with your settings:- 19 supported tokens across both chains

# - RELAYER_PRIVATE_KEY (for submitting transactions)- Wallet connection with proper z-index layering

# - RPC URLs (use Alchemy or Infura)- Token swap button with animation

# - MongoDB connection (optional, for history)- Responsive UI with glass effects

```

### ⚠️ Demo Mode

**Example `.env` for Backend:**- Execute swap returns mock success (UI demo)

```env- For real on-chain swaps: integrate with RouterHub contract

# Relayer Configuration- History page requires MongoDB or The Graph

RELAYER_PRIVATE_KEY=your_private_key_here

RELAYER_ADDRESS=your_relayer_address---



# RPC Endpoints**Status**: ✅ Wave-2 testnet demo ready (Amoy ↔ Sepolia)

AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY**Version**: 2.0.0

SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY**Last Updated**: 2024-11-03


# Contract Addresses (Already configured!)
ROUTER_HUB_AMOY=0x63db4Ac855DD552947238498Ab5da561cce4Ac0b
ROUTER_HUB_SEPOLIA=0x1449279761a3e6642B02E82A7be9E5234be00159

# MongoDB (Optional)
MONGODB_URI=mongodb://localhost:27017/zerotoll
```

### 4. Start the Application

**Option A: Quick Start (Recommended)**
```bash
cd /home/abeachmad/ZeroToll
./live-test.sh

# Choose option 1: Full Stack (Backend + Frontend)
```

**Option B: Manual Start**
```bash
# Terminal 1: Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python server.py
# Backend runs on http://localhost:8000

# Terminal 2: Frontend
cd frontend
npm install
npm start
# Frontend runs on http://localhost:3000
```

### 5. Get Test Tokens

You'll need testnet USDC to test swaps:

**Polygon Amoy:**
1. Get POL from [Polygon Faucet](https://faucet.polygon.technology/)
2. Get test USDC from [Circle Faucet](https://faucet.circle.com/) or swap POL → USDC on a testnet DEX

**Ethereum Sepolia:**
1. Get ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
2. Get test USDC from [Circle Faucet](https://faucet.circle.com/)

### 6. Test a Swap

1. **Open the App**: http://localhost:3000
2. **Connect Wallet**: Click "Connect Wallet" and select MetaMask
3. **Switch Network**: Change to Polygon Amoy or Ethereum Sepolia
4. **Go to Swap Page**: Navigate to the Swap interface
5. **Enter Swap Details**:
   - From: 0.5 USDC
   - To: POL (on Amoy) or ETH (on Sepolia)
6. **Approve Token**: First transaction approves USDC spending
7. **Execute Swap**: Second transaction executes the swap
8. **Verify On-Chain**: Check transaction on [Amoy PolygonScan](https://amoy.polygonscan.com/) or [Sepolia Etherscan](https://sepolia.etherscan.io/)

### Expected Result

✅ **Successful Swap Flow:**
1. Approval transaction succeeds (user signs)
2. Swap transaction succeeds (relayer pays gas)
3. User receives output tokens (POL/ETH)
4. Transaction visible on block explorer
5. No errors about "Adapter not whitelisted" or "insufficient allowance"

---

## 🧪 For Developers (Full Setup)

### Deploy Your Own Contracts

1. **Configure Deployment**
```bash
cd packages/contracts
cp .env.example .env

# Edit .env:
# - PRIVATE_KEY_DEPLOYER (needs ~0.5 testnet ETH/POL)
# - RPC URLs
# - Block explorer API keys (for verification)
```

2. **Deploy to Amoy**
```bash
npx hardhat run scripts/deploy-amoy-pyth.js --network amoy
```

3. **Deploy to Sepolia**
```bash
npx hardhat run scripts/deploy-sepolia-pyth.js --network sepolia
```

4. **Verify Contracts**
```bash
npx hardhat verify --network amoy ROUTER_HUB_ADDRESS
npx hardhat verify --network amoy ADAPTER_ADDRESS
```

5. **Update Configuration**
   - Copy deployed addresses to `frontend/src/config/contracts.json`
   - Update `backend/.env` with new addresses
   - Update `backend/route_client.py` with adapter addresses

### Fund Your Adapters

MockDEXAdapter needs token reserves to simulate swaps:

```bash
cd packages/contracts
npx hardhat run scripts/fund-from-relayer.js --network amoy
npx hardhat run scripts/fund-from-relayer.js --network sepolia
```

This funds each adapter with:
- 10 USDC
- 5 wrapped native tokens (WPOL/WETH)

### Run Tests

```bash
# Smart contract tests
cd packages/contracts
npx hardhat test

# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

---

## 📖 Documentation

### For Judges & Reviewers

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Deep dive into system design
- **[SECURITY.md](./SECURITY.md)** - Security considerations and audits
- **[DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)** - Current deployment state
- **[DEBUGGING_COMPLETE.md](./docs/DEBUGGING_COMPLETE.md)** - Bug fixes and improvements

### For Users

- **[QUICK_START.md](./QUICK_START.md)** - Fast setup guide
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - How to test the system
- **[FAQ.md](./docs/FAQ.md)** - Common questions

### For Developers

- **[DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)** - Deploy your own instance
- **[API.md](./docs/API.md)** - Backend API reference
- **[CONTRACTS.md](./docs/CONTRACTS.md)** - Smart contract documentation

---

## 🎨 Tech Stack

### Smart Contracts
- **Language**: Solidity 0.8.24
- **Framework**: Hardhat
- **Libraries**: OpenZeppelin Contracts v5.0
- **Networks**: Polygon Amoy, Ethereum Sepolia

### Backend
- **Framework**: FastAPI (Python 3.9+)
- **Web3**: web3.py, eth-account
- **Database**: MongoDB (optional, for history)
- **APIs**: Pyth Network (price feeds)

### Frontend
- **Framework**: React 18
- **Styling**: Tailwind CSS
- **Web3**: wagmi, viem, RainbowKit
- **Wallet**: MetaMask, WalletConnect

### Infrastructure
- **RPC Providers**: Alchemy, Infura
- **Block Explorers**: PolygonScan, Etherscan
- **Version Control**: Git, GitHub

---

## 🏆 Key Achievements

### ✅ What's Working

1. **Fully On-Chain Swaps**
   - Real smart contract deployments on 2 testnets
   - Verified contracts on block explorers
   - Live transactions viewable on-chain

2. **Gasless User Experience**
   - Users only need swap tokens (no native tokens)
   - Relayer infrastructure pays gas
   - Fees deducted from swap output

3. **Multi-Chain Support**
   - Polygon Amoy testnet integration
   - Ethereum Sepolia testnet integration
   - Shared codebase for easy expansion

4. **Production-Ready Architecture**
   - Modular adapter system (extensible to real DEXes)
   - Security: Adapter whitelisting, reentrancy guards
   - Error handling and recovery mechanisms

5. **Developer Experience**
   - Comprehensive documentation
   - Easy deployment scripts
   - Testing infrastructure
   - Monorepo structure with pnpm workspaces

### 🚧 Future Roadmap

1. **Real DEX Integration**
   - UniswapV2Adapter for actual DEX swaps
   - UniswapV3Adapter with concentrated liquidity
   - Multi-hop routing optimization

2. **Account Abstraction (ERC-4337)**
   - Full Paymaster implementation
   - Bundler integration
   - Meta-transactions

3. **Advanced Features**
   - LP Yield Vault (ERC-4626)
   - Cross-chain bridges
   - AI-powered route optimization
   - MEV protection

4. **Production Deployment**
   - Mainnet deployment (Polygon, Ethereum)
   - Security audits
   - Bug bounty program
   - Liquidity bootstrapping

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

- ⏳ Third-party security audit (pending)
- ⏳ Bug bounty program launch
- ⏳ Formal verification of critical contracts
- ⏳ Multi-sig governance for contract ownership

**Report Security Issues**: Please email security@zerotoll.xyz (do not open public issues for vulnerabilities)

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the Repository**
2. **Create a Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass
- Sign commits with GPG

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

---

## 🔗 Links

- **Live Demo**: http://localhost:3000 (after setup)
- **GitHub**: https://github.com/abeachmad/ZeroToll
- **Documentation**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)
- **Polygon Amoy Explorer**: https://amoy.polygonscan.com/
- **Ethereum Sepolia Explorer**: https://sepolia.etherscan.io/

---

## 👥 Team

**ZeroToll** is built for the Polygon Buildathon 2024/2025.

- Lead Developer: [@abeachmad](https://github.com/abeachmad)
- Smart Contracts: Solidity + Hardhat
- Backend: FastAPI + Web3.py
- Frontend: React + Tailwind

---

## 🙏 Acknowledgments

- **Polygon** - For the Polygon Buildathon and amazing testnet infrastructure
- **OpenZeppelin** - For secure, audited smart contract libraries
- **Hardhat** - For the best Ethereum development environment
- **Pyth Network** - For real-time oracle price feeds
- **The Graph** - For blockchain indexing (coming soon)
- **Alchemy** - For reliable RPC infrastructure

---

## 📞 Contact

- **GitHub Issues**: [Report bugs or request features](https://github.com/abeachmad/ZeroToll/issues)
- **Email**: abeachmad@example.com
- **Twitter**: [@ZeroTollDeFi](https://twitter.com/ZeroTollDeFi)

---

**Built with ❤️ for the Polygon Buildathon**

*"Making DeFi accessible to everyone, one gasless swap at a time."*

---

## 📊 Status

- **Version**: 2.0.0
- **Status**: ✅ Testnet Live (Amoy + Sepolia)
- **Last Updated**: November 6, 2025
- **Deployment**: Verified contracts on 2 testnets
- **Backend**: FastAPI server with real blockchain integration
- **Frontend**: React app with wallet connection
- **Testing**: End-to-end swap flow working

---

## 🎯 Quick Links

| Resource | Link |
|----------|------|
| Live App | http://localhost:3000 (after setup) |
| Amoy RouterHub | [0x63db4Ac855DD552947238498Ab5da561cce4Ac0b](https://amoy.polygonscan.com/address/0x63db4Ac855DD552947238498Ab5da561cce4Ac0b) |
| Sepolia RouterHub | [0x1449279761a3e6642B02E82A7be9E5234be00159](https://sepolia.etherscan.io/address/0x1449279761a3e6642B02E82A7be9E5234be00159) |
| Documentation | [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) |
| Quick Start | [QUICK_START.md](./QUICK_START.md) |
| Testing Guide | [TESTING_GUIDE.md](./TESTING_GUIDE.md) |

---

**⭐ If you find ZeroToll useful, please star this repository! ⭐**
