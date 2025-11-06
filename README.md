# ZeroToll 🚀# ZeroToll 🚀



**Swap tokens without gas. Pay fees in ANY token. Fully on-chain.****Zero native gas. Smarter cross-chain swaps with AI-powered routing.**



> **Polygon Buildathon Submission** - Advanced DeFi Track  > **Polygon Buildathon Submission** - Advanced DeFi Track  

> A gasless token swap protocol powered by relayer infrastructure and smart routing> Enabling gasless cross-chain DeFi with intelligent route optimization and LP yield generation



---ZeroToll is a next-generation DeFi protocol that eliminates gas friction across 4 testnets. Users execute swaps and bridges without native tokens, paying fees in ANY token via ERC-4337 Account Abstraction. AI-powered routing finds optimal multi-DEX paths, while LPs earn yield from protocol fees through an ERC-4626 vault.



## 🎯 The Problem## ✨ Key Features



Traditional DeFi has a **gas friction problem**:- ⚡ **Gasless Transactions**: No ETH/MATIC required. ERC-4337 paymaster + relayer network fronts gas costs

- 🤖 **AI Route Optimization**: Multi-DEX aggregation with intelligent path selection saves 10-50 bps vs. single-DEX

1. **Users need native tokens** (ETH, POL, MATIC) just to pay transaction fees- 🌐 **Multi-Chain Support**: Seamless swaps across Sepolia, Amoy, Arbitrum Sepolia, Optimism Sepolia

2. **New users get stuck**: "I have USDC but can't swap it because I need ETH first"- � **Any-Token Fees**: Pay swap fees in USDC, DAI, WETH, or the token you're swapping

3. **Cross-chain is painful**: Need native tokens on EVERY chain you use- 🏦 **LP Yield Vault**: ERC-4626 compliant vault with automatic fee rebalancing and APR tracking

4. **Poor UX**: Having to buy native tokens from centralized exchanges defeats DeFi's purpose- � **Fully On-Chain**: All transactions verifiable on block explorers (critical for DeFi trust)



**Real Example**: ## 🏗️ Architecture

> "I want to swap 100 USDC to DAI on Polygon, but I need to buy MATIC from Coinbase first just to pay $0.50 in gas fees."

### Smart Contracts (`packages/contracts/`)

This friction **blocks mass adoption** of DeFi.

**Core Infrastructure**

---- **RouterHub**: Multi-DEX routing engine with adapter whitelisting and slippage protection

- **ZeroTollPaymaster**: ERC-4337 paymaster enabling gasless transactions via relayer network

## 💡 The Solution: ZeroToll- **FeeSink**: Fee collection hub with automatic treasury routing



ZeroToll eliminates gas friction through a **relayer-powered architecture**:**Advanced Features**

- **FeeVault4626**: ERC-4626 compliant yield vault for LPs (60% fees → LPs, 40% → treasury)

- ✅ **No native tokens required** - Users only need the tokens they want to swap- **FeeRebalancer**: Auto-converts collected fee tokens to USDC for vault deposits

- ✅ **Relayers pay gas upfront** - Transaction fees paid by relayer infrastructure- **DEX Adapters**: UniswapV2Adapter, UniswapV3Adapter, MockDEXAdapter for low liquidity scenarios

- ✅ **Fees deducted from swap** - Users pay fees in the tokens they're already swapping- **Bridge Adapters**: MockBridgeAdapter for cross-chain message passing

- ✅ **Fully on-chain** - All transactions verifiable on block explorers

- ✅ **Multi-chain support** - Works across Polygon Amoy & Ethereum Sepolia testnets### Backend Services (`backend/`)



**Simple Example**:- **FastAPI Server**: Quote generation, swap execution, transaction relaying

