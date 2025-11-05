# Verified Token Addresses

## Ethereum Sepolia (ChainID: 11155111)

### Native & Wrapped
- **ETH**: Native token
- **WETH**: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` ✅ Verified on Sepolia Etherscan

### ERC20 Tokens
- **LINK**: `0x779877A7B0D9E8603169DdBD7836e478b4624789` ✅ Official Chainlink Sepolia faucet token

### DEX
- **Uniswap V2 Router**: `0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008` ✅ Verified

### RPC
- Primary: `https://ethereum-sepolia-rpc.publicnode.com`
- Backup: `https://sepolia.drpc.org`

### Explorer
- https://sepolia.etherscan.io

---

## Polygon Amoy (ChainID: 80002)

### Native & Wrapped
- **POL**: Native token (formerly MATIC)
- **WPOL**: `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` ✅ Verified on Amoy PolygonScan

### ERC20 Tokens
- **LINK**: `0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904` ✅ Verified on Amoy PolygonScan

### DEX
- **QuickSwap V2 Router**: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` ✅ Verified

### RPC
- Primary: `https://rpc-amoy.polygon.technology`
- Backup: `https://polygon-amoy.drpc.org`

### Explorer
- https://amoy.polygonscan.com

---

## Arbitrum Sepolia (ChainID: 421614)

### Native & Wrapped
- **ETH**: Native token
- **WETH**: `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` ✅ Official Arbitrum Sepolia WETH

### ERC20 Tokens
- **LINK**: `0xb1D4538B4571d411F07960EF2838Ce337FE1E80E` ✅ Official Chainlink Arbitrum Sepolia
- **ARB**: Not yet deployed on Sepolia testnet (mainnet only)

### DEX
- **Uniswap V3 Router**: `0x101F443B4d1b059569D643917553c771E1b9663E` ✅ Verified

### RPC
- Primary: `https://sepolia-rollup.arbitrum.io/rpc`
- Backup: `https://arbitrum-sepolia.blockpi.network/v1/rpc/public`

### Explorer
- https://sepolia.arbiscan.io

---

## Optimism Sepolia (ChainID: 11155420)

### Native & Wrapped
- **ETH**: Native token
- **WETH**: `0x4200000000000000000000000000000000000006` ✅ Official Optimism WETH (predeploy)

### ERC20 Tokens
- **LINK**: `0xE4aB69C077896252FAFBD49EFD26B5D171A32410` ✅ Official Chainlink Optimism Sepolia
- **OP**: Not yet deployed on Sepolia testnet (mainnet only)

### DEX
- **Uniswap V3 Router**: `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` ✅ Verified

### RPC
- Primary: `https://sepolia.optimism.io`
- Backup: `https://optimism-sepolia.blockpi.network/v1/rpc/public`

### Explorer
- https://sepolia-optimism.etherscan.io

---

## Pyth Network Price Feeds

All price feed IDs verified from https://pyth.network/developers/price-feed-ids

| Token | Price Feed ID | Status |
|-------|--------------|--------|
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` | ✅ Active |
| MATIC/USD (POL) | `0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472` | ✅ Active |
| LINK/USD | `0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221` | ✅ Active |
| ARB/USD | `0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5` | ✅ Active |
| OP/USD | `0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf` | ✅ Active |

---

## Faucets

### Ethereum Sepolia
- https://sepoliafaucet.com
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

### Polygon Amoy
- https://faucet.polygon.technology

### Arbitrum Sepolia
- https://faucet.quicknode.com/arbitrum/sepolia
- Bridge from Sepolia: https://bridge.arbitrum.io/?destinationChain=arbitrum-sepolia

### Optimism Sepolia
- https://app.optimism.io/faucet
- Bridge from Sepolia: https://app.optimism.io/bridge

---

## Notes

1. **ARB Token**: Not available on Arbitrum Sepolia testnet. ARB is only on mainnet.
2. **OP Token**: Not available on Optimism Sepolia testnet. OP is only on mainnet.
3. **WETH Addresses**: Each network has its own WETH contract. Do not mix them.
4. **Liquidity**: Testnet DEXes have very limited liquidity. Native transfers work best for testing.

---

## Current Implementation Status

✅ **Working**:
- Native token transfers (ETH, POL)
- Multi-testnet support (4 networks)
- Real blockchain transactions
- Explorer verification
- Pyth price feeds

⏳ **Pending**:
- DEX swaps (limited testnet liquidity)
- ARB/OP tokens (not on testnets)
- Cross-chain bridging

---

**Last Verified**: 2024-11-04
**Sources**: 
- Ethereum Sepolia: https://github.com/eth-clients/sepolia
- Polygon Amoy: https://docs.polygon.technology/
- Arbitrum Sepolia: https://docs.arbitrum.io/
- Optimism Sepolia: https://docs.optimism.io/
- Chainlink: https://docs.chain.link/resources/link-token-contracts
- Uniswap: https://docs.uniswap.org/contracts/v2/reference/smart-contracts/router-02
- Pyth: https://pyth.network/developers/price-feed-ids
