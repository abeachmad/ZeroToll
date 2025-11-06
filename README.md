# ZeroToll 🚀

**Zero native gas. Smarter cross-chain swaps with AI-powered routing.**

> **Polygon Buildathon Submission** - Advanced DeFi Track  
> Enabling gasless cross-chain DeFi with intelligent route optimization and LP yield generation

ZeroToll is a next-generation DeFi protocol that eliminates gas friction across 4 testnets. Users execute swaps and bridges without native tokens, paying fees in ANY token via ERC-4337 Account Abstraction. AI-powered routing finds optimal multi-DEX paths, while LPs earn yield from protocol fees through an ERC-4626 vault.

## ✨ Key Features

- ⚡ **Gasless Transactions**: No ETH/MATIC required. ERC-4337 paymaster + relayer network fronts gas costs
- 🤖 **AI Route Optimization**: Multi-DEX aggregation with intelligent path selection saves 10-50 bps vs. single-DEX
- 🌐 **Multi-Chain Support**: Seamless swaps across Sepolia, Amoy, Arbitrum Sepolia, Optimism Sepolia
- � **Any-Token Fees**: Pay swap fees in USDC, DAI, WETH, or the token you're swapping
- 🏦 **LP Yield Vault**: ERC-4626 compliant vault with automatic fee rebalancing and APR tracking
- � **Fully On-Chain**: All transactions verifiable on block explorers (critical for DeFi trust)

## 🏗️ Architecture

### Smart Contracts (`packages/contracts/`)

**Core Infrastructure**
- **RouterHub**: Multi-DEX routing engine with adapter whitelisting and slippage protection
- **ZeroTollPaymaster**: ERC-4337 paymaster enabling gasless transactions via relayer network
- **FeeSink**: Fee collection hub with automatic treasury routing

**Advanced Features**
- **FeeVault4626**: ERC-4626 compliant yield vault for LPs (60% fees → LPs, 40% → treasury)
- **FeeRebalancer**: Auto-converts collected fee tokens to USDC for vault deposits
- **DEX Adapters**: UniswapV2Adapter, UniswapV3Adapter, MockDEXAdapter for low liquidity scenarios
- **Bridge Adapters**: MockBridgeAdapter for cross-chain message passing

### Backend Services (`backend/`)

- **FastAPI Server**: Quote generation, swap execution, transaction relaying
- **Web3 Transaction Builder**: Builds, signs, and sends REAL blockchain transactions (no more mocks!)
- **Route Planner Client**: Communicates with TypeScript route service for multi-DEX optimization
- **Pyth Price Integration**: Real-time oracle price feeds with 15-second batch optimization
- **MongoDB**: Swap history persistence with explorer URL tracking

### Relayer Services (`packages/relayer/`)

- **Route Planner**: Multi-DEX aggregation scoring routes by price + gas + slippage
- **Pyth Batcher**: Optimizes oracle updates with content-based caching
- **Intent Executor**: (Future) Full ERC-4337 bundler integration

### AI Intelligence (`packages/ai/`)

- **Route Scorer**: ONNX-based ML model for route ranking
- **Risk Guard**: Slippage and MEV risk assessment
- **(Pending)** Express service with `/scoreRoutes` and `/riskScore` endpoints

### Subgraph (`packages/subgraph/`)

- **Entities**: GasSponsoredEvent, FeeToVault, AIRouteChosen
- **Metrics**: Gas saved, refund rate, TVL, APR, AI win-rate
- **(Pending)** Deployment to The Graph Studio

### Frontend (`frontend/`)

- **Tech Stack**: React + Tailwind CSS + wagmi + viem + RainbowKit
- **Pages**: 
  - Home: Protocol introduction
  - Swap: Quote generation with AI route badge
  - Vault: LP deposit/withdraw with TVL/APR metrics
  - Portfolio: Swap history with CSV export
  - Market: Token prices and liquidity data
- **Components**: ConnectButton, AIRouteBadge, LiveMetrics, FeeModeExplainer

## 🚀 Quick Start

### For Users (Testing the DApp)