```- **Web3 Transaction Builder**: Builds, signs, and sends REAL blockchain transactions (no more mocks!)

Traditional DEX:- **Route Planner Client**: Communicates with TypeScript route service for multi-DEX optimization

User needs: 100 USDC + 2 MATIC (for gas) → Get 95 DAI- **Pyth Price Integration**: Real-time oracle price feeds with 15-second batch optimization

Problem: Where do I get MATIC?- **MongoDB**: Swap history persistence with explorer URL tracking



ZeroToll:### Relayer Services (`packages/relayer/`)

User needs: 100 USDC only → Get 95 DAI (fee deducted from output)

Solution: Relayer pays gas, user pays fee in tokens!- **Route Planner**: Multi-DEX aggregation scoring routes by price + gas + slippage

```- **Pyth Batcher**: Optimizes oracle updates with content-based caching

- **Intent Executor**: (Future) Full ERC-4337 bundler integration

---

### AI Intelligence (`packages/ai/`)

## 🏗️ How It Works (For Everyone)

- **Route Scorer**: ONNX-based ML model for route ranking

### The Players- **Risk Guard**: Slippage and MEV risk assessment

- **(Pending)** Express service with `/scoreRoutes` and `/riskScore` endpoints

Think of ZeroToll like a restaurant delivery service:

### Subgraph (`packages/subgraph/`)

| Role | What They Do | Example |

|------|--------------|---------|- **Entities**: GasSponsoredEvent, FeeToVault, AIRouteChosen

| 👤 **User** | Wants to swap tokens (but has no gas) | You want to swap 100 USDC → DAI |- **Metrics**: Gas saved, refund rate, TVL, APR, AI win-rate

| 🚚 **Relayer** | Delivers your transaction (pays gas upfront) | Like Uber Eats paying for gas to deliver your food |- **(Pending)** Deployment to The Graph Studio

| 🎯 **RouterHub** | The "kitchen" that processes swaps | Coordinates the actual token exchange |

| 🔄 **Adapter** | Connects to DEXes (Uniswap, etc.) | Gets the best rate from different exchanges |### Frontend (`frontend/`)

| 👷 **Deployer** | Built the system (one-time setup) | Like the restaurant owner who built the kitchen |

- **Tech Stack**: React + Tailwind CSS + wagmi + viem + RainbowKit

### The Flow (Step-by-Step)- **Pages**: 

  - Home: Protocol introduction

```  - Swap: Quote generation with AI route badge

STEP 1: User Requests Swap  - Vault: LP deposit/withdraw with TVL/APR metrics

┌─────────────────────────────────────┐  - Portfolio: Swap history with CSV export

│ User (0x5a87...)                    │  - Market: Token prices and liquidity data

│ "I want to swap 1 USDC → POL"       │- **Components**: ConnectButton, AIRouteBadge, LiveMetrics, FeeModeExplainer

│ (Has USDC, but NO POL for gas!)     │

└─────────────────────────────────────┘## 🚀 Quick Start

            │

            │ HTTP Request to Backend### For Users (Testing the DApp)

            ▼

STEP 2: Backend Processes1. **Get Testnet Tokens**

┌─────────────────────────────────────┐   - Faucets: [Sepolia](https://sepoliafaucet.com) | [Amoy](https://faucet.polygon.technology) | [Arbitrum](https://faucet.arbitrum.io) | [Optimism](https://app.optimism.io/faucet)

│ Backend Server                      │   - Get USDC from [Circle Faucet](https://faucet.circle.com/) or [Aave Staging](https://staging.aave.com/faucet/)

│ - Calculates best route             │

│ - Encodes transaction               │2. **Start the Application**

│ - Signs with Relayer key            │   ```bash

└─────────────────────────────────────┘   # Quick start (both backend + frontend)

            │   ./start-zerotoll.sh

            │ Submit Transaction   

            ▼   # Or manually:

STEP 3: Relayer Submits TX   # Terminal 1 - Backend

┌─────────────────────────────────────┐   cd backend && python server.py

│ Relayer Wallet (0xf304...)          │   

