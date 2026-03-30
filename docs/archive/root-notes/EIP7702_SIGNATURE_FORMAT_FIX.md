# EIP-7702 Signature Format Fix

## Problem
Transactions showing "Validity: FALSE" in authorization list on Etherscan.

**Evidence:**
- Transaction Action shows: `Call 0xdc496c4b Method by 0xf304eeD8...`
- Should show: `EIP-7702: 0x2b5F883F... Delegate to 0xcFE005B2...`
- Authorization not recognized by network

## Root Cause

**Using EIP-712 for signing instead of proper EIP-7702 format!**

### What We Were Doing (WRONG):
```javascript
// Using EIP-712 typed data signing
const signature = await signTypedDataAsync({
  domain: { name: 'EIP7702Authorization', ... },
  types: { Authorization: [...] },
  message: { chainId, address, nonce }
});
```

This creates a signature that:
- ✅ Is valid for EIP-712
- ❌ Is NOT valid for EIP-7702
- ❌ Cannot be recovered by network
- ❌ Shows as "Validity: FALSE"

### What We Should Do (CORRECT):
```javascript
// Use viem's signAuthorization from experimental package
const { eip7702Actions } = await import('viem/experimental');
const client = walletClient.extend(eip7702Actions());

const authorization = await client.signAuthorization({
  contractAddress: delegateAddress,
  chainId: chainId,
  nonce: BigInt(nonce)
});
```

This creates a signature that:
- ✅ Is valid for EIP-7702
- ✅ Can be recovered by network
- ✅ Shows as "Validity: TRUE"
- ✅ Transaction Action shows "EIP-7702: ... Delegate to ..."

## EIP-7702 Signature Format

EIP-7702 requires signing:
```
keccak256(MAGIC || rlp([chain_id, address, nonce]))
```

Where:
- MAGIC = 0x05
- RLP encoding of [chain_id, address, nonce]

This is DIFFERENT from EIP-712 which uses:
```
keccak256("\x19\x01" || domainSeparator || structHash)
```

## The Fix (Commit bc27cc85)

### Changed:
```javascript
// OLD: EIP-712 signing
const signature = await signTypedDataAsync({...});

// NEW: EIP-7702 signing via viem
const { eip7702Actions } = await import('viem/experimental');
const client = walletClient.extend(eip7702Actions());
const authorization = await client.signAuthorization({
  contractAddress: delegateAddress,
  chainId: chainId,
  nonce: BigInt(nonce)
});
```

### Why This Works:
- viem's `signAuthorization` implements the correct EIP-7702 signature format
- Creates proper authorization tuple with correct signature
- Network can recover signer address correctly
- Authorization shows as "Validity: TRUE"

## Expected Result After Fix

### Transaction Action:
```
EIP-7702: 0x7E98e08F...2500373E2
Delegate to 0xcFE005B2...94d423B36
```

### Authorization List:
```
Delegated Address: 0xcFE005B2...94d423B36
Tx Sender: 0xf304eeD8...2051d1D7A
Nonce: 0
Validity: TRUE ✅
```

### Console Output:
```
📝 Signing EIP-7702 authorization with nonce: 0
✅ Authorization signed: {
  chainId: 11155111n,
  contractAddress: '0xcFE005B2...',
  nonce: 0n,
  yParity: 0,
  r: '0x...',
  s: '0x...'
}
```

## Requirements

- viem version with experimental EIP-7702 support
- Wallet that supports EIP-7702 signing (MetaMask, etc.)
- Network with EIP-7702 activated (Sepolia, mainnet)

## References

- EIP-7702 Spec: https://eips.ethereum.org/EIPS/eip-7702
- Viem EIP-7702 Docs: https://viem.sh/experimental/eip7702
- QuickNode Guide: https://www.quicknode.com/guides/ethereum-development/transactions/eip-7702-implementation-guide
