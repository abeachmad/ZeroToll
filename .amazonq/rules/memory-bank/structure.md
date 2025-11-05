# Project Structure

## Directory Organization

ZeroToll is a monorepo workspace with multiple packages and applications:

```
ZeroToll/
├── apps/web/              # Legacy web app (deprecated)
├── backend/               # FastAPI Python backend service
├── frontend/              # React frontend application
├── packages/
│   ├── ai/               # AI scoring service (ML-ready interface)
│   ├── contracts/        # Solidity smart contracts
│   ├── relayer/          # Node.js relayer service
│   └── subgraph/         # The Graph indexer
├── config/               # Asset registry configurations
└── tests/                # Test suite
```

## Core Components

### Frontend (`frontend/`)
React-based user interface for gasless swaps and cross-chain bridging.

**Key Directories:**
- `src/components/` - Reusable UI components (modals, buttons, cards)
- `src/pages/` - Main application pages (Swap, Market, History, Analytics)
- `src/hooks/` - Custom React hooks (toast notifications, wallet interactions)
- `src/config/` - Configuration files (chains, tokens, contracts)
- `src/providers/` - React context providers
- `src/lib/` - Utility functions and helpers
- `public/` - Static assets (logo, favicon, brand assets)

**Technology:**
- React 19 with React Router for navigation
- Tailwind CSS + Radix UI for styling
- wagmi + viem for Web3 interactions
- RainbowKit for wallet connection
- Pyth Network for price feeds

### Backend (`backend/`)
FastAPI service providing quote generation, transaction routing, and blockchain interaction.

**Key Files:**
- `server.py` - Main FastAPI application with API endpoints
- `blockchain_service.py` - Web3 integration and contract interactions
- `dex_integration_service.py` - DEX routing and price calculation
- `simple_swap_service.py` - Swap execution logic
- `real_blockchain_service.py` - Real on-chain transaction handling

**Technology:**
- FastAPI for REST API
- web3.py for Ethereum interactions
- Motor/PyMongo for MongoDB (optional)
- httpx for HTTP requests
- python-dotenv for configuration

### Smart Contracts (`packages/contracts/`)
Solidity contracts for gasless transactions and cross-chain routing.

**Key Contracts:**
- `ZeroTollPaymaster.sol` - ERC-4337 paymaster for gasless transactions
- `VaultStableFloat.sol` - Permissionless LP vault for gas fronting
- `RelayerRegistry.sol` - Staking and scoring for relayers
- `RouterHub.sol` - Multi-DEX routing with whitelisted adapters
- `SettlementHub.sol` - Optimistic settlement for cross-chain fills

**Deployments:**
- Polygon Amoy: RouterHub at `0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127`
- Ethereum Sepolia: RouterHub at `0x19091A6c655704c8fb55023635eE3298DcDf66FF`

**Technology:**
- Solidity 0.8.24
- Hardhat for development and deployment
- OpenZeppelin contracts for security

### Relayer Service (`packages/relayer/`)
Node.js service handling RFQ auctions and bundler interactions.

**Purpose:**
- Process quote requests
- Interact with ERC-4337 bundlers
- Facilitate cross-chain message passing

### AI Scoring (`packages/ai/`)
Rule-based ETC (Estimated Time to Complete) calculation with ML-ready interface.

**Purpose:**
- Score relayer performance
- Calculate optimal routing
- ML model integration point

### Subgraph (`packages/subgraph/`)
The Graph indexer for on-chain metrics and analytics.

**Purpose:**
- Index transaction history
- Track LP vault metrics
- Monitor relayer performance

## Configuration Files

### Asset Registries (`config/`)
- `asset-registry.amoy.json` - Token configurations for Polygon Amoy
- `asset-registry.sepolia.json` - Token configurations for Ethereum Sepolia

Contains token addresses, decimals, symbols, and metadata for 19+ supported tokens.

### Environment Files
- `backend/.env` - Backend API keys and RPC endpoints
- `frontend/.env` - Frontend configuration and contract addresses
- `packages/contracts/.env` - Deployment private keys and network configs

## Architectural Patterns

### Monorepo Structure
- pnpm workspace for package management
- Shared dependencies across packages
- Independent deployment of services

### Service Architecture
- **Frontend**: Client-side React SPA
- **Backend**: Stateless FastAPI REST API
- **Contracts**: On-chain logic and state
- **Relayer**: Off-chain transaction facilitation
- **Subgraph**: Event indexing and querying

### Cross-Chain Flow
1. User initiates swap on frontend
2. Backend generates quote using Pyth prices
3. User signs transaction (gasless via paymaster)
4. Relayer submits to bundler
5. RouterHub executes on-chain swap
6. SettlementHub handles cross-chain settlement
7. Subgraph indexes transaction

## Key Relationships

- Frontend ↔ Backend: REST API for quotes and execution
- Backend ↔ Contracts: Web3 calls for on-chain operations
- Contracts ↔ Relayer: Event-driven communication
- Subgraph ↔ Contracts: Event indexing from blockchain
- Frontend ↔ Contracts: Direct Web3 calls for wallet interactions
