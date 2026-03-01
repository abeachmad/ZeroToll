# Product Overview

## Purpose
ZeroToll is a Polygon-native DeFi protocol enabling gasless cross-chain swaps and bridges. Users execute transactions without holding native gas tokens (POL/ETH), paying fees in stablecoins instead.

## Value Proposition
- **Zero Native Gas**: ERC-4337 paymaster fronts gas costs, eliminating the need for users to hold native tokens
- **Cross-Chain Simplicity**: Seamless bridging between Polygon Amoy and Ethereum Sepolia testnets
- **Stablecoin Payments**: Pay transaction fees in USDC/USDT/DAI with transparent caps and refunds
- **Permissionless**: Open LP vault, RFQ auctions, and optimistic settlement architecture

## Key Features

### Gasless Transactions
- ERC-4337 paymaster architecture fronts gas costs
- Users pay fees in stablecoins, not native tokens
- Transparent fee caps with automatic refunds

### Cross-Chain Routing
- Multi-chain support: Polygon Amoy (80002) ↔ Ethereum Sepolia (11155111)
- 19 supported tokens across both chains
- Native token support (POL, ETH) with automatic wrap/unwrap

### Trading Capabilities
- Real-time price quotes from Pyth oracle
- 4 fee modes: NATIVE, INPUT, OUTPUT, STABLE
- Multi-DEX routing with whitelisted adapters
- Optimistic settlement for cross-chain fills

### Security & Transparency
- Permissionless LP vault for gas fronting
- RFQ (Request for Quote) auction system
- Relayer staking and scoring mechanism
- Optimistic settlement with dispute resolution

## Target Users

### DeFi Traders
- Cross-chain swappers who want simplified gas management
- Users seeking gasless transaction experiences
- Traders operating across multiple chains

### Liquidity Providers
- LPs providing capital for gas fronting in permissionless vault
- Relayers staking and earning fees from transaction facilitation

### Developers
- dApp builders integrating gasless cross-chain functionality
- Protocol developers building on top of ZeroToll infrastructure

## Use Cases

1. **Gasless Swaps**: Execute token swaps without holding native gas tokens
2. **Cross-Chain Bridging**: Move assets between Polygon and Ethereum seamlessly
3. **Stablecoin Fee Payment**: Pay all transaction costs in familiar stablecoins
4. **Native Token Trading**: Trade POL and ETH with automatic wrapping/unwrapping
5. **Multi-Token Support**: Access 19+ tokens across both supported chains

## Current Status
- ✅ Wave-2 testnet demo ready (Amoy ↔ Sepolia)
- ✅ Contracts deployed and verified on both testnets
- ✅ Real-time Pyth oracle integration
- ✅ Frontend with wallet connection and swap interface
- ⚠️ Execute swap in demo mode (UI demonstration)
