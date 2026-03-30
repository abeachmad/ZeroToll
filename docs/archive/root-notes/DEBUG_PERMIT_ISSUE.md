# Debug: Why Swap Doesn't Execute

## Problem
- ✅ Authorization: VALID (Validity: TRUE)
- ✅ Transaction: SUCCESS
- ❌ Swap: NOT EXECUTED (no token transfer OUT)

## Evidence
Looking at wallet transactions:
- Only ETH IN (gas refund from relayer)
- NO USDC OUT
- NO token transfers at all

## Possible Causes

### 1. Permit Fails (MOST LIKELY)
The contract calls `permit()` at line 160-167:
```solidity
IERC20Permit(intent.tokenIn).permit(
    intent.user,
    address(this),
    intent.amountIn,
    permit.deadline,
    permit.v,
    permit.r,
    permit.s
);
```

**Why it might fail:**
- ❌ USDC domain separator mismatch (we use version "2", might be wrong)
- ❌ Permit nonce incorrect (we query but might get wrong value)
- ❌ Signature format wrong (r, s, v order or values)
- ❌ USDC on Sepolia might not support EIP-2612 permit

### 2. Contract Nonce Mismatch
Line 141: `require(nonces[intent.user] == intent.nonce, "Invalid nonce")`

We're using nonce 0 from backend, but contract might have different nonce for this user.

### 3. Intent Signature Invalid
Line 157: `require(signer == intent.user, "Invalid signature")`

Intent signature recovery might fail.

### 4. Delegation Check Fails
Line 135: `require(address(this) == intent.user, "Invalid delegation")`

When EIP-7702 is active, `address(this)` should equal user's EOA. If this fails, delegation didn't work.

## How to Debug

### Check Transaction Logs
Need to see:
1. **Internal Transactions** - are there any calls?
2. **Logs/Events** - what events were emitted?
3. **State Changes** - did nonce increment?

### Check Contract State
Query contract to see:
1. What is current nonce for user?
2. Did NonceIncremented event fire?

### Check USDC Permit Support
1. Does USDC on Sepolia support EIP-2612?
2. What is the correct domain separator?
3. What version does it use?

## Next Steps

1. **Get transaction logs** - see what events were emitted
2. **Check if permit failed** - look for revert reason
3. **Verify USDC permit support** - query USDC contract
4. **Test permit separately** - try permit without swap

## USDC Sepolia Address
`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

Need to check:
- Does it have `permit()` function?
- What is `DOMAIN_SEPARATOR()`?
- What is `version()`?
- What is current `nonces(user)`?
