# Phase 2B Deployment Status

## Deployed Contracts

### Polygon Amoy (ChainID: 80002) ✅ DEPLOYED

| Contract | Address | Explorer |
|----------|---------|----------|
| **ZeroTollTreasury** | `0xD6a7294445F34d0F7244b2072696106904ea807B` | [View](https://amoy.polygonscan.com/address/0xD6a7294445F34d0F7244b2072696106904ea807B) |
| **ZeroTollRouterV3** | `0xD83D377E4698317731b2953854c01d39C60815d7` | [View](https://amoy.polygonscan.com/address/0xD83D377E4698317731b2953854c01d39C60815d7) |

**Configuration:**
- RouterV3 authorized as Treasury fee collector
- Treasury set in RouterV3
- Gasless fee: max 1% cap, enabled
- Test mode: enabled
- Primary adapter: `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84`
- Fallback adapter: `0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87`

### Ethereum Sepolia (ChainID: 11155111) ⏳ PENDING

Deployment pending - need Sepolia ETH for gas.

---

## Fee Configuration

| Parameter | Value |
|-----------|-------|
| Max Fee Cap | 1% of swap amount |
| Fee Multiplier | 2x gas cost |
| Fee Enabled | Yes |
| Treasury Distribution | 80% LP / 15% Ops / 5% Reserve |

---

## Next Steps

1. ✅ Deploy Treasury + RouterV3 on Amoy
2. ⏳ Deploy Treasury + RouterV3 on Sepolia (need ETH)
3. ✅ Update phase2-relayer with RouterV3 address and fee calculation
4. ✅ Fund RouterV3 with zToken liquidity (500 each: zUSDC, zETH, zPOL, zLINK)
5. ⏳ Test gasless swap with fee collection
6. ⏳ Update frontend to display fees

---

## API Endpoints

### Fee Estimation
```
GET /api/fee-estimate/:chainId/:tokenIn
```

Response:
```json
{
  "success": true,
  "chainId": 80002,
  "tokenIn": "0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD",
  "feeUSD": 0.01,
  "feeInToken": "10000",
  "gasCostUSD": 0.005,
  "multiplier": "2x",
  "tokenSymbol": "zUSDC",
  "treasury": "0xD6a7294445F34d0F7244b2072696106904ea807B"
}
```

---

## Deployment Timestamp

- **Amoy**: December 15, 2025 05:28:27 UTC
- **Deployer**: `0x330A86eE67bA0Da0043EaD201866A32d362C394c`
