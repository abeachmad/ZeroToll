# ZeroToll

**Zero native gas. Smarter cross-chain.**

ZeroToll is a Polygon-native DeFi protocol that enables gasless cross-chain swaps and bridges. Users can execute transactions without holding native gas tokens (POL/ETH), paying fees in stablecoins instead.

## Features

- ⚡ **Gasless Transactions**: No native gas required. ERC-4337 paymaster fronts costs.
- 🌐 **Cross-Chain Routing**: Seamless bridging between Polygon Amoy and Ethereum Sepolia.
- 🔒 **Secure & Transparent**: Permissionless LP vault, RFQ auctions, optimistic settlement.
- 💰 **Pay in Stablecoins**: USDC/USDT/DAI with transparent fee caps and refunds.

## Architecture

### Contracts (`packages/contracts`)
- **ZeroTollPaymaster**: ERC-4337 paymaster for gasless transactions
- **VaultStableFloat**: Permissionless LP vault for gas fronting
- **RelayerRegistry**: Staking and scoring for relayers
- **RouterHub**: Multi-DEX routing with whitelisted adapters
- **SettlementHub**: Optimistic settlement for cross-chain fills

### Services
- **Relayer** (`packages/relayer`): Node/TS service for RFQ and bundler interaction
- **AI Scoring** (`packages/ai`): Rule-based ETC calculation (ML-ready interface)
- **Subgraph** (`packages/subgraph`): The Graph indexer for metrics

### Frontend (`apps/web`)
- React + Tailwind + wagmi/viem
- Gasless swap interface with RainbowKit wallet support
- Transaction history and analytics dashboard

## 🚀 Quick Start

**Status**: ✅ **READY FOR TESTING**

Contracts are deployed and the application is running!

### Deployed Contracts

**Polygon Amoy (ChainID: 80002)**
- RouterHub: `0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127`
- FeeSink: `0x1F679D174A9fBe4158EABcD24d4A63D6Bcf8f700`
- Explorer: https://amoy.polygonscan.com/address/0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127

**Ethereum Sepolia (ChainID: 11155111)**
- RouterHub: `0x19091A6c655704c8fb55023635eE3298DcDf66FF`
- FeeSink: `0x2c7342421eB6Bf2a2368F034b26A19F39DC2C130`
- Explorer: https://sepolia.etherscan.io/address/0x19091A6c655704c8fb55023635eE3298DcDf66FF

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
