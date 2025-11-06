# 🔧 RouterHub Upgrade Guide - Nov 6, 2025

## ⚠️ CRITICAL: User Action Required

**Due to a critical bug fix, ALL users must re-approve their tokens to the NEW RouterHub addresses.**

---

## 🐛 Bug Fixed

**Problem:** RouterHub was sending swapped output tokens to the **relayer wallet** instead of the **user wallet**.

**Evidence:**
- Transaction `0x8bcc535c9163712b` on Amoy (Nov 6, 2025)
- User: `0x5a87A3c738cf99DB95787D51B627217B6dE12F62`
- Relayer: `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A`
- User swapped 2 USDC → 1.994 WMATIC
- **WMATIC went to relayer, not user** ❌

**Root Cause:**
```solidity
// OLD CODE (BUGGY):
IERC20(tokenOut).transfer(msg.sender, grossOut); // msg.sender = relayer

// NEW CODE (FIXED):
IERC20(tokenOut).transfer(intent.user, grossOut); // intent.user = actual user ✅
```

**Fix Applied:**
- `RouterHub.sol` lines 83, 96, 102: Changed from `msg.sender` to `intent.user`
- This ensures output tokens go to the actual user who initiated the swap

---

## 📍 New Contract Addresses

### Polygon Amoy Testnet
- **OLD RouterHub (DEPRECATED):** `0x63db4Ac855DD552947238498Ab5da561cce4Ac0b`
- **NEW RouterHub v1.4:** `0x5335f887E69F4B920bb037062382B9C17aA52ec6` ✅
- **Deployment TX:** [View on PolygonScan](https://amoy.polygonscan.com/address/0x5335f887E69F4B920bb037062382B9C17aA52ec6)
- **Gas Used:** 3,310,818 | **Cost:** 0.076 POL

### Ethereum Sepolia Testnet
- **OLD RouterHub (DEPRECATED):** `0x1449279761a3e6642B02E82A7be9E5234be00159`
- **NEW RouterHub v1.4:** `0xC3144E9C3e432b2222DE115989f90468a3A7cd95` ✅
- **Deployment TX:** [View on Etherscan](https://sepolia.etherscan.io/address/0xC3144E9C3e432b2222DE115989f90468a3A7cd95)
- **Gas Used:** 3,310,818 | **Cost:** 0.0033 ETH

---

## 🔐 Required User Actions

### Step 1: Revoke OLD Approvals (Optional but Recommended)

For security, revoke any approvals to the old RouterHub addresses:

**Amoy:**
```
Old RouterHub: 0x63db4Ac855DD552947238498Ab5da561cce4Ac0b
```
- Go to [PolygonScan Token Approval Checker](https://amoy.polygonscan.com/tokenapprovalchecker)
- Connect your wallet
- Find approvals to `0x63db4Ac855DD552947238498Ab5da561cce4Ac0b`
- Click "Revoke" for USDC, WMATIC, etc.

**Sepolia:**
```
Old RouterHub: 0x1449279761a3e6642B02E82A7be9E5234be00159
```
- Go to [Etherscan Token Approval Checker](https://sepolia.etherscan.io/tokenapprovalchecker)
- Connect your wallet
- Find approvals to `0x1449279761a3e6642B02E82A7be9E5234be00159`
- Click "Revoke" for USDC, WETH, etc.

### Step 2: Approve NEW RouterHub

**The ZeroToll frontend will automatically prompt you to approve when you attempt your first swap.**

When you try to swap:
1. Frontend checks your allowance for the new RouterHub
2. If allowance is 0 (or insufficient), MetaMask will pop up with approval request
3. Click "Approve" in MetaMask
4. Wait for confirmation (~5-15 seconds)
5. Frontend will then submit the swap transaction

**Manual Approval (Advanced Users):**

If you want to pre-approve before swapping:

**Amoy USDC Approval:**
```javascript
// USDC Contract: 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582
// New RouterHub: 0x5335f887E69F4B920bb037062382B9C17aA52ec6

// Method: approve(address spender, uint256 amount)
// Spender: 0x5335f887E69F4B920bb037062382B9C17aA52ec6
// Amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935 (max uint256)
```

**Sepolia USDC Approval:**
```javascript
// USDC Contract: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
// New RouterHub: 0xC3144E9C3e432b2222DE115989f90468a3A7cd95

// Method: approve(address spender, uint256 amount)
// Spender: 0xC3144E9C3e432b2222DE115989f90468a3A7cd95
// Amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935 (max uint256)
```

You can do this via:
- MetaMask direct contract interaction
- Etherscan "Write Contract" tab
- Or simply wait for frontend to prompt you

---

## ✅ Verification

After approving, verify your approval:

**Amoy:**
```javascript
// USDC Contract: 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582
// Check allowance(address owner, address spender)
// Owner: Your wallet address
// Spender: 0x5335f887E69F4B920bb037062382B9C17aA52ec6

// Should return: > 0 (ideally max uint256)
```

**Sepolia:**
```javascript
// USDC Contract: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
// Check allowance(address owner, address spender)
// Owner: Your wallet address
// Spender: 0xC3144E9C3e432b2222DE115989f90468a3A7cd95

// Should return: > 0 (ideally max uint256)
```

---

## 📝 Testing the Fix

Once you've approved the new RouterHub:

1. Go to ZeroToll frontend
2. Try swapping: **2 USDC → WMATIC** on Amoy
3. Expected flow:
   - ✅ MetaMask approval popup (if not already approved)
   - ✅ Swap transaction popup
   - ✅ Transaction succeeds
   - ✅ **WMATIC appears in YOUR wallet** (not relayer)
   
4. Verify on PolygonScan:
   - Find your transaction
   - Check Transfer events
   - **Last transfer should be: RouterHub → YOUR_ADDRESS** ✅

---

## 🔄 Migration Status

| Component | Status | Notes |
|-----------|--------|-------|
| RouterHub Contract | ✅ Deployed | Amoy: 0x5335f887..., Sepolia: 0xC3144E9C... |
| Backend Config | ✅ Updated | blockchain_service.py, real_blockchain_service.py, server.py |
| Frontend Config | ✅ Updated | contracts.json, Swap.jsx |
| MockDEXAdapter | ✅ Compatible | No changes needed (stateless) |
| User Approvals | ⚠️ **ACTION REQUIRED** | All users must re-approve |

---

## 💡 Why This Happened

**Token Flow Design:**
1. User signs intent with their wallet address
2. Relayer submits transaction to RouterHub (pays gas)
3. RouterHub pulls tokens from user via `transferFrom(intent.user, ...)`
4. RouterHub swaps via adapter
5. **RouterHub sends output to... WHO?**

**The Bug:**
- RouterHub used `msg.sender` (relayer) as recipient
- But `msg.sender` = relayer who submitted TX, not user who signed intent!
- Result: All swaps went to relayer wallet ❌

**The Fix:**
- RouterHub now uses `intent.user` (actual user) as recipient
- `intent.user` = wallet that signed the intent
- Result: Swaps go to correct user wallet ✅

---

## 📞 Support

If you encounter issues after upgrading:

1. **Approval Errors:** Make sure you approved to the **NEW** RouterHub address
2. **Swap Failures:** Check that old approvals are revoked
3. **Tokens Missing:** Contact team immediately if tokens don't appear after swap
4. **MetaMask Issues:** Try hard refresh (Ctrl+Shift+R)

**Report Issues:**
- GitHub: https://github.com/abeachmad/ZeroToll/issues
- Discord: [Your Discord Link]

---

## 🎯 Deployment Details

**Commit:** `4ed4d63` - "FIX CRITICAL: RouterHub sends output to user, not relayer"

**Deployment Scripts:**
- `packages/contracts/scripts/upgrade-routerhub-amoy.js`
- `packages/contracts/scripts/upgrade-routerhub-sepolia.js`

**Deployment Records:**
- `packages/contracts/deployments/amoy-routerhub-upgrade-1762444245065.json`

**Changed Files:**
- `packages/contracts/contracts/RouterHub.sol` (lines 83, 96, 102)
- `backend/blockchain_service.py` (RouterHub addresses)
- `backend/real_blockchain_service.py` (RouterHub addresses)
- `backend/server.py` (RouterHub addresses in route builder)
- `frontend/src/config/contracts.json` (RouterHub addresses)

---

**Updated:** November 6, 2025  
**Author:** ZeroToll Team  
**Severity:** CRITICAL (affects all user swaps)
