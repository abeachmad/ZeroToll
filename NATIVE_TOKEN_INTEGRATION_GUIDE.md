# Native Token Integration Guide

## Quick Reference: POL/ETH Support

### Token Aliases

| Display | Internal | Address | Chain |
|---------|----------|---------|-------|
| POL | WPOL | 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9 | Amoy |
| ETH | WETH | 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14 | Sepolia |

### Fee Modes with Native Output

| Fee Mode | Input Token | Output Token | Fee Token | Behavior |
|----------|-------------|--------------|-----------|----------|
| NATIVE | Any | POL/ETH | POL/ETH | Standard native gas |
| INPUT | USDT | POL/ETH | USDT | Fee from input, output unwrapped |
| OUTPUT | USDT | POL/ETH | WPOL/WETH | **Fee skimmed from wrapped, then unwrap** |
| STABLE | Any | POL/ETH | USDC | Fee in stable, output unwrapped |

### Contract Flow: OUTPUT Mode + Native Output

```solidity
// 1. Route produces WETH/WPOL
uint256 grossOut = executeSwap(tokenIn, WETH);

// 2. Skim fee from wrapped
uint256 feeAmount = calculateFee(grossOut);
IERC20(WETH).transfer(feeSink, feeAmount);

// 3. Unwrap remainder
uint256 netOut = grossOut - feeAmount;
IWETH(WETH).withdraw(netOut);

// 4. Transfer native to user
payable(user).transfer(netOut);
```

### Frontend: Detecting Native Output

```javascript
const isNativeOutput = tokenOut.isNative; // true for POL/ETH
const wrappedSymbol = tokenOut.symbol === 'POL' ? 'WPOL' : 'WETH';

if (isNativeOutput && feeMode === 'OUTPUT') {
  // Show: "Fee skimmed from WPOL/WETH before unwrap"
}
```

### Relayer: Building Routes for Native Output

```javascript
// If tokenOut is native (POL/ETH)
if (intent.tokenOut === 'POL' || intent.tokenOut === 'ETH') {
  const wrappedToken = intent.tokenOut === 'POL' ? 'WPOL' : 'WETH';
  
  // Build route to wrapped token
  const route = buildRoute(intent.tokenIn, wrappedToken);
  
  // If OUTPUT mode, include Pyth updateData for wrapped token
  if (intent.feeMode === 'OUTPUT') {
    const pythData = await getPythUpdateData(wrappedToken);
    route.pythUpdateData = pythData;
    route.pythUpdateFee = estimatePythFee();
  }
  
  // Include unwrap gas in cost estimate
  route.gasEstimate += UNWRAP_GAS_COST;
}
```

### Subgraph: Indexing Native Outputs

```typescript
// In RouteExecuted handler
let execution = new RouteExecution(event.transaction.hash.toHex());
execution.outIsNative = event.params.outIsNative;
execution.outGrossWrapped = event.params.outGrossWrapped;
execution.outNetNative = event.params.outNetNative;
execution.wrappedToken = event.params.wrappedToken;
execution.save();
```

### Oracle Integration: Pyth Price IDs

| Token | Pyth Price ID |
|-------|---------------|
| WPOL | 0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472 |
| WETH | 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace |
| USDT | 0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b |
| USDC | 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a |
| WBTC | 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43 |

### Error Handling

```solidity
// RouterHub: Disable OUTPUT mode if wrapped token lacks oracle
if (intent.feeMode == FeeAssetMode.TOKEN_OUTPUT_DEST && isNativeOut) {
    address wrappedToken = nativeToWrapped[NATIVE_MARKER];
    require(hasReliableOracle(wrappedToken), "No oracle for wrapped fee token");
    require(hasMinLiquidity(wrappedToken), "Insufficient liquidity for fee conversion");
}
```

### UI Tooltips

```javascript
const tooltips = {
  unwrap: "Native (ETH/POL) is delivered by unwrapping WETH/WPOL after fee handling.",
  outputFee: "Fee is skimmed from wrapped output before unwrapping to native.",
  noOracle: "OUTPUT mode disabled: wrapped token lacks reliable price oracle.",
  lowLiquidity: "OUTPUT mode disabled: insufficient liquidity for fee conversion."
};
```

### Gas Estimates

| Operation | Gas Cost |
|-----------|----------|
| WETH.withdraw() | ~25,000 |
| Native transfer | ~21,000 |
| Fee skim (ERC20) | ~50,000 |
| **Total overhead** | ~96,000 |

### Testing Commands

```bash
# Deploy contracts
cd packages/contracts
yarn deploy:amoy
yarn deploy:sepolia

# Set native wrapped addresses
yarn hardhat run scripts/setNativeWrapped.js --network amoy
yarn hardhat run scripts/setNativeWrapped.js --network sepolia

# Test same-chain native swap
yarn hardhat test test/RouterHub.native.test.js

# Test cross-chain native swap
yarn hardhat test test/RouterHub.crosschain.native.test.js
```

### Common Pitfalls

1. **Forgetting to set nativeToWrapped mapping**
   - Call `RouterHub.setNativeWrapped(WETH/WPOL)` after deployment

2. **Not including unwrap gas in relayer quote**
   - Add ~96k gas to estimate for native outputs

3. **Using OUTPUT mode without oracle for wrapped token**
   - Check `hasReliableOracle(wrappedToken)` before allowing OUTPUT

4. **Not handling receive() in RouterHub**
   - Contract must accept native transfers from WETH.withdraw()

5. **Forgetting Pyth updateData for wrapped fee token**
   - Include Pyth update in userOp if OUTPUT mode + native output

### Example: Full Flow (USDT → POL on Amoy)

```javascript
// 1. User selects tokens
const tokenIn = 'USDT';
const tokenOut = 'POL'; // native
const feeMode = 'OUTPUT';

// 2. Frontend maps to wrapped
const wrappedOut = 'WPOL';

// 3. Get quote from relayer
const quote = await getQuote({
  tokenIn: 'USDT',
  tokenOut: 'POL',
  feeMode: 'OUTPUT'
});
// quote.feeToken = 'WPOL'
// quote.includesPriceUpdate = true

// 4. Execute
const tx = await routerHub.executeRoute(intent, adapter, routeData);
// - Swaps USDT → WPOL
// - Skims fee from WPOL → FeeSink
// - Unwraps remaining WPOL → POL
// - Transfers POL to user

// 5. Subgraph indexes
// - outIsNative = true
// - outGrossWrapped = 100 WPOL
// - outNetNative = 97 POL (after 3 WPOL fee)
```

---

**For questions or issues, see**: `WALLET_MODAL_NATIVE_TOKENS_UPDATE.md`
