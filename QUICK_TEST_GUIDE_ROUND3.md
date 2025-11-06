# 🧪 QUICK TEST GUIDE - Post Debugging Round 3

**Date**: November 6, 2025  
**Fixes Applied**: 2/3 bugs fixed, 1 under investigation  
**Status**: Ready for testing ✅

---

## 🚀 START SERVICES

```bash
cd /home/abeachmad/ZeroToll
bash start-zerotoll.sh
```

**Expected Output**:
```
📦 Starting MongoDB...
   ✅ MongoDB started successfully
🔧 Starting Backend...
⏳ Waiting for backend...
✅ Backend ready at http://localhost:8000
🎨 Starting Frontend...
```

**Verify MongoDB**:
```bash
pgrep mongod  # Should return a PID
```

---

## ✅ TEST 1: Amoy USDC → WMATIC (SHOULD WORK!)

**Expected**: Success (previous error "TokenIn not supported" FIXED)

### Steps:
1. **Open DApp**: http://localhost:3000
2. **Connect Wallet**: 
   - Click "Connect Wallet"
   - Select MetaMask
   - Confirm connection
3. **Switch to Polygon Amoy**:
   - Top right: Select "Polygon Amoy"
   - MetaMask popup → Approve network switch
4. **Select Tokens**:
   - From: USDC
   - To: WMATIC
   - Amount: 5
5. **Get Quote**:
   - Click "Get Quote"
   - Wait for quote to appear
   - ✅ **Should show**: Quote with output amount
6. **Approve USDC**:
   - Click "Approve USDC"
   - MetaMask popup → Approve
   - Wait for confirmation
7. **Execute Swap**:
   - Click "Execute Swap"
   - MetaMask popup → Confirm
   - **Expected**: ✅ **Success!** (No "TokenIn not supported" error)

### Debug if Failed:
```bash
# Check backend logs
tail -20 /tmp/zerotoll_backend.log

# Check transaction on explorer
# Look for tx hash in logs, paste into:
# https://amoy.polygonscan.com/tx/[TX_HASH]
```

---

## 🔍 TEST 2: Sepolia USDC → WETH (WITH DEBUG LOGS)

**Expected**: Debug logs reveal user_address flow

### Steps:

1. **Open Logs in Terminal**:
   ```bash
   tail -f /tmp/zerotoll_backend.log
   ```

2. **Switch to Ethereum Sepolia**:
   - Top right: Select "Ethereum Sepolia"
   - MetaMask popup → Approve

3. **Select Tokens**:
   - From: USDC
   - To: WETH
   - Amount: 2

4. **Execute Full Flow**:
   - Get Quote
   - Approve USDC (if needed)
   - Execute Swap

5. **CHECK LOGS** (Critical!):
   ```
   🔍 DEBUG - Received userOp: {
     sender: '0x...',    ← YOUR WALLET ADDRESS
     nonce: ...,
     feeMode: 'INPUT',
     callData: {...}
   }
   
   🔍 DEBUG - Extracted user_address: 0x...  ← MUST BE YOUR WALLET!
   ```

### Analysis:
- **If user_address == YOUR wallet**: ✅ Bug might be elsewhere
- **If user_address == 0xf304eeD8...**: ❌ Still using relayer (need deeper fix)
- **If user_address == empty**: ❌ Frontend not sending sender

### Verify on Explorer:
```bash
# Get tx hash from logs
# Check on: https://sepolia.etherscan.io/tx/[TX_HASH]
# Click "State" tab → Look for transferFrom call
# Verify: from address == YOUR wallet (not relayer)
```

---

## 📊 TEST 3: History Tab

**Expected**: Transactions displayed (even failed ones)

### Steps:
1. **Complete at least one swap** (from Test 1 or 2)
2. **Click "History" tab** in DApp
3. **Expected Display**:
   ```
   ┌─────────────┬──────────┬──────────┬────────────┬────────┐
   │ Timestamp   │ From     │ To       │ Amount     │ Status │
   ├─────────────┼──────────┼──────────┼────────────┼────────┤
   │ 2 mins ago  │ USDC     │ WMATIC   │ 5.00       │ Failed │
   │ 5 mins ago  │ USDC     │ WETH     │ 2.00       │ Failed │
   └─────────────┴──────────┴──────────┴────────────┴────────┘
   ```

### Debug if Empty:
```bash
# Check MongoDB running
pgrep mongod

# If not running:
sudo mongod --dbpath /data/db --logpath /tmp/mongodb.log --bind_ip 127.0.0.1 --fork

# Check backend MongoDB connection
grep "MongoDB" /tmp/zerotoll_backend.log

# Should see:
# "MongoDB connected successfully"
```

---

## 📝 REPORT RESULTS

After testing, please provide:

### 1. Amoy Test Results
```
✅ / ❌ Transaction succeeded?
Transaction Hash: 0x...
Error (if any): ...
```

### 2. Sepolia Test Results
```
Debug Log - userOp.sender: 0x...
Debug Log - user_address: 0x...
Your Wallet Address: 0x...
Match? ✅ / ❌

Transaction Hash: 0x...
Error (if any): ...
```

### 3. History Tab Results
```
✅ / ❌ Transactions displayed?
Count: ...
Status shown correctly? ✅ / ❌
```

---

## 🔧 TROUBLESHOOTING

### MongoDB Not Starting
```bash
# Remove lock file
sudo rm -f /data/db/mongod.lock

# Repair database
sudo mongod --dbpath /data/db --repair

# Start manually
sudo mongod --dbpath /data/db --logpath /tmp/mongodb.log --bind_ip 127.0.0.1 --fork

# Check logs
tail /tmp/mongodb.log
```

### Backend Not Responding
```bash
# Check if running
ps aux | grep uvicorn

# Restart
pkill -f uvicorn
cd /home/abeachmad/ZeroToll/backend
/home/abeachmad/ZeroToll/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 > /tmp/zerotoll_backend.log 2>&1 &

# Test endpoint
curl http://localhost:8000/api/
```

### Frontend Not Loading
```bash
# Check if running
ps aux | grep "yarn start"

# Restart
pkill -f "yarn start"
cd /home/abeachmad/ZeroToll/frontend
yarn start > /tmp/zerotoll_frontend.log 2>&1 &
```

---

## 📖 REFERENCE

**Full Debugging Report**: `DEBUGGING_ROUND_3.md`  
**Backend Logs**: `tail -f /tmp/zerotoll_backend.log`  
**Frontend Logs**: `tail -f /tmp/zerotoll_frontend.log`  
**MongoDB Logs**: `tail -f /tmp/mongodb.log`

**Explorers**:
- Amoy: https://amoy.polygonscan.com/
- Sepolia: https://sepolia.etherscan.io/

---

## ✅ SUCCESS CRITERIA

- [ ] Amoy swap executes without "TokenIn not supported" error
- [ ] Sepolia debug logs show correct user_address (YOUR wallet)
- [ ] History tab displays transaction records
- [ ] MongoDB starts without errors

**If all 4 pass**: 🎉 **ALL BUGS FIXED!**  
**If any fail**: Provide results for next debugging iteration.
