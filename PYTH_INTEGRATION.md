# Pyth Network Integration

## Overview

ZeroToll now supports **Pyth Network** real-time price feeds as an alternative to mock oracles.

## What Changed

### ✅ New Files Created

1. **`contracts/oracles/PythPriceOracle.sol`**
   - Adapter contract that implements `IPriceOracle` interface
   - Connects to Pyth Network for real-time prices
   - Handles decimal conversion automatically

2. **`contracts/oracles/PythConfig.sol`**
   - Configuration library with Pyth contract addresses
   - Price feed IDs for all supported tokens
   - Easy reference for deployment

3. **`scripts/deploy-amoy-pyth.js`**
   - Deployment script using Pyth oracles
   - Replaces MockPriceOracle with PythPriceOracle
   - Maintains backward compatibility

## Pyth Network Details

### Contract Addresses

| Network | Pyth Contract |
|---------|---------------|
| Polygon Amoy | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` |
| Ethereum Sepolia | `0xDd24F84d36BF92C65F92307595335bdFab5Bbd21` |

### Price Feed IDs

| Token | Price Feed ID |
|-------|---------------|
| POL/USD | `0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472` |
| BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43` |
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| AVAX/USD | `0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7` |
| DOGE/USD | `0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c` |
| ATOM/USD | `0xb00b60f88b03a6a625a8d1c048c3f66653edf217439983d037e7222c4e612819` |
| BNB/USD | `0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f` |
| USDC/USD | `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` |

## How It Works

### PythPriceOracle Contract

```solidity
contract PythPriceOracle is IPriceOracle {
    IPyth public immutable pyth;
    bytes32 public immutable priceId;
    uint8 public immutable targetDecimals;
    
    function getPrice() external view returns (uint256) {
        // Fetches price from Pyth Network
        // Converts to target decimals (18)
        // Returns normalized price
    }
    
    function lastUpdated() external view returns (uint256) {
        // Returns Pyth publish timestamp
    }
}
```

### Key Features

1. **Real-time Prices**: Updated every second
2. **Low Latency**: <1 second update time
3. **High Accuracy**: Confidence intervals included
4. **Multi-chain**: Same feed IDs across all chains
5. **Backward Compatible**: Implements existing `IPriceOracle` interface

## Deployment

### Option 1: Deploy with Pyth (Recommended for Production)

```bash
cd packages/contracts

# Deploy to Amoy with Pyth oracles
yarn deploy:amoy:pyth

# Output: deployments/amoy-pyth.json
```

### Option 2: Deploy with Mock (Testing Only)

```bash
# Deploy to Amoy with mock oracles
yarn deploy:amoy

# Output: deployments/amoy.json
```

## Comparison: Mock vs Pyth

| Feature | Mock Oracle | Pyth Network |
|---------|-------------|--------------|
| **Price Updates** | Manual | Real-time (1s) |
| **Accuracy** | Fixed | Market-driven |
| **Latency** | N/A | <1 second |
| **Cost** | Free | ~0.0001 ETH per update |
| **Production Ready** | ❌ No | ✅ Yes |
| **Testnet Support** | ✅ Yes | ✅ Yes |
| **Mainnet Support** | ❌ No | ✅ Yes |

## Usage in Code

### TokenValuer Integration

No changes needed! `TokenValuer` uses `IPriceOracle` interface:

```solidity
// Works with both Mock and Pyth oracles
function getPrice(address token) external view returns (uint256) {
    address oracle = priceOracles[token];
    uint256 price = IPriceOracle(oracle).getPrice();
    uint256 lastUpdate = IPriceOracle(oracle).lastUpdated();
    // ... validation logic
    return price;
}
```

### Deployment Configuration

```javascript
// Deploy Pyth oracle for USDC
const usdcOracle = await PythOracle.deploy(
    PYTH_AMOY,                    // Pyth contract address
    PRICE_IDS.USDC_USD,           // Price feed ID
    18                            // Target decimals
);

// Set in TokenValuer
await tokenValuer.setOracle(
    usdcAddress,
    await usdcOracle.getAddress(),
    await usdcOracle.getAddress()  // Can use same for TWAP
);
```

## Benefits

### For Development
- ✅ Test with real market prices
- ✅ Simulate production environment
- ✅ No manual price updates needed

### For Production
- ✅ Real-time accurate prices
- ✅ Decentralized price feeds
- ✅ High reliability (99.9% uptime)
- ✅ Multi-chain consistency

## Price Update Mechanism

Pyth uses a **pull-based** model:

1. Off-chain: Pyth publishers continuously update prices
2. On-chain: Prices are available via `getPriceUnsafe()`
3. No gas cost for reading prices
4. Optional: Update on-chain price with `updatePriceFeeds()` (costs gas)

For ZeroToll, we use `getPriceUnsafe()` which reads the latest available price without updating.

## Security Considerations

### Staleness Check
`TokenValuer` includes staleness validation:
```solidity
require(block.timestamp - lastUpdate <= staleAfter, "Oracle price stale");
```

### Deviation Check
Dual oracle support for price validation:
```solidity
if (twap != address(0)) {
    uint256 deviation = calculateDeviation(price, twapPrice);
    require(deviation <= maxDeviationBps, "Price deviation too high");
}
```

### Confidence Intervals
Pyth provides confidence intervals for each price. Future enhancement can validate:
```solidity
(uint256 price, uint256 conf) = pythOracle.getPriceWithConfidence();
require(conf < maxConfidence, "Price confidence too low");
```

## Testing

### Local Testing
Use mock oracles for local development:
```bash
yarn deploy:amoy  # Uses MockPriceOracle
```

### Testnet Testing
Use Pyth for realistic testing:
```bash
yarn deploy:amoy:pyth  # Uses PythPriceOracle
```

### Mainnet
Always use Pyth for production:
```bash
yarn deploy:polygon:pyth  # Production deployment
```

## Resources

- **Pyth Network**: https://pyth.network
- **Price Feeds**: https://insights.pyth.network/price-feeds
- **Documentation**: https://docs.pyth.network
- **Contract Addresses**: https://docs.pyth.network/price-feeds/contract-addresses

## Migration Path

### From Mock to Pyth

1. Deploy new PythPriceOracle contracts
2. Call `TokenValuer.setOracle()` with new addresses
3. No changes to other contracts needed
4. Backward compatible with existing interface

### Example Migration Script

```javascript
// Update USDC oracle from Mock to Pyth
const newOracle = await PythOracle.deploy(
    PYTH_ADDRESS,
    USDC_PRICE_ID,
    18
);

await tokenValuer.setOracle(
    usdcAddress,
    await newOracle.getAddress(),
    await newOracle.getAddress()
);
```

## Conclusion

Pyth Network integration provides:
- ✅ Production-ready price feeds
- ✅ Real-time market prices
- ✅ Multi-chain support
- ✅ Backward compatibility
- ✅ Easy migration from mock oracles

**Recommended**: Use Pyth for all testnet and mainnet deployments.
