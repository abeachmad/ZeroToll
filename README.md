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

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm
- Python 3.9+

### Installation

```bash
# Install contract dependencies
cd packages/contracts
yarn install

# Install relayer dependencies
cd ../relayer
yarn install

# Install AI service dependencies
cd ../ai
yarn install

# Install backend dependencies
cd ../../backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
yarn install
```

### Configuration

1. Copy `.env.example` files:
```bash
cp packages/contracts/.env.example packages/contracts/.env
```

2. Update with your values:
- RPC endpoints (provided: Amoy, Sepolia)
- Private keys for deployer and relayer
- Bundler URLs (public 4337 bundlers)

### Deployment

```bash
# Deploy to Polygon Amoy
cd packages/contracts
yarn deploy:amoy

# Deploy to Ethereum Sepolia
yarn deploy:sepolia
```

Deployment addresses will be saved to `packages/contracts/deployments/`.

### Running Services

```bash
# Start relayer service
cd packages/relayer
yarn start

# Start AI scoring service
cd packages/ai
yarn start

# Start backend (from /app/backend)
sudo supervisorctl restart backend

# Start frontend (from /app/frontend)
sudo supervisorctl restart frontend
```

### Frontend Access

The app will be available at the configured frontend URL.

## Testing

### Contract Tests
```bash
cd packages/contracts
yarn test
```

### End-to-End Demo

1. Open the frontend
2. Connect wallet (no native gas needed)
3. Select route: Amoy USDC → Sepolia USDC
4. Set amount and fee cap
5. Get quote from relayers
6. Execute swap (paymaster sponsors gas)
7. View transaction in history

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

**Status**: Wave-2 testnet demo ready (Amoy ↔ Sepolia)
