# ✅ PRIORITY 1 TESTING - RouterHub v1.4 Verification

**Date:** November 8, 2025  
**Status:** 🟢 Backend & Frontend Running - Ready for Testing  
**Goal:** Verify swap works with NEW RouterHub v1.4 and tokens go to USER wallet

---

## 🎯 PRE-TEST VERIFICATION

### ✅ Backend Status
```
Service: RUNNING ✅
Port: 8000
Log: /tmp/zerotoll_backend.log

Configuration Verified:
- Amoy RouterHub v1.4:   0x5335f887E69F4B920bb037062382B9C17aA52ec6 ✅
- Sepolia RouterHub v1.4: 0xC3144E9C3e432b2222DE115989f90468a3A7cd95 ✅
```

### ✅ Frontend Status
```
Service: RUNNING ✅
Port: 3000
URL: http://localhost:3000
Log: /tmp/zerotoll_frontend.log
```

### ⚠️ User Action Required

**CRITICAL:** User MUST approve USDC to NEW RouterHub addresses!

**Old Approvals (INVALID):**
- ❌ Amoy: 0x63db4Ac855DD552947238498Ab5da561cce4Ac0b (OLD)
- ❌ Sepolia: 0x1449279761a3e6642B02E82A7be9E5234be00159 (OLD)

**New Approvals (REQUIRED) - UPDATED NOV 8, 2025:**
- ✅ Amoy: 0x5335f887E69F4B920bb037062382B9C17aA52ec6 (RouterHub v1.4)
- ✅ Sepolia: 0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd (RouterHub v1.4 - NEWEST!)

---

## 📝 TESTING CHECKLIST

### Test 1: Amoy Network - USDC → WMATIC (INPUT Fee Mode)

**Pre-requisites:**
- [ ] Wallet connected to Amoy network (Chain ID: 80002)
- [ ] Wallet has USDC balance (at least 5 USDC)
- [ ] Wallet has POL for gas (at least 0.01 POL)

**Step 1: Check Current Approval**
```
Go to: https://amoy.polygonscan.com/token/0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582#writeContract

Connect your wallet
Check allowance:
  - holder (address): [YOUR_WALLET_ADDRESS]
  - spender (address): 0x5335f887E69F4B920bb037062382B9C17aA52ec6
  
If allowance = 0 → Must approve!
```

**Step 2: Approve USDC to NEW RouterHub**
```
Token: USDC - 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582
Spender: 0x5335f887E69F4B920bb037062382B9C17aA52ec6 (RouterHub v1.4)
Amount: 115792089237316195423570985008687907853269984665640564039457584007913129639935
        (max uint256 = unlimited approval)

MetaMask will popup → Click "Approve"
Wait for confirmation (5-15 seconds)

Verify on PolygonScan:
  Check "allowance" again → Should show max value
```

**Step 3: Execute Swap**
```
1. Go to http://localhost:3000
2. Connect wallet (top right)
3. Select:
   - From Chain: Polygon Amoy
   - To Chain: Polygon Amoy (same chain)
   - Token In: USDC
   - Amount: 3 USDC
   - Token Out: WMATIC
   - Fee Mode: INPUT (pay fee from input token)
   
4. Click "Get Quote"
   - Wait for quote (2-3 seconds)
   - Check estimated output: ~5.3 WMATIC
   
5. Click "Execute Swap"
   - MetaMask popup appears
   - Review transaction details
   - Click "Confirm"
   
6. Wait for transaction (15-30 seconds)
```

**Step 4: Verify Transaction Success**

**A. Check Frontend Display:**
```
- [ ] Success message appears
- [ ] Transaction hash shown (0x...)
- [ ] Explorer link appears
- [ ] Link format: https://amoy.polygonscan.com/tx/[HASH]
- [ ] Only ONE explorer link (same-chain swap)
```

**B. Check PolygonScan:**
```
Open: https://amoy.polygonscan.com/tx/[YOUR_TX_HASH]

Verify:
- [ ] Status: Success ✅ (NOT "Failed" ❌)
- [ ] From: [YOUR_WALLET]
- [ ] To: 0x5335f887E69F4B920bb037062382B9C17aA52ec6 (RouterHub v1.4) ✅
- [ ] Method: executeRoute

Click "Logs" tab:
- [ ] Event "RouteExecuted" exists
- [ ] Check Transfer events order

Click "State" tab:
- [ ] Find LAST Transfer event
- [ ] From: 0x5335f887E69F4B920bb037062382B9C17aA52ec6 (RouterHub)
- [ ] To: [YOUR_WALLET_ADDRESS] ✅ NOT RELAYER!
- [ ] Token: WMATIC
- [ ] Amount: ~5.3 WMATIC
```

