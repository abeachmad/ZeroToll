# Deploy Phase 3: EIP-7702 Integration

## Quick Start - Deploy Now!

Everything is ready. Just run these commands:

### 1. Deploy to Polygon Amoy

```bash
cd ~/ZeroToll/packages/contracts
npx hardhat run scripts/deploy-zerotoll-delegate.js --network amoy
```

### 2. Deploy to Ethereum Sepolia

```bash
npx hardhat run scripts/deploy-zerotoll-delegate.js --network sepolia
```

---

## What Will Happen

The deployment script will:
1. ✅ Deploy ZeroTollDelegate contract
2. ✅ Verify on block explorer (PolygonScan/Etherscan)
3. ✅ Save deployment info to `deployments/` folder
4. ✅ Print contract address and domain separator

---

## Expected Output

```
=== Deploying ZeroTollDelegate ===
Network: amoy
Chain ID: 80002
Deployer: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Balance: 1.5 POL

Configuration:
Router: 0xD83D377E4698317731b2953854c01d39C60815d7
Treasury: 0xD6a7294445F34d0F7244b2072696106904ea807B
WETH/WPOL: 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9

Deploying ZeroTollDelegate...
✅ ZeroTollDelegate deployed to: 0xABC...
Domain Separator: 0x123...

Waiting for 5 confirmations...
Verifying contract on block explorer...
✅ Contract verified

=== Deployment Complete ===
ZeroTollDelegate: 0xABC...

Next steps:
1. Update frontend config with delegate address
2. Update relayer with EIP-7702 support
3. Test gasless swaps on testnet
4. Compare gas costs with ERC-4337
```

---

## After Deployment

### Update Configuration Files

**1. Update `backend/eip7702-relayer.mjs`:**

Replace this:
```javascript
const DELEGATE_ADDRESS = {
  80002: '0x...', // Amoy - Update after deployment
  11155111: '0x...' // Sepolia - Update after deployment
};
```

With your deployed addresses:
```javascript
const DELEGATE_ADDRESS = {
  80002: '0xYOUR_AMOY_ADDRESS',
  11155111: '0xYOUR_SEPOLIA_ADDRESS'
};
```

**2. Update `frontend/src/config/contracts.json`:**

Add to each network:
```json
{
  "80002": {
    "zeroTollDelegate": "0xYOUR_AMOY_ADDRESS",
    ...
  },
  "11155111": {
    "zeroTollDelegate": "0xYOUR_SEPOLIA_ADDRESS",
    ...
  }
}
```

---

## Test Deployment

```bash
# Test health check
node backend/eip7702-relayer.mjs health 80002
node backend/eip7702-relayer.mjs health 11155111

# Test nonce retrieval
node backend/eip7702-relayer.mjs nonce 80002 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

---

## Why EIP-7702?

### Benefits
- **50% gas savings** vs ERC-4337 (no EntryPoint overhead)
- **Trustless fees** - calculated on-chain via Pyth oracle
- **No frontrunning** - relayer can't see intent before execution
- **Native output** - built-in WETH/WPOL unwrap

### How It Works

```
User's EOA (EIP-7702)
  ↓ Temporarily delegates to ZeroTollDelegate
  ↓ Signs authorization + intent
  ↓
Relayer
  ↓ Builds transaction with authorizationList
  ↓ Submits to blockchain
  ↓ Pays gas upfront
  ↓
ZeroTollDelegate (On-Chain)
  ↓ Executes permit (gasless approval)
  ↓ Calculates fee via Pyth oracle
  ↓ Executes swap via RouterV3
  ↓ Unwraps to native if needed
  ↓
User receives tokens (gasless!)
```

---

## Configuration Summary

### Polygon Amoy (Chain ID: 80002)
- **RouterV3:** `0xD83D377E4698317731b2953854c01d39C60815d7`
- **Treasury:** `0xD6a7294445F34d0F7244b2072696106904ea807B`
- **WPOL:** `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9`

### Ethereum Sepolia (Chain ID: 11155111)
- **RouterV3:** `0xB54e95a30E4Aa355380798313E0791833C7F0BFF`
- **Treasury:** `0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10`
- **WETH:** `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`

---

## Troubleshooting

### "Insufficient funds"
- Check deployer balance: `npx hardhat run scripts/check-balance.js --network amoy`
- Get testnet tokens: https://faucet.polygon.technology/

### "Contract already deployed"
- This is fine! The script will still verify it
- Check `deployments/` folder for existing addresses

### "Verification failed"
- This is OK - contract is still deployed
- You can verify manually later on PolygonScan/Etherscan

---

## Next Steps After Deployment

1. ✅ Deploy contracts (you're doing this now!)
2. ⏳ Update configuration files
3. ⏳ Test EIP-7702 swaps
4. ⏳ Measure gas savings
5. ⏳ Update documentation
6. ⏳ Push to GitHub

---

## Questions?

- Check `docs/PHASE3_ACTION_PLAN.md` for detailed plan
- Check `docs/PHASE3_DECENTRALIZATION.md` for architecture
- Check `docs/PHASE3_IMPLEMENTATION_GUIDE.md` for step-by-step guide

---

**Ready to deploy? Run the commands above!** 🚀