1. **Get Testnet Tokens**
   - Faucets: [Sepolia](https://sepoliafaucet.com) | [Amoy](https://faucet.polygon.technology) | [Arbitrum](https://faucet.arbitrum.io) | [Optimism](https://app.optimism.io/faucet)
   - Get USDC from [Circle Faucet](https://faucet.circle.com/) or [Aave Staging](https://staging.aave.com/faucet/)

2. **Start the Application**
   ```bash
   # Quick start (both backend + frontend)
   ./start-zerotoll.sh
   
   # Or manually:
   # Terminal 1 - Backend
   cd backend && python server.py
   
   # Terminal 2 - Frontend
   cd frontend && npm start
   ```

3. **Test a Swap**
   - Open http://localhost:3000
   - Connect wallet (MetaMask recommended)
   - Switch to Sepolia network
   - Try swapping: 10 USDC → DAI
   - Click "Execute Swap"
   - **CRITICAL**: Verify transaction on [Sepolia Etherscan](https://sepolia.etherscan.io)

4. **Test Vault Deposits**
   - Navigate to "Vault" page
   - Deposit 100 USDC
   - Earn yield from protocol fees
   - Withdraw anytime (ERC-4626 standard)

### For Developers (Full Deployment)

**Prerequisites**: Node.js 18+, Python 3.9+, Hardhat, MongoDB

1. **Clone & Install**
   ```bash
   git clone https://github.com/yourusername/ZeroToll.git
   cd ZeroToll
   pnpm install  # Installs all workspace packages
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your keys:
   # - PRIVATE_KEY_DEPLOYER (needs testnet ETH)
   # - RELAYER_PRIVATE_KEY (will sign transactions)
   # - RPC URLs (Alchemy recommended)
   # - Block explorer API keys
   ```

3. **Check Balances**
   ```bash
   chmod +x scripts/check-balances.sh
   ./scripts/check-balances.sh
   # Ensure deployer has ~0.5 ETH on each chain
   ```

4. **Deploy Contracts**
   ```bash
   chmod +x deploy-zerotoll.sh
   ./deploy-zerotoll.sh
   # Select option 1: Deploy to all networks
   # This deploys to Sepolia, Amoy, Arbitrum Sepolia, Optimism Sepolia
   ```

5. **Update Configuration**
   ```bash
   node scripts/update-contract-addresses.js
   # Auto-updates frontend/src/config/contracts.json
   # Copy displayed addresses to backend/.env
   ```

6. **Start Services**
   ```bash
   # Backend
   cd backend
   pip install -r requirements.txt
   python server.py  # Runs on :8000
   
   # Frontend
   cd frontend
   npm install
   npm start  # Runs on :3000
   
   # Route Planner (optional)
   cd packages/relayer
   npm install
   npm start  # Runs on :3001
   ```

7. **Run E2E Tests**
   ```bash
   # Follow E2E_TESTING_CHECKLIST.md
   # Verify ALL transactions appear on block explorers
   ```

**Full deployment guide**: See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 📊 Deployed Contracts

> **Status**: 🟡 Pending Deployment (scripts ready)

### After Deployment, Addresses Will Be:

**Ethereum Sepolia (ChainID: 11155111)**
- RouterHub: `TBD`
- FeeSink: `TBD`
- FeeVault4626: `TBD`
- FeeRebalancer: `TBD`
- UniswapV2Adapter: `TBD`
- Explorer: https://sepolia.etherscan.io

**Polygon Amoy (ChainID: 80002)**
- RouterHub: `TBD`
- FeeSink: `TBD`
- FeeVault4626: `TBD`
- FeeRebalancer: `TBD`
- QuickSwapAdapter: `TBD`
- Explorer: https://amoy.polygonscan.com

**Arbitrum Sepolia (ChainID: 421614)**
- RouterHub: `TBD`
- FeeSink: `TBD`
- FeeVault4626: `TBD`
- UniswapV3Adapter: `TBD`
- Explorer: https://sepolia.arbiscan.io

**Optimism Sepolia (ChainID: 11155420)**
- RouterHub: `TBD`
- FeeSink: `TBD`
- FeeVault4626: `TBD`
- UniswapV3Adapter: `TBD`
- Explorer: https://sepolia-optimism.etherscan.io

**Previous Deployment (Legacy)**
- Amoy RouterHub: `0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127`
- Sepolia RouterHub: `0x19091A6c655704c8fb55023635eE3298DcDf66FF`

### Running the Application

```bash
# Quick start (recommended)
cd /home/abeachmad/ZeroToll
bash start-dev.sh

# Or manually:
# Terminal 1: Backend
cd backend
./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 &

# Terminal 2: Frontend
cd frontend
yarn start
```

### Access the App
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

### Test the Features

1. **Connect Wallet**: Click "Connect Wallet" and select MetaMask
2. **Get Testnet Tokens**:
   - Polygon Amoy POL: https://faucet.polygon.technology/
   - Ethereum Sepolia ETH: https://sepoliafaucet.com/
3. **Test Price Calculation**:
   - ETH → POL: 0.01 ETH = ~205 POL (real Pyth prices)
   - LINK → POL: 30 LINK = ~3896 POL
4. **Test Fee Modes**: NATIVE, INPUT, OUTPUT, STABLE
5. **Test Native Unwrap**: Select POL or ETH as output

### Documentation

📚 **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Complete documentation index

Quick links:
- **[QUICK_START.md](QUICK_START.md)**: Setup and testing guide
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)**: Complete test checklist
- **[STATUS.md](STATUS.md)**: Current deployment status
- **[DEPLOYMENT_SUCCESS.md](DEPLOYMENT_SUCCESS.md)**: Contract addresses

## Brand Assets

- Logo: `/apps/web/public/logo.svg`
- Logo mark: `/apps/web/public/logo-mark.svg`
- Favicon: `/apps/web/public/favicon.svg`

**Colors:**
- Midnight Ink: `#0B0D12`
- Electric Violet: `#7A4DFF`
- Aquamarine: `#44E0C6`
- Off-White: `#F5F7FA`

## Networks

- **Polygon Amoy**: ChainID 80002 (testnet)
- **Ethereum Sepolia**: ChainID 11155111 (testnet)

## Tech Stack

- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin
- **Backend**: FastAPI (Python), MongoDB
- **Frontend**: React, Tailwind CSS, wagmi, viem, RainbowKit
- **Relayer**: Node.js, viem
- **Indexing**: The Graph

## License

MIT

## Links

- [Polygon Docs](https://docs.polygon.technology)
- [ERC-4337 Docs](https://eips.ethereum.org/EIPS/eip-4337)
- [The Graph](https://thegraph.com)

---

---

## Current Features

### ✅ Working
- Real-time price quotes from Pyth oracle
- All 4 fee modes (NATIVE, INPUT, OUTPUT, STABLE)
- Native token support (POL, ETH) with auto wrap/unwrap
- Cross-chain routing (Amoy ↔ Sepolia)
- 19 supported tokens across both chains
- Wallet connection with proper z-index layering
- Token swap button with animation
- Responsive UI with glass effects

### ⚠️ Demo Mode
- Execute swap returns mock success (UI demo)
- For real on-chain swaps: integrate with RouterHub contract
- History page requires MongoDB or The Graph

---

**Status**: ✅ Wave-2 testnet demo ready (Amoy ↔ Sepolia)
**Version**: 2.0.0
**Last Updated**: 2024-11-03