**C. Check Wallet Balance:**
```
MetaMask → Assets tab
- [ ] USDC balance decreased by ~3 USDC
- [ ] WMATIC balance INCREASED ✅
- [ ] Increment amount: ~5.3 WMATIC
```

**Expected Result:**
```
✅ Transaction succeeds
✅ WMATIC appears in YOUR wallet
✅ NOT in relayer wallet (0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A)
```

**If Transaction REVERTS:**
```
❌ Check backend log:
tail -50 /tmp/zerotoll_backend.log

❌ Common errors:
- "ERC20: transfer amount exceeds allowance"
  → User didn't approve to NEW RouterHub
  → Go back to Step 2

- "ERC20: insufficient allowance"  
  → Approval to wrong address
  → Check spender = 0x5335f887E69F4B920bb037062382B9C17aA52ec6

- "Slippage exceeded"
  → Try again with higher slippage tolerance
```

---

### Test 2: Amoy Network - LINK → USDC (OUTPUT Fee Mode)

**Pre-requisites:**
- [ ] Wallet has LINK balance (at least 0.2 LINK)
- [ ] LINK approved to RouterHub v1.4

**Steps:**
```
1. Frontend: Select LINK → USDC
2. Fee Mode: OUTPUT (fee deducted from output)
3. Amount: 0.1 LINK
4. Expected output: ~2.2 USDC (after fee)
5. Execute and verify
```

**Verification:**
- [ ] USDC received in wallet (not relayer)
- [ ] Amount = quote - fee
- [ ] Transaction status = Success

---

### Test 3: Sepolia Network - USDC → WETH (INPUT Fee Mode)

**Pre-requisites:**
- [ ] Switch network to Sepolia (Chain ID: 11155111)
- [ ] Wallet has USDC (at least 5 USDC)
- [ ] Wallet has ETH for gas (at least 0.005 ETH)

**Step 1: Approve USDC to NEW RouterHub**
```
Token: USDC - 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
Spender: 0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd (RouterHub v1.4 - Nov 8 upgrade)
Amount: max uint256

⚠️ CRITICAL: This is a NEW address! Old approvals to 0xC3144E9C... are INVALID!

Check: https://sepolia.etherscan.io/token/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238#writeContract
```

**Step 2: Execute Swap**
```
1. Frontend: Sepolia → Sepolia (same chain)
2. Token: USDC → WETH
3. Amount: 3 USDC
4. Fee Mode: INPUT
5. Execute
```

**Verification:**
- [ ] Transaction succeeds on Sepolia
- [ ] WETH received in YOUR wallet
- [ ] Check: https://sepolia.etherscan.io/tx/[HASH]
- [ ] Last transfer: RouterHub → YOUR_WALLET ✅

---

### Test 4: Sepolia Network - ETH → USDC (OUTPUT Fee Mode)

**Pre-requisites:**
- [ ] Wallet has ETH (at least 0.001 ETH)

**Steps:**
```
1. Frontend: ETH (native) → USDC
2. Amount: 0.0007 ETH
3. Fee Mode: OUTPUT
4. Expected: ~2.45 USDC (after fee)
5. Execute
```

**Verification:**
- [ ] USDC received in wallet
- [ ] ETH balance decreased
- [ ] No approval needed (native token)

---

## 🔍 VERIFICATION POINTS

### Critical Success Criteria:

**1. Transaction Sent to CORRECT RouterHub:**
```
✅ Amoy TX → 0x5335f887E69F4B920bb037062382B9C17aA52ec6
✅ Sepolia TX → 0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd (UPDATED NOV 8!)

❌ NOT to OLD addresses:
   0x63db4Ac855DD552947238498Ab5da561cce4Ac0b (Amoy OLD)
   0x1449279761a3e6642B02E82A7be9E5234be00159 (Sepolia OLD v1.2)
   0xC3144E9C3e432b2222DE115989f90468a3A7cd95 (Sepolia OLD v1.3)
```

**2. Output Tokens Go to USER:**
```
Check PolygonScan/Etherscan Transfer events:
LAST transfer MUST be:

From: RouterHub (0x5335f887... or 0x15dbf63c...)
To: YOUR_WALLET_ADDRESS ✅
NOT To: 0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A (relayer) ❌
```

**3. Backend Logs Show Correct Address:**
```bash
tail -100 /tmp/zerotoll_backend.log | grep "Recipient (RouterHub)"

Expected:
"Recipient (RouterHub): 0x5335f887E69F4B920bb037062382B9C17aA52ec6"  ✅

NOT:
"Recipient (RouterHub): 0x63db4Ac855DD552947238498Ab5da561cce4Ac0b"  ❌
```

---

## 📊 RESULTS TRACKING

### Test Results:

