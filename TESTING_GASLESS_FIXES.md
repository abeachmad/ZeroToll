# Testing Guide - Gasless Swaps Fixed

## All Issues Resolved ✅

### Issue 1: Quote API CORS ✅ FIXED
### Issue 2: Gasless Approval Charging Gas ✅ FIXED  
### Issue 3: Confusing UX ✅ FIXED

---

## How to Test

### 1. Access the Frontend
```
Open browser: http://localhost:3001/swap
```

---

### 2. Test Quote API (Issue #1 Fix)

**Steps:**
1. Connect wallet (MetaMask)
2. Select tokens (e.g., USDC → DAI)
3. Enter amount (e.g., 10)
4. Click "Get Quote"

**Expected Before Fix:**
- ❌ Error: "failed to get quote"
- ❌ Backend log: "OPTIONS /api/quote HTTP/1.1" 400

**Expected After Fix:**
- ✅ Quote appears with fee estimate
- ✅ No CORS errors in console
- ✅ Backend log: "OPTIONS /api/quote HTTP/1.1" 200

---

### 3. Test Gasless Approval (Issue #2 Fix)

**Steps:**
1. **Toggle Gasless Mode ON** (the toggle at top should be aqua/cyan color)
2. Verify you see: "Account Abstraction (ERC-4337)" description with:
   - ✅ Zero gas fees - paymaster sponsors your transactions
   - ✅ Approval + Swap - both are gasless!
   - ✅ Just sign with your wallet - no POL/ETH needed
3. Get a quote
4. Click "Approve Token"

**Expected Before Fix:**
- ❌ MetaMask shows: "Network fee: < $0.01 POL"
- ❌ User pays gas in POL/ETH
- ❌ Toast: "🦊 Opening MetaMask... Please approve token spending"

**Expected After Fix:**
- ✅ Toast: "⚡ Gasless approval - no gas fee!"
- ✅ MetaMask shows ONLY signature request
- ✅ NO "Network fee" field visible
- ✅ NO POL cost
- ✅ Toast: "✅ Gasless approval submitted! No gas fee charged."

**What Happens Behind the Scenes:**
1. Frontend builds UserOp for approve() call
2. Requests paymaster signature from http://localhost:3002
3. Paymaster signs to sponsor gas
4. User signs UserOp (just signature, no gas!)
5. Bundler receives UserOp and executes
6. Bundler pays gas, gets reimbursed by paymaster
7. Approval processed - user paid $0 in POL/ETH

---

### 4. Test Gasless Swap Execution

**Steps:**
1. After approval completes, wait 3 seconds
2. Click "Execute Gasless Swap"

**Expected:**
- ✅ Toast: "⚡ Initiating gasless swap..."
- ✅ MetaMask shows signature request (no gas fee)
- ✅ Toast: "✅ Gasless swap submitted!"
- ✅ Transaction appears in bundler log
- ✅ $0 POL/ETH charged

---

### 5. Test Standard Mode (Non-Gasless)

**Steps:**
1. **Toggle Gasless Mode OFF**
2. Verify you see warning: "Standard mode requires POL/ETH for gas fees"
3. Get a quote
4. Click "Approve Token"

**Expected:**
- ✅ Toast: "🦊 Opening MetaMask... This will cost gas in POL/ETH"
- ✅ MetaMask shows: "Network fee: < $0.01 POL"
- ✅ Traditional approval (user pays gas)

---

## Verify in Logs

### Backend Log
```bash
tail -f /tmp/zerotoll_backend.log
```

**Before Fix:**
```
INFO: 127.0.0.1:43192 - "OPTIONS /api/quote HTTP/1.1" 400 Bad Request
```

**After Fix:**
```
INFO: 127.0.0.1:xxxxx - "OPTIONS /api/quote HTTP/1.1" 200 OK
INFO: 127.0.0.1:xxxxx - "POST /api/quote HTTP/1.1" 200 OK
```

---

### Bundler Log
```bash
tail -f /tmp/zerotoll_bundler.log
```

**Look for:**
```
Received UserOp: {sender: "0x...", nonce: "0x...", ...}
UserOp validated successfully
Submitting bundle with 1 UserOps
Bundle submitted: 0x... (transaction hash)
```

---

### Policy Server Log
```bash
tail -f /tmp/zerotoll_policy_server.log
```

**Look for:**
```
POST /api/paymaster/sponsor
Sponsoring UserOp for sender: 0x...
Rate limit: 1/10 swaps used today
Signature: 0x...
```

---

## MetaMask Signature Comparison

### Gasless Mode (CORRECT - After Fix)
```
┌─────────────────────────────────────┐
│ Signature Request                   │
├─────────────────────────────────────┤
│                                     │
│ Message:                            │
│ 0x1a2b3c4d... (UserOp hash)        │
│                                     │
│ [NO NETWORK FEE FIELD]             │
│                                     │
│         [Reject]  [Sign]           │
└─────────────────────────────────────┘
```

### Standard Mode (Approval charges gas)
```
┌─────────────────────────────────────┐
│ Approve Token Spending              │
├─────────────────────────────────────┤
│ Spending Cap: 10.0 USDC            │
│ Spender: 0x49AD... (RouterHub)     │
│                                     │
│ Network fee: $0.01                 │
│ POL ⬆                              │
│                                     │
│         [Reject]  [Confirm]        │
└─────────────────────────────────────┘
```

---

## Common Issues & Solutions

### Issue: Quote still returns 400
**Solution:** Restart backend
```bash
cd /home/abeachmad/ZeroToll
./stop-zerotoll.sh
./start-zerotoll.sh
```

---

### Issue: Gasless approval still shows gas fee
**Checklist:**
- [ ] Is gasless toggle ON (aqua/cyan color)?
- [ ] Frontend compiled successfully? Check: `tail -f /tmp/zerotoll_frontend.log`
- [ ] Refresh browser (Ctrl+Shift+R to clear cache)

---

### Issue: Bundler not responding
**Check:**
```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}'
```

**Expected:**
```json
{"jsonrpc":"2.0","id":1,"result":["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]}
```

---

### Issue: Policy server not signing
**Check:**
```bash
curl http://localhost:3002/health
```

**Expected:**
```json
{"status":"ok","signer":"0x84d44b412CeA92064B5441fB7CfC354Ec1750eb2","networks":["amoy","sepolia"]}
```

---

## Success Criteria

All tests pass when:
- ✅ Quote API returns 200 (no CORS errors)
- ✅ Gasless approval shows ONLY signature request (no gas fee)
- ✅ Gasless swap shows ONLY signature request (no gas fee)
- ✅ User pays $0 in POL/ETH for gasless transactions
- ✅ Standard mode still works (charges gas normally)
- ✅ UI clearly explains gasless vs standard mode

---

## Files Changed Summary

1. **backend/server.py** - Added OPTIONS to CORS
2. **frontend/src/lib/accountAbstraction.js** - Added executeGaslessApproval()
3. **frontend/src/hooks/useGaslessSwap.js** - Added executeApproval()
4. **frontend/src/pages/Swap.jsx** - Updated handleApprove() + UI improvements

**No hardcoded values added** ✅

---

**Happy Testing!** 🎉