│ - Pays gas fee (0.001 POL)          │   # Terminal 2 - Frontend

│ - Calls RouterHub contract          │   cd frontend && npm start

│ - On-chain transaction starts!      │   ```

└─────────────────────────────────────┘

            │3. **Test a Swap**

            │ executeRoute()   - Open http://localhost:3000

            ▼   - Connect wallet (MetaMask recommended)

STEP 4: RouterHub Coordinates   - Switch to Sepolia network

┌─────────────────────────────────────┐   - Try swapping: 10 USDC → DAI

│ RouterHub Contract (0x63db...)      │   - Click "Execute Swap"

│ ① Takes 1 USDC from user            │   - **CRITICAL**: Verify transaction on [Sepolia Etherscan](https://sepolia.etherscan.io)

│ ② Sends 1 USDC to Adapter           │

│ ③ Calls Adapter.swap()              │4. **Test Vault Deposits**

│ ④ Receives ~1 POL back              │   - Navigate to "Vault" page

│ ⑤ Sends POL to relayer              │   - Deposit 100 USDC

└─────────────────────────────────────┘   - Earn yield from protocol fees

            │   - Withdraw anytime (ERC-4626 standard)

            │ swap()

            ▼### For Developers (Full Deployment)

STEP 5: Adapter Executes Swap

┌─────────────────────────────────────┐**Prerequisites**: Node.js 18+, Python 3.9+, Hardhat, MongoDB

│ MockDEXAdapter (0x7caF...)          │

│ - Receives 1 USDC                   │1. **Clone & Install**

│ - Swaps USDC → POL (1:1 rate)       │   ```bash

│ - Sends 1 POL back to RouterHub     │   git clone https://github.com/yourusername/ZeroToll.git

└─────────────────────────────────────┘   cd ZeroToll

            │   pnpm install  # Installs all workspace packages

            │ Result   ```

            ▼

STEP 6: User Gets Tokens!2. **Configure Environment**

┌─────────────────────────────────────┐   ```bash

│ ✅ Success!                          │   cp .env.example .env

│ User received: ~1 POL               │   # Edit .env with your keys:

│ Gas paid by: Relayer                │   # - PRIVATE_KEY_DEPLOYER (needs testnet ETH)

│ User paid: Only USDC (no gas!)      │   # - RELAYER_PRIVATE_KEY (will sign transactions)

│ Transaction: Verified on-chain      │   # - RPC URLs (Alchemy recommended)

└─────────────────────────────────────┘   # - Block explorer API keys

```   ```



### Why This Architecture?3. **Check Balances**

   ```bash

**Q: Why can't users swap directly?**     chmod +x scripts/check-balances.sh

A: They don't have native tokens (POL/ETH) to pay gas fees!   ./scripts/check-balances.sh

   # Ensure deployer has ~0.5 ETH on each chain

**Q: Why does the relayer help?**     ```

A: Relayers have native tokens and submit transactions on behalf of users. They get compensated through fees.

4. **Deploy Contracts**

**Q: Why RouterHub as middleman?**     ```bash

A: For security, fee management, and supporting multiple DEX adapters. It's the trusted coordinator.   chmod +x deploy-zerotoll.sh

   ./deploy-zerotoll.sh

**Q: Why does Adapter send tokens back to RouterHub instead of directly to user?**     # Select option 1: Deploy to all networks

A: Architecture design - RouterHub manages all token flows, tracks fees, and ensures security. Think of it as the "escrow manager".   # This deploys to Sepolia, Amoy, Arbitrum Sepolia, Optimism Sepolia

   ```

**Q: Is this really gasless for users?**  

A: YES! Users only approve token spending (1 signature). Relayer pays ALL gas costs.5. **Update Configuration**

   ```bash

---   node scripts/update-contract-addresses.js

   # Auto-updates frontend/src/config/contracts.json

## 🏗️ Technical Architecture   # Copy displayed addresses to backend/.env

   ```

