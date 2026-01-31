# BigInt Serialization Fix

**Date**: January 31, 2026
**Error**: `TypeError: Do not know how to serialize a BigInt`
**Status**: ✅ FIXED

---

## Error Details

### Console Error
```
useEIP7702Swap.js:319 Swap error: TypeError: Do not know how to serialize a BigInt
    at JSON.stringify (<anonymous>)
    at Object.executeSwap (useEIP7702Swap.js:296:1)
```

### Root Cause
JavaScript's `JSON.stringify()` cannot serialize BigInt values. The `authorization` object contained BigInt values:

```javascript
const authorization = {
  chainId: BigInt(chainId),  // ← BigInt cannot be serialized!
  address: delegateAddress,
  nonce: 0n  // ← BigInt literal!
};

// Later...
JSON.stringify({ authorization, ... }); // ← Error!
```

---

## Solution

Convert BigInt values to strings before JSON serialization:

```javascript
// Convert BigInt values to strings for JSON serialization
const serializableAuthorization = {
  chainId: authorization.chainId.toString(),
  address: authorization.address,
  nonce: authorization.nonce.toString(),
  signature: authorization.signature
};

const response = await fetch(`${API_URL}/api/eip7702/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chainId,
    authorization: serializableAuthorization, // ← Now serializable!
    permit,
    intent,
    intentSignature,
    fee: quote.fee
  })
});
```

---

## Why This Happens

### BigInt in JavaScript
- BigInt is a primitive type for arbitrary-precision integers
- Introduced in ES2020
- Cannot be serialized by default JSON.stringify()

### Common Sources of BigInt
1. Viem/ethers return BigInt for uint256 values
2. BigInt literals: `0n`, `1n`, etc.
3. BigInt() constructor: `BigInt(123)`

### Why JSON.stringify() Fails
```javascript
JSON.stringify({ value: 123n });
// TypeError: Do not know how to serialize a BigInt

JSON.stringify({ value: "123" });
// ✅ Works: '{"value":"123"}'
```

---

## Other Objects Already Handled

### Intent Object ✅
Already converts BigInt to strings:
```javascript
const intent = {
  user: address,
  tokenIn,
  tokenOut,
  amountIn: amountIn.toString(),  // ✅ Already string
  minAmountOut: minAmountOut.toString(),  // ✅ Already string
  deadline,
  nonce: nonce.toString(),  // ✅ Already string
  chainId: chainId.toString()  // ✅ Already string
};
```

### Permit Object ✅
Already uses primitives:
```javascript
const permit = {
  owner: address,
  spender: delegateAddress,
  value: amount.toString(),  // ✅ Already string
  nonce: 0,  // ✅ Number, not BigInt
  deadline  // ✅ Number, not BigInt
};
```

### Authorization Object ❌ → ✅
Was using BigInt, now fixed:
```javascript
// Before (❌)
const authorization = {
  chainId: BigInt(chainId),  // ❌ BigInt
  address: delegateAddress,
  nonce: 0n  // ❌ BigInt
};

// After (✅)
const serializableAuthorization = {
  chainId: authorization.chainId.toString(),  // ✅ String
  address: authorization.address,
  nonce: authorization.nonce.toString(),  // ✅ String
  signature: authorization.signature
};
```

---

## Testing Progress

### ✅ Working Now
1. ChainId scope error - FIXED
2. Native token address - FIXED (using NATIVE address)
3. BigInt serialization - FIXED (convert to strings)
4. All 3 signatures complete successfully
5. Quote fetched from backend
6. Nonce fallback to '0' works

### ⏳ Next Step
Execute swap on backend and verify transaction

---

## Files Modified

### frontend/src/hooks/useEIP7702Swap.js
**Line ~292-308**: Added BigInt to string conversion before JSON.stringify

**Before**:
```javascript
body: JSON.stringify({
  chainId,
  authorization,  // ← Contains BigInt!
  permit,
  intent,
  intentSignature,
  fee: quote.fee
})
```

**After**:
```javascript
const serializableAuthorization = {
  chainId: authorization.chainId.toString(),
  address: authorization.address,
  nonce: authorization.nonce.toString(),
  signature: authorization.signature
};

body: JSON.stringify({
  chainId,
  authorization: serializableAuthorization,  // ← All strings!
  permit,
  intent,
  intentSignature,
  fee: quote.fee
})
```

---

## Alternative Solutions

### 1. Custom JSON Replacer (Not Used)
```javascript
JSON.stringify(obj, (key, value) =>
  typeof value === 'bigint' ? value.toString() : value
);
```
**Why not**: Need to convert at source for clarity

### 2. BigInt.prototype.toJSON (Not Used)
```javascript
BigInt.prototype.toJSON = function() { return this.toString(); };
```
**Why not**: Modifying prototypes is bad practice

### 3. Convert at Source (✅ Used)
```javascript
const serializableAuthorization = {
  chainId: authorization.chainId.toString(),
  nonce: authorization.nonce.toString(),
  ...
};
```
**Why yes**: Explicit, clear, maintainable

---

## Lessons Learned

### 1. Always Convert BigInt Before JSON
When working with blockchain data (viem, ethers), always convert BigInt to strings before JSON operations.

### 2. Check All Objects
Don't assume - check every object being serialized for BigInt values.

### 3. Convert at Source
Convert BigInt to strings as close to the source as possible, not at serialization time.

### 4. Use .toString()
Always use `.toString()` for BigInt conversion, not String() constructor.

---

## Summary

Fixed BigInt serialization error by converting authorization object's BigInt values to strings before JSON.stringify(). All signatures now complete successfully and swap request can be sent to backend.

**Status**: ✅ Ready for backend execution testing
**Next**: Verify backend processes the request and executes swap on-chain

---

## Quick Test

### Expected Flow
1. User clicks "Execute EIP-7702"
2. Signs 3 messages (authorization, permit, intent) ✅
3. Frontend sends request to backend ✅
4. Backend executes swap on-chain ⏳
5. User receives native tokens ⏳

### Console Output (Success)
```
📊 Getting quote... ✅
Quote: {...} ✅
🔢 Getting nonce... ✅
Nonce: 0 ✅
✍️  Signing EIP-7702 authorization... ✅
Authorization signed ✅
✍️  Signing permit... ✅
Permit signed ✅
✍️  Signing intent... ✅
Intent signed ✅
🚀 Executing swap... ✅
✅ Swap executed: {...} ⏳
```

**Status**: Frontend complete, waiting for backend execution ✅
