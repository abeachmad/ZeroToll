# Pre-Test Checklist - EIP-7702 Implementation

## ✅ VERIFIED COMPONENTS

### 1. Frontend - useEIP7702Swap Hook ✅

#### Authorization Signing ✅
- ✅ Uses consistent string format (no BigInt mismatch)
- ✅ Signs with EIP-712 typed data
- ✅ Returns: chainId, address, nonce, yParity, r, s (all strings)
- ✅ Nonce passed as parameter and used correctly

#### Permit Signing ✅ **CRITICAL FIX**
- ✅ **Queries permit nonce from token contract** (was hardcoded to 0!)
- ✅ Uses USDC version "2" (was "1")
- ✅ Spender set to delegate contract address
- ✅ Returns: deadline, v, r, s
- ✅ Fallback to nonce 0 if query fails

#### Intent Signing ✅
- ✅ All required fields: user, tokenIn, tokenOut, amountIn, minAmountOut, deadline, nonce, chainId
- ✅ Signs with EIP-712 typed data
- ✅ Domain: name="ZeroTollDelegate", version="1", verifyingContract=delegateAddress
- ✅ Returns: intent object + signature

#### Execute Flow ✅
- ✅ Step 1: Get quote from backend
- ✅ Step 2: Get nonce (returns "0" for now)
- ✅ Step 3: Sign authorization with nonce
- ✅ Step 4: Sign permit with queried nonce
- ✅ Step 5: Sign intent
- ✅ Step 6: Send all to backend /api/eip7702/execute
- ✅ Authorization already in string format (no re-serialization)

### 2. Backend - Routes ✅

#### Nonce Endpoint ✅
- ✅ Returns nonce "0" (sequential, not timestamp)
- ✅ Reason: Sepolia testnet issues with large nonces
- ✅ Will use timestamp on mainnet

#### Quote Endpoint ✅
- ✅ Calculates fee (1% of amountIn)
- ✅ Returns quote with all required fields

#### Execute Endpoint ✅
- ✅ Receives: chainId, authorization, permit, intent, intentSignature, fee
- ✅ Calls relayer via subprocess
- ✅ Timeout: 6 minutes (360 seconds)
- ✅ Returns: txHash, explorerUrl, success status

### 3. Backend - Relayer ✅

#### Authorization Handling ✅
- ✅ Converts to BigInt format for viem
- ✅ Verifies delegate address matches
- ✅ Logs all authorization components

#### Transaction Construction ✅
- ✅ **to: intent.user** (USER EOA, not delegate!) ✅✅✅
- ✅ data: encodeFunctionData for execute()
- ✅ authorizationList: [authorizationFormatted]
- ✅ Gas: estimated + 50k buffer
- ✅ Gas prices: 50 gwei max, 2 gwei tip

#### Function Call Encoding ✅
- ✅ Function: execute(intent, intentSignature, permit, fee)
- ✅ ABI matches ZeroTollDelegate.sol
- ✅ All parameters passed correctly

### 4. Smart Contract - ZeroTollDelegate.sol ✅

#### Execute Function ✅
- ✅ Verifies: address(this) == intent.user (delegation check)
- ✅ Verifies: deadline not expired
- ✅ Verifies: nonce matches and increments
- ✅ Verifies: intent signature (EIP-712)
- ✅ Executes: permit() for gasless approval
- ✅ Transfers: tokens from user to contract
- ✅ Transfers: fee to treasury
- ✅ Approves: router for swap
- ✅ Executes: swap via router
- ✅ Handles: native token unwrap if needed
- ✅ Transfers: output tokens to user

### 5. Configuration ✅

#### Delegate Addresses ✅
- ✅ Sepolia: 0xcFE005B2E0013e0FF8cB0569d9b103094d423B36
- ✅ Amoy: 0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C
- ✅ Consistent across frontend, backend, relayer

#### API URL ✅
- ✅ Frontend: process.env.REACT_APP_BACKEND_URL || 'http://localhost:3002'
- ✅ Should be: http://localhost:8000 (backend port)

⚠️ **POTENTIAL ISSUE**: Frontend API_URL default is 3002, but backend runs on 8000!

#### RPC URLs ✅
- ✅ Sepolia: ethereum-sepolia-rpc.publicnode.com (primary)
- ✅ Multiple fallbacks configured
- ✅ Timeout: 5 minutes for gas estimation

## ⚠️ ISSUES FOUND

### CRITICAL: Frontend API URL Mismatch
```javascript
// frontend/src/hooks/useEIP7702Swap.js
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3002';
```

**Should be:**
```javascript
const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
```

Backend runs on port 8000, not 3002!

## 🔧 REQUIRED FIX BEFORE TEST

Need to fix API_URL in frontend to point to correct backend port!

## ✅ WHAT SHOULD HAPPEN IN TEST

### Expected Flow:
1. User clicks "Swap 1 USDC to ETH"
2. Frontend queries permit nonce from USDC contract
3. User signs 3 signatures:
   - Authorization (EIP-7702)
   - Permit (EIP-2612) with correct nonce
   - Intent (EIP-712)
4. Frontend sends to backend
5. Backend calls relayer
6. Relayer sends transaction to user's EOA with authorization
7. User's EOA temporarily becomes delegate contract
8. Delegate executes:
   - Permit (approve delegate)
   - Transfer USDC from user
   - Transfer fee to treasury
   - Swap USDC → WETH via router
   - Unwrap WETH → ETH
   - ETH stays in user's EOA

### Expected Result on Etherscan:
- ✅ Transaction to user's EOA (0x7E98e08F...)
- ✅ Authorization recorded with Validity: TRUE
- ✅ USDC Transfer OUT from user
- ✅ ETH balance increase in user wallet
- ✅ Multiple internal transactions (permit, transfer, swap, unwrap)

## 📊 PREVIOUS FAILURES EXPLAINED

### Why Previous Transactions Failed:
1. **Permit nonce hardcoded to 0** → Permit signature invalid → No approval → No transfer → No swap
2. **USDC version "1" instead of "2"** → Permit signature invalid
3. **Result**: Transaction succeeded but did nothing (only gas refund visible)

### Why This Should Work Now:
1. ✅ Permit nonce queried from contract
2. ✅ USDC version corrected to "2"
3. ✅ All other components verified correct

## 🚀 READY TO TEST

After fixing API_URL, implementation should be ready for testing!
