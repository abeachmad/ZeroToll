# Permit Nonce Fix - Why Swap Didn't Execute

## Problem
Transaksi EIP-7702 berhasil dikirim dan dikonfirmasi, tapi **SWAP TIDAK TERJADI!**

Evidence:
- ✅ Transaction confirmed (Status: Success)
- ✅ Authorization recorded on Etherscan
- ❌ NO token transfer OUT from user wallet
- ❌ Only gas refund IN (ETH from relayer)

## Root Cause

**PERMIT SIGNATURE INVALID!**

The code was hardcoding permit nonce to 0:

```javascript
nonce: 0, // Simplified - should query token contract
```

### Why This Breaks Swap

1. User signs permit with nonce 0
2. If user has used permit before, actual nonce is > 0
3. Contract calls `permit()` with invalid nonce
4. Permit fails → No approval → Transfer fails → Swap reverts
5. Transaction succeeds but does nothing (no state change)

### Additional Issues

1. **USDC Version**: Was using version '1', should be '2'
2. **Nonce Query**: Must query from token contract, not hardcode

## The Fix (Commit 49034605)

### Query Permit Nonce from Token Contract

```javascript
// Query permit nonce from token contract
let permitNonce = 0;
try {
  if (publicClient) {
    permitNonce = await publicClient.readContract({
      address: tokenAddress,
      abi: [{
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "nonces",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }],
      functionName: 'nonces',
      args: [address]
    });
    console.log('📊 Permit nonce from token:', permitNonce.toString());
  }
} catch (err) {
  console.warn('⚠️  Could not query permit nonce, using 0:', err.message);
}
```

### Use Correct USDC Version

```javascript
domain: {
  name: 'USD Coin',
  version: '2', // USDC uses version 2, not 1!
  chainId: chainId,
  verifyingContract: tokenAddress
}
```

## How EIP-7702 Swap Should Work

1. **Authorization**: User signs EIP-7702 authorization for delegate contract
2. **Permit**: User signs EIP-2612 permit for token approval (with CORRECT nonce!)
3. **Intent**: User signs swap intent
4. **Execution**: Relayer sends transaction to user's EOA with authorization
5. **Delegation**: User's EOA temporarily becomes delegate contract
6. **Permit Execution**: Delegate calls `permit()` on token (must have valid nonce!)
7. **Transfer**: Delegate transfers tokens from user
8. **Swap**: Delegate executes swap via router
9. **Output**: User receives output tokens

## Why Previous Transactions Showed No Swap

All previous transactions:
- ✅ Authorization valid
- ✅ Intent signature valid
- ❌ **Permit signature INVALID** (wrong nonce!)
- Result: Transaction succeeds but permit fails → no approval → no transfer → no swap

Only gas refund visible because relayer pays gas, but no actual swap happens.

## Testing

Next transaction should show:
- ✅ Authorization recorded
- ✅ USDC transfer OUT from user
- ✅ ETH transfer IN to user (swap output)
- ✅ Actual swap executed!

## References

- EIP-2612 Permit: https://eips.ethereum.org/EIPS/eip-2612
- USDC Permit Implementation: Uses version "2" in domain separator
- Nonce Management: Each permit increments nonce, must query current value