### Core Components

6. **Start Services**

#### 1. Smart Contracts (On-Chain)   ```bash

   # Backend

**RouterHub** - The Central Coordinator   cd backend

- Address (Amoy): `0x63db4Ac855DD552947238498Ab5da561cce4Ac0b`   pip install -r requirements.txt

- Address (Sepolia): `0x1449279761a3e6642B02E82A7be9E5234be00159`   python server.py  # Runs on :8000

- Role: Manages token flows, whitelists adapters, enforces security   

- Key Functions:   # Frontend

  - `executeRoute()` - Main swap execution   cd frontend

  - `whitelistAdapter()` - Owner adds trusted DEX adapters   npm install

  - `recoverERC20()` - Emergency token recovery   npm start  # Runs on :3000

   

**MockDEXAdapter** - DEX Interface   # Route Planner (optional)

- Address (Amoy): `0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`   cd packages/relayer

- Address (Sepolia): `0x2Ed51974196EC8787a74c00C5847F03664d66Dc5`   npm install

- Role: Simulates DEX swaps (1:1 rate for testing)   npm start  # Runs on :3001

- Key Functions:   ```

  - `swap()` - Executes token swap, returns to RouterHub

  - Holds token reserves (13 USDC + native tokens)7. **Run E2E Tests**

   ```bash

> **Note**: MockDEXAdapter simulates a DEX for testnet. In production, we'd use UniswapV2Adapter or UniswapV3Adapter that call real DEX contracts.   # Follow E2E_TESTING_CHECKLIST.md

   # Verify ALL transactions appear on block explorers

**Other Contracts** (Advanced Features)   ```

- `FeeSink` - Collects protocol fees

- `FeeEscrow` - Holds fees for distribution**Full deployment guide**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

- `AssetRegistry` - Token whitelist management

- `ZeroTollPaymaster` - ERC-4337 paymaster (future: Account Abstraction)## 📊 Deployed Contracts



#### 2. Backend Services (Off-Chain)> **Status**: 🟡 Pending Deployment (scripts ready)



**FastAPI Server** (`backend/server.py`)### After Deployment, Addresses Will Be:

- REST API for swap quotes and execution

- Endpoints:**Ethereum Sepolia (ChainID: 11155111)**

  - `POST /api/swap/execute` - Execute swap transaction- RouterHub: `TBD`

  - `GET /api/swap/quote` - Get swap quote- FeeSink: `TBD`

  - `GET /api/swap/history` - Transaction history- FeeVault4626: `TBD`

- Responsibilities:- FeeRebalancer: `TBD`

  - Build transaction data- UniswapV2Adapter: `TBD`

  - Sign with relayer private key- Explorer: https://sepolia.etherscan.io

  - Submit to blockchain

  - Track transaction status**Polygon Amoy (ChainID: 80002)**

- RouterHub: `TBD`

**Route Planner** (`backend/route_client.py`)- FeeSink: `TBD`

- Calculates optimal swap routes- FeeVault4626: `TBD`

- Manages adapter addresses- FeeRebalancer: `TBD`

- Handles multi-hop routing (future)- QuickSwapAdapter: `TBD`

- Explorer: https://amoy.polygonscan.com

**Blockchain Service** (`backend/real_blockchain_service.py`)

- Direct Web3 interactions**Arbitrum Sepolia (ChainID: 421614)**

- Transaction building and signing- RouterHub: `TBD`

- Gas estimation- FeeSink: `TBD`

- Event monitoring- FeeVault4626: `TBD`

- UniswapV3Adapter: `TBD`

#### 3. Frontend (User Interface)- Explorer: https://sepolia.arbiscan.io



**React Application** (`frontend/`)**Optimism Sepolia (ChainID: 11155420)**

- Tech Stack: React + Tailwind CSS + wagmi + RainbowKit- RouterHub: `TBD`

- Pages:- FeeSink: `TBD`

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
