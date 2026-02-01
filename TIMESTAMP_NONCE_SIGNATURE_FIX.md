# Timestamp Nonce Signature Fix

## Problem
Transactions with timestamp-based nonce were showing **WRONG authority address** on Etherscan, causing signature recovery to fail. The authorization was not appearing in the authorization list.

**Symptoms:**
- Nonce 0: Authority `0x2b5F883F...` ✅ (correct user EOA)
- Timestamp nonce: Authority `0x7E2374E2...` ❌ (wrong address!)

## Root Cause
**Inconsistent message format between signing and serialization**

The code was:
1. Creating `authMessage` object with **BigInt** values
2. Signing with **string** values in the EIP-712 message
3. Returning values from `authMessage` (BigInt) converted to string

This mismatch caused the signature components (r, s, yParity) to be valid for the STRING message, but when the backend tried to recover the signer using the returned values, it got a different address.

## The Fix (Commit cc399ba0)

### Before:
```javascript
// Create with BigInt
const authMessage = {
  chainId: BigInt(chainId),
  address: delegateAddress,
  nonce: BigInt(nonce)
};

// Sign with strings
message: {
  chainId: chainId.toString(),
  address: delegateAddress,
  nonce: nonce.toString()
}

// Return BigInt converted to string
return {
  chainId: authMessage.chainId.toString(),  // From BigInt!
  address: authMessage.address,
  nonce: nonce.toString(),
  yParity, r, s
};
```

### After:
```javascript
// Create once with strings
const authData = {
  chainId: chainId.toString(),
  address: delegateAddress,
  nonce: nonce.toString()
};

// Sign with same object
message: authData

// Return exact same values
return {
  chainId: authData.chainId,
  address: authData.address,
  nonce: authData.nonce,
  yParity, r, s
};
```

### Also Fixed:
Removed redundant serialization in `executeSwap()` that was calling `.toString()` again on already-string values.

## Why This Matters
EIP-712 signature recovery requires the **EXACT same message format** that was signed. Any mismatch in data types (BigInt vs string) will produce a different hash, causing signature recovery to return a wrong address.

## Testing
Push to GitHub: ✅ Commit cc399ba0

**Next test should show:**
- Authority address matches user EOA: `0x2b5F883F...`
- Transaction appears in authorization list
- Validity: TRUE

## Technical Details
- EIP-712 typed data signing is sensitive to data types
- JavaScript BigInt serialization can cause subtle bugs
- Always use consistent format: sign with X, return X (no conversion)
