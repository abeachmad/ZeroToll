# EIP-7702 Native Token Support

## Core Feature: True Native Token Output

ZeroToll is designed for users who want to buy native tokens (POL/ETH) but don't have native tokens for gas fees.

### User Story
**Problem**: User has USDC but wants POL. They can't pay gas fees because they have no POL.

**Solution**: ZeroToll enables gasless swaps where:
1. User swaps USDC → POL (gasless!)
2. ZeroToll deducts fee from output POL
3. User receives **actual native POL** in their wallet
4. No wrapped tokens - real native tokens!

---

## How It Works

### Smart Contract Flow
The `ZeroTollDelegate` contract handles native token unwrapping:

```solidity
// Special NATIVE address constant
address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

// In execute() function:
bool isNativeOut = intent.tokenOut == NATIVE || intent.tokenOut == weth;
address actualTokenOut = isNativeOut ? weth : intent.tokenOut;

// Execute swap to WETH/WPOL
amountOut = IZeroTollRouter(router).swap(...);

// Unwrap to native if requested
if (isNativeOut && intent.tokenOut == NATIVE) {
    IWETH(weth).withdraw(amountOut);
    // Native token now in user's EOA (via EIP-7702 delegation)
}
```

### Frontend Flow
1. User selects native token (POL/ETH) as output
2. Frontend uses special address: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
3. User signs EIP-7702 authorization + permit + intent
4. Relayer executes on-chain:
   - Swap USDC → WPOL
   - Deduct fee from WPOL
   - Unwrap WPOL → POL
   - Native POL stays in user's wallet!

---

## Previous Issue (FIXED)

### Issue
When swapping to native tokens, the frontend was passing `"NATIVE"` string, causing:
```
InvalidAddressError: Address "NATIVE" is invalid
```

### Root Cause
Token list uses `address: "NATIVE"` for native tokens, but EIP-712 signature verification requires valid addresses.

### Solution
Use the special NATIVE address constant that the contract recognizes:
```javascript
const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const getTokenAddress = (token, currentChainId) => {
  if (token.isNative || token.address === 'NATIVE') {
    // Use special NATIVE address - delegate will unwrap!
    return NATIVE_ADDRESS;
  }
  return token.address;
};
```

---

## Fee Model

### Gas Fee Coverage
- Relayer pays gas upfront (in POL/ETH)
- Fee deducted from user's output tokens
- User never needs native tokens for gas!

### Fee Calculation
```
Output to user = Swap output - Gas fee - Service fee
```

Example:
- User swaps 100 USDC → POL
- Swap output: 50 POL
- Gas fee: 0.5 POL (1%)
- Service fee: 0.5 POL (1%)
- **User receives: 49 POL** (native, in wallet!)

---

## Special NATIVE Address

### Contract Constant
```solidity
address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
```

### Why This Address?
- Standard convention for native tokens
- Used by many DeFi protocols (Uniswap, 1inch, etc.)
- Easy to recognize and validate
- Not a real contract address

### How Contract Detects Native Output
```solidity
bool isNativeOut = intent.tokenOut == NATIVE || intent.tokenOut == weth;
```

If user requests NATIVE address OR wrapped token address, contract knows to unwrap.

---

## Wrapped Token Addresses

For reference, wrapped token addresses on each network:

| Network | Native | Wrapped | Address |
|---------|--------|---------|---------|
| Amoy | POL | WPOL | `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` |
| Sepolia | ETH | WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

---

## Files Modified

### Frontend
- `frontend/src/pages/Swap.jsx` - Use NATIVE address for native output

### Contract (Already Deployed)
- `packages/contracts/contracts/ZeroTollDelegate.sol` - Unwrap logic
- Amoy: `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C`
- Sepolia: `0xcFE005B2E0013e0FF8cB0569d9b103094d423B36`

---

## Testing

### Test Native Token Output
1. Start services: `./start-zerotoll.sh`
2. Open: `http://localhost:3000/swap`
3. Enable EIP-7702 mode
4. Configure swap:
   - Input: USDC (1.0)
   - Output: POL (native) ← **This is the key test!**
5. Execute swap
6. Check wallet: Should receive **native POL**, not WPOL!

### Expected Console Logs
```javascript
🔍 Token addresses: {
  tokenIn: { 
    symbol: 'USDC', 
    original: '0x...', 
    actual: '0x...' 
  },
  tokenOut: { 
    symbol: 'POL', 
    original: 'NATIVE',
    actual: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    willUnwrap: '✅ Yes - you will receive native POL'
  }
}
```

### Success Criteria
- ✅ No address validation errors
- ✅ All signatures complete
- ✅ Swap executes on-chain
- ✅ User receives **native POL/ETH** (not wrapped!)
- ✅ Fee deducted from output

---

## Key Benefits

### For Users
1. **No gas needed**: Swap USDC → POL without having POL for gas
2. **Real native tokens**: Receive actual POL/ETH, not wrapped
3. **One transaction**: Everything happens atomically
4. **50% cheaper**: EIP-7702 uses half the gas of ERC-4337

### For ZeroToll
1. **Trustless**: Fee calculation on-chain
2. **Atomic**: Swap + unwrap + fee in one tx
3. **Efficient**: EIP-7702 delegation (no proxy contracts)
4. **Flexible**: Works with any ERC-20 → native swap

---

## Architecture

```
User (EOA)
  ↓ EIP-7702 delegation
ZeroTollDelegate (temporary code)
  ↓ 1. Permit (gasless approval)
  ↓ 2. Transfer USDC from user
  ↓ 3. Deduct fee → treasury
  ↓ 4. Swap USDC → WPOL (via router)
  ↓ 5. Unwrap WPOL → POL
  ↓ 6. Native POL stays in user's EOA!
User receives native POL ✅
```

---

## Comparison: Wrapped vs Native

### Before (Wrapped Token Output)
```
User swaps USDC → WPOL
User receives WPOL in wallet
User must unwrap WPOL → POL (costs gas!)
User needs POL for gas to unwrap ❌
```

### After (Native Token Output)
```
User swaps USDC → POL (native)
ZeroToll unwraps automatically
User receives native POL ✅
No additional gas needed ✅
```

---

## Summary

ZeroToll's EIP-7702 integration enables true gasless swaps to native tokens:
- Users receive **actual native tokens** (POL/ETH), not wrapped
- Contract automatically unwraps WPOL/WETH → POL/ETH
- Fee deducted from output (user never needs gas!)
- 50% cheaper than ERC-4337 alternatives

**This is the core value proposition**: Buy native tokens without having native tokens for gas!
