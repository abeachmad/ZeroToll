# Multi-Testnet Setup Guide

## Supported Networks

ZeroToll now supports 4 testnets:

1. **Ethereum Sepolia** (ChainID: 11155111)
2. **Polygon Amoy** (ChainID: 80002)
3. **Arbitrum Sepolia** (ChainID: 421614)
4. **Optimism Sepolia** (ChainID: 11155420)

## Supported Tokens

### Ethereum Sepolia
- **ETH** (Native)
- **LINK** (0x779877A7B0D9E8603169DdBD7836e478b4624789)

### Polygon Amoy
- **POL** (Native)
- **LINK** (0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904)

### Arbitrum Sepolia
- **ETH** (Native)
- **LINK** (0xb1D4538B4571d411F07960EF2838Ce337FE1E80E)
- **ARB** (TBD)

### Optimism Sepolia
- **ETH** (Native)
- **LINK** (0xE4aB69C077896252FAFBD49EFD26B5D171A32410)
- **OP** (TBD)

## Pyth Price Feeds

Real-time prices from Pyth Network:

| Token | Price Feed ID | Symbol |
|-------|--------------|--------|
| ETH | 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace | Crypto.ETH/USD |
| POL | 0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472 | Crypto.MATIC/USD |
| LINK | 0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221 | Crypto.LINK/USD |
| ARB | 0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5 | Crypto.ARB/USD |
| OP | 0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf | Crypto.OP/USD |

## RPC Endpoints

### Ethereum Sepolia
- https://ethereum-sepolia-rpc.publicnode.com
- https://sepolia.drpc.org

### Polygon Amoy
- https://rpc-amoy.polygon.technology
- https://polygon-amoy.drpc.org

### Arbitrum Sepolia
- https://sepolia-rollup.arbitrum.io/rpc
- https://arbitrum-sepolia.blockpi.network/v1/rpc/public

### Optimism Sepolia
- https://sepolia.optimism.io
- https://optimism-sepolia.blockpi.network/v1/rpc/public

## Block Explorers

- **Ethereum Sepolia**: https://sepolia.etherscan.io
- **Polygon Amoy**: https://amoy.polygonscan.com
- **Arbitrum Sepolia**: https://sepolia.arbiscan.io
- **Optimism Sepolia**: https://sepolia-optimism.etherscan.io

## Faucets

### Ethereum Sepolia
- https://sepoliafaucet.com
- https://www.alchemy.com/faucets/ethereum-sepolia

### Polygon Amoy
- https://faucet.polygon.technology

### Arbitrum Sepolia
- https://faucet.quicknode.com/arbitrum/sepolia

### Optimism Sepolia
- https://app.optimism.io/faucet

## DEX Routers

### Polygon Amoy
- **QuickSwap V2**: 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff

### Ethereum Sepolia
- **Uniswap V2**: 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008

### Arbitrum Sepolia
- **Uniswap V3**: 0x101F443B4d1b059569D643917553c771E1b9663E

### Optimism Sepolia
- **Uniswap V3**: 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4

## Testing Instructions

### 1. Get Testnet Tokens

Get native tokens from faucets for all 4 networks.

### 2. Start Services

```bash
cd /home/abeachmad/ZeroToll

# Start backend
cd backend
/home/abeachmad/ZeroToll/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 --reload &

# Start frontend
cd ../frontend
yarn start
```

### 3. Test Cross-Chain Swaps

**Example 1: ETH (Sepolia) → POL (Amoy)**
- From: Ethereum Sepolia, ETH, 0.01
- To: Polygon Amoy, POL
- Fee Mode: INPUT
- Execute and verify on both explorers

**Example 2: ETH (Arbitrum) → ETH (Optimism)**
- From: Arbitrum Sepolia, ETH, 0.005
- To: Optimism Sepolia, ETH
- Fee Mode: NATIVE
- Execute and verify

**Example 3: LINK (Sepolia) → LINK (Amoy)**
- From: Ethereum Sepolia, LINK, 10
- To: Polygon Amoy, LINK
- Fee Mode: INPUT
- Execute and verify

## Current Implementation

**Status**: Native token transfers only (ETH/POL)

DEX swaps are not yet implemented due to limited testnet liquidity. The current implementation:
- ✅ Sends real transactions to blockchain
- ✅ Uses correct amounts from user input
- ✅ Records transactions on explorers
- ✅ Supports all 4 testnets
- ⏳ DEX swaps pending (requires liquidity)

## Files Modified

1. `frontend/src/config/tokenlists/zerotoll.tokens.sepolia.json` - ETH, LINK only
2. `frontend/src/config/tokenlists/zerotoll.tokens.amoy.json` - POL, LINK only
3. `frontend/src/config/tokenlists/zerotoll.tokens.arbitrum-sepolia.json` - NEW
4. `frontend/src/config/tokenlists/zerotoll.tokens.optimism-sepolia.json` - NEW
5. `frontend/src/pages/Swap.jsx` - Added Arbitrum & Optimism support
6. `backend/server.py` - Updated price feeds and chain validation
7. `backend/dex_integration_service.py` - Added all 4 testnets
8. `backend/pyth_price_service.py` - NEW: Real Pyth price feed integration

## Next Steps

1. ✅ Multi-testnet support (Sepolia, Amoy, Arbitrum, Optimism)
2. ✅ Simplified token list (ETH, POL, LINK, ARB, OP only)
3. ✅ Pyth price feed integration
4. ⏳ Deploy liquidity pools for testing
5. ⏳ Implement real DEX swaps
6. ⏳ Cross-chain bridging with Axelar/LayerZero

---

**Version**: 3.0.0
**Last Updated**: 2024-11-04
**Status**: ✅ Multi-testnet ready for native transfers