| Test | Network | Pair | Fee Mode | TX Hash | Status | Tokens to User? |
|------|---------|------|----------|---------|--------|-----------------|
| 1 | Amoy | USDC→WMATIC | INPUT | | ⏳ Pending | |
| 2 | Amoy | LINK→USDC | OUTPUT | | ⏳ Pending | |
| 3 | Sepolia | USDC→WETH | INPUT | | ⏳ Pending | |
| 4 | Sepolia | ETH→USDC | OUTPUT | | ⏳ Pending | |

**Fill in after each test:**
- TX Hash: Link to PolygonScan/Etherscan
- Status: ✅ Success / ❌ Failed / ⚠️ Reverted
- Tokens to User?: ✅ Yes (check last transfer) / ❌ No (went to relayer)

---

## 🐛 TROUBLESHOOTING

### Issue 1: "Approve" button doesn't work
```
Problem: MetaMask doesn't popup when clicking Approve

Solutions:
1. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R)
2. Check MetaMask is unlocked
3. Check correct network selected (Amoy or Sepolia)
4. Check popup blocker disabled
5. Try manual approve via PolygonScan/Etherscan
```

### Issue 2: Transaction reverts with "exceeds allowance"
```
Problem: User didn't approve to NEW RouterHub

Solutions:
1. Check approval address in MetaMask transaction
2. Must be: 0x5335f887... (Amoy) or 0xC3144E9C... (Sepolia)
3. Verify allowance on explorer
4. If wrong address, approve again to correct one
```

### Issue 3: Tokens go to relayer instead of user
```
Problem: Backend using OLD RouterHub address

Solutions:
1. Check backend log:
   tail -50 /tmp/zerotoll_backend.log | grep RouterHub
   
2. Verify .env loaded:
   cd backend && source venv/bin/activate
   python -c "import os; from dotenv import load_dotenv; load_dotenv('.env'); print(os.getenv('AMOY_ROUTERHUB'))"
   
3. Should show: 0x5335f887E69F4B920bb037062382B9C17aA52ec6
4. If shows OLD address → restart backend
```

### Issue 4: Frontend shows wrong explorer link
```
Problem: Shows both Sepolia + Amoy links for same-chain swap

Status: SHOULD BE FIXED in latest code
- Same-chain: Shows 1 link only
- Cross-chain: Shows 2 links (source + dest)

If still wrong: Hard refresh (Ctrl+Shift+R)
```

---

## 📞 SUPPORT COMMANDS

### Check Backend Status:
```bash
lsof -i :8000 | head -2
tail -50 /tmp/zerotoll_backend.log
```

### Check Frontend Status:
```bash
lsof -i :3000 | head -2
tail -50 /tmp/zerotoll_frontend.log
```

### Verify RouterHub Addresses:
```bash
cd /home/abeachmad/ZeroToll/backend
source venv/bin/activate
python3 -c "
import os
from dotenv import load_dotenv
load_dotenv('.env')
print('Amoy:', os.getenv('AMOY_ROUTERHUB'))
print('Sepolia:', os.getenv('SEPOLIA_ROUTERHUB'))
"
```

### Restart Services:
```bash
# Stop all
pkill -f "uvicorn.*server:app"
pkill -f "node.*react-scripts"

# Start backend
cd /home/abeachmad/ZeroToll/backend
source venv/bin/activate
nohup uvicorn server:app --reload --host 0.0.0.0 --port 8000 > /tmp/zerotoll_backend.log 2>&1 &

# Start frontend
cd /home/abeachmad/ZeroToll/frontend
nohup npm start > /tmp/zerotoll_frontend.log 2>&1 &
```

---

## ✅ SUCCESS CRITERIA

**Priority 1 is COMPLETE when:**

- [x] Backend running with NEW RouterHub v1.4 addresses
- [x] Frontend running and accessible at http://localhost:3000
- [ ] User approves USDC to NEW RouterHub on Amoy
- [ ] Test swap succeeds on Amoy: USDC → WMATIC
- [ ] WMATIC appears in USER wallet (verified on PolygonScan)
- [ ] User approves USDC to NEW RouterHub on Sepolia
- [ ] Test swap succeeds on Sepolia: USDC → WETH
- [ ] WETH appears in USER wallet (verified on Etherscan)
- [ ] All 4 test swaps complete successfully
- [ ] Backend logs show correct RouterHub addresses
- [ ] No tokens stuck in relayer wallet

**When all checkboxes are ✅:**
→ Move to Priority 2 (EIP-2612 Permit implementation)

---

**Current Status:** 🟢 Services Running - Waiting for User Testing  
**Next Step:** User must open http://localhost:3000 and follow testing steps  
**Updated:** November 8, 2025
