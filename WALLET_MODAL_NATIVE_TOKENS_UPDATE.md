# Wallet Modal + Native Tokens Update

## Summary

This update implements two major improvements:

1. **UI Fix**: Wallet modal and account dropdown now use React Portal with proper z-index layering and body scroll lock
2. **Token Support**: Added POL, ETH, USDT with native wrap/unwrap and output-fee skimming from wrapped tokens

## Changes Made

### 1. UI Components (Wallet Modal Fix)

#### `frontend/src/components/ConnectButton.jsx`
- ✅ Replaced inline modal with `<Modal>` component (uses Portal)
- ✅ Replaced custom dropdown with Radix `<DropdownMenu>` (uses Portal)
- ✅ Z-index: Modal at 20000, Dropdown at 20002
- ✅ Body scroll lock when modal open
- ✅ ESC and overlay click to close

#### `frontend/src/components/ui/Portal.jsx`
- ✅ Already exists - creates portal root in document.body

#### `frontend/src/components/ui/Modal.jsx`
- ✅ Already exists - handles scroll lock and overlay

#### `frontend/src/components/ui/dropdown-menu.jsx`
- ✅ Updated z-index from z-50 to z-[20002]

#### `frontend/src/index.css`
- ✅ Added `--w3m-z-index: 20000` for Web3Modal compatibility

### 2. Token Lists & Configuration

#### `frontend/src/config/tokenlists/zerotoll.tokens.amoy.json` (NEW)
- ✅ POL (native) → WPOL (0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9)
- ✅ USDT, USDC, WBTC, WAVAX, wDOGE, WATOM, WPEPE, WTON, WBNB
- ✅ Each token has `isNative`, `wrappedAddress`, `feeModes`

#### `frontend/src/config/tokenlists/zerotoll.tokens.sepolia.json` (NEW)
- ✅ ETH (native) → WETH (0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14)
- ✅ USDT, USDC, WBTC, WAVAX
- ✅ Same structure as Amoy

#### `config/asset-registry.amoy.json`
- ✅ Added WPOL with Pyth price ID and `nativeAlias: "POL"`
- ✅ Added USDT with Pyth price ID
- ✅ Updated USDC with Pyth price ID

#### `config/asset-registry.sepolia.json`
- ✅ Added WETH with Pyth price ID and `nativeAlias: "ETH"`
- ✅ Added USDT with Pyth price ID
- ✅ Updated USDC with Pyth price ID

### 3. Frontend (Swap Page)

#### `frontend/src/pages/Swap.jsx`
- ✅ Import token lists from JSON files
- ✅ Dynamic token picker per chain
- ✅ Native output detection (`tokenOut.isNative`)
- ✅ Badge: "Will unwrap to POL/ETH on completion"
- ✅ Fee cap label shows wrapped symbol for native output + OUTPUT mode
- ✅ Info banner: "Fee skimmed from wrapped output (WETH/WPOL) → remaining unwrapped"
- ✅ Quote panel shows oracle source, age, confidence
- ✅ Quote panel shows "Net Receives" in native symbol
- ✅ Sticky header with z-50 (below modal)

### 4. Smart Contracts

#### `packages/contracts/contracts/RouterHub.sol`
- ✅ Added `NATIVE_MARKER` constant (0xEeee...)
- ✅ Added `nativeToWrapped` mapping
- ✅ Added `IWETH` interface import
- ✅ `executeRoute`: If `tokenOut == NATIVE_MARKER`:
  - Route produces WETH/WPOL
  - If `feeMode == TOKEN_OUTPUT_DEST`: skim fee from wrapped, send to FeeSink
  - Unwrap remainder: `IWETH.withdraw(netOut)`
  - Transfer native to user: `payable(msg.sender).transfer(netOut)`
- ✅ Emit `RouteExecuted` with `outIsNative`, `outGrossWrapped`, `outNetNative`
- ✅ Added `setNativeWrapped()` and `setFeeSink()`
- ✅ Added `receive()` for native transfers

#### `packages/contracts/contracts/FeeSink.sol`
- ✅ Added `deductWrappedAndForward()` function
- ✅ Splits wrapped token fee between vault (60%) and treasury (40%)
- ✅ Emits `WrappedFeeDeducted` event

#### `packages/contracts/contracts/interfaces/IWETH.sol` (NEW)
- ✅ Standard WETH9 interface: `deposit()`, `withdraw()`, `balanceOf()`, etc.

### 5. Subgraph

#### `packages/subgraph/schema.graphql`
- ✅ `RouteExecution` entity:
  - Added `outIsNative: Boolean!`
  - Added `outGrossWrapped: BigInt!`
  - Added `outNetNative: BigInt!`
  - Added `wrappedToken: Bytes`
  - Added `feeTokenSymbol: String!`
  - Added `oracleSource: String!`
  - Added `priceAgeSec: Int`
- ✅ `GasSettlement` entity:
  - Added `feeTokenSymbol: String!`
  - Added `priceConfidence: Int`
- ✅ `DailyMetrics` entity:
  - Added `nativeOutputCount: Int!`

## Testing Checklist

### UI (Wallet Modal)
- [ ] Open Connect Wallet modal on /market → overlays page, scroll locked
- [ ] Open Connect Wallet modal on /swap → overlays page, scroll locked
- [ ] ESC key closes modal
- [ ] Overlay click closes modal
- [ ] QR code visible for WalletConnect
- [ ] Account dropdown appears above all content (not clipped)
- [ ] Disconnect button clickable
- [ ] Wrong network banner doesn't cover modal

### Tokens (Same-Chain)
- [ ] Amoy: USDT → POL swap works
- [ ] Amoy: POL → USDT swap works
- [ ] Sepolia: USDT → ETH swap works
- [ ] Sepolia: ETH → USDT swap works
- [ ] Native output shows "Will unwrap" badge
- [ ] Fee cap label shows correct symbol (WPOL/WETH for OUTPUT + native)

### Tokens (Cross-Chain)
- [ ] USDT(Amoy) → ETH(Sepolia) quote received
- [ ] Quote shows oracle: Pyth with age/confidence
- [ ] OUTPUT mode + native: info banner shows "Fee skimmed from WETH"
- [ ] Execute swap (mock bridge ok)
- [ ] History shows feeToken, mode, netOut

### Contract Tests (Wave-2)
- [ ] Deploy RouterHub with `setNativeWrapped(WETH/WPOL)`
- [ ] Deploy FeeSink with vault/treasury
- [ ] Test: USDT → POL (OUTPUT mode) → fee skimmed from WPOL, unwrap to POL
- [ ] Test: USDT → ETH (cross-chain, OUTPUT mode) → fee skimmed from WETH, unwrap to ETH
- [ ] Test: Negative case → OUTPUT disabled if wrapped token lacks oracle

## Copy Updates

### Global Messaging
Old: "Pay fees in stablecoins (USDC/USDT/DAI)"

New: "Pay fees in any token you swap—use input token, skim from output (even when output is native via wrapped deduction), or stick to native gas. Fee is capped on-chain and unused cap is refunded."

### Tooltips
- **Unwrap**: "Native (ETH/POL) is delivered by unwrapping WETH/WPOL after fee handling."
- **Output-fee**: "Fee is skimmed from wrapped output before unwrapping to native."

## Deployment Notes

1. Deploy updated RouterHub and FeeSink contracts
2. Call `RouterHub.setNativeWrapped(WETH/WPOL_ADDRESS)` per chain
3. Call `RouterHub.setFeeSink(FEESINK_ADDRESS)`
4. Update relayer to include Pyth `updateData` for wrapped fee tokens
5. Deploy updated subgraph with new schema
6. Update frontend env with new contract addresses

## PR Title

```
feat(ui+tokens): wallet modal via portal + POL/ETH/USDT support, native unwrap & output-fee skimming, cross-chain routes
```

## Screenshots Needed

1. /market with Connect Wallet modal open (scroll locked, overlays content)
2. /swap with Account dropdown open (not clipped)
3. /swap with POL selected as output (unwrap badge visible)
4. /swap with OUTPUT mode + ETH output (info banner about wrapped fee)
5. Quote panel showing Pyth oracle with age/confidence

## Wave-2 Demo Flow

1. User on Amoy, no POL for gas
2. Select: USDT → POL (same-chain)
3. Fee mode: OUTPUT
4. Get quote → shows "Fee skimmed from WPOL before unwrap"
5. Execute → paymaster sponsors gas
6. User receives POL (native) after unwrap
7. History shows: feeToken=WPOL, mode=OUTPUT, netOut=X POL

## Cross-Chain Demo Flow

1. User on Amoy
2. Select: USDT(Amoy) → ETH(Sepolia)
3. Fee mode: OUTPUT
4. Get quote → shows "Fee skimmed from WETH on Sepolia"
5. Execute → bridge + call
6. User receives ETH (native) on Sepolia
7. History shows: feeToken=WETH, mode=OUTPUT, netOut=X ETH, oracle=Pyth

---

**Status**: ✅ Implementation complete. Ready for testing and PR.
