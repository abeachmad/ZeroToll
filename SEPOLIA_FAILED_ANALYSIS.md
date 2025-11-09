# 🔍 Sepolia Failed Transaction Deep Analysis
**Date:** November 8, 2025  
**Issue:** WETH → USDC swap failed on Sepolia (works on Amoy)

---

## 📊 Transaction Comparison

### ✅ **SUCCESS: Amoy (1 WMATIC → USDC)**
**TX:** `0x180ba7b1f30afa50b5fc14da623827fea0c702dcc8b65da65e3bf56d07ef3949`  
**Explorer:** https://amoy.polygonscan.com/tx/0x180ba7b1f30afa50b5fc14da623827fea0c702dcc8b65da65e3bf56d07ef3949

```
Status:          ✅ Success
Network:         Polygon Amoy (80002)
Swap:            1 WMATIC → USDC
Gas Used:        201,417 gas
Gas Price:       45 Gwei
Transaction Fee: 0.00906373 MATIC (~$0.01)
```

**Event Log (Success Indicators):**
- ✅ Transfer events (WMATIC → RouterHub → MockDEXAdapter)
- ✅ PrefundPushed event (RouterHub)
- ✅ SwapExecuted event (MockDEXAdapter)
- ✅ IntentCompleted event (RouterHub)
- ✅ USDC transferred to user

---

### ❌ **FAILED: Sepolia (0.001 WETH → USDC)**
**TX:** `0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b`  
**Explorer:** https://sepolia.etherscan.io/tx/0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b

```
Status:          ❌ Fail (Reverted)
Network:         Ethereum Sepolia (11155111)
Swap:            0.001 WETH → USDC
Gas Used:        ??? (check explorer)
Gas Price:       ??? Gwei
Error:           Execution reverted
```

---

## 🔬 Root Cause Investigation

### **Hypothesis 1: Insufficient Allowance** (Most Likely)

**Analysis:**
```
From previous FAILED_TX_ANALYSIS.md:
- User needs to approve RouterHub for WETH amount
- If allowance < amtIn, safeTransferFrom() will revert

Similar Pattern:
- Amoy 4 USDC swap failed due to allowance depletion
- This could be same issue with WETH on Sepolia
```

**How to Verify:**
```bash
# Check WETH allowance on Sepolia
cast call 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  "allowance(address,address)(uint256)" \
  0x5a87A3c738cf99DB95787D51B627217B6dE12F62 \
  0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd \
  --rpc-url https://rpc.sepolia.org

# Expected: 0 (if this is the issue)
# If > 1000000000000000 (0.001 WETH), then allowance is OK
```

---

### **Hypothesis 2: Token Balance Issue**

**Check User WETH Balance:**
```bash
# User's WETH balance on Sepolia
cast call 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  "balanceOf(address)(uint256)" \
  0x5a87A3c738cf99DB95787D51B627217B6dE12F62 \
  --rpc-url https://rpc.sepolia.org

# Need: >= 1000000000000000 (0.001 WETH)
```

---

### **Hypothesis 3: RouterHub Configuration**

**Sepolia vs Amoy RouterHub:**
```
Amoy RouterHub:    0x5335f887E69F4B920bb037062382B9C17aA52ec6 ✅
Sepolia RouterHub: 0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd ✅

Check if Sepolia RouterHub deployed correctly:
- Is MockDEXAdapter registered?
- Are token addresses correct?
- Is contract paused?
```

**Verification:**
```bash
# Check if contract is deployed
cast code 0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd --rpc-url https://rpc.sepolia.org

# Should return contract bytecode (not "0x")
```

---

### **Hypothesis 4: Token Address Mismatch**

**Sepolia Token Addresses:**
```javascript
// From config/asset-registry.sepolia.json
{
  "WETH": "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  "USDC": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
}

// Check if these are correct Sepolia testnet tokens
```

**Common Issue:**
```
❌ Wrong token address in backend
❌ Token not in MockDEXAdapter's supported pairs
❌ Token decimals mismatch
```

---

### **Hypothesis 5: Gas Estimation vs Actual Gas**

**From Transaction Details:**
```
If gas limit was too low:
- Transaction runs out of gas mid-execution
- Reverts without specific error message

Check:
- Estimated gas vs provided gas limit
- Compare with successful Amoy transaction (201,417 gas)
```

---

## 🛠️ Debugging Steps (Priority Order)

### **Step 1: Check Allowance (HIGHEST PRIORITY)**

```bash
# Terminal command
cd /home/abeachmad/ZeroToll

# Check WETH allowance
cast call 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  "allowance(address,address)(uint256)" \
  0x5a87A3c738cf99DB95787D51B627217B6dE12F62 \
  0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd \
  --rpc-url https://rpc.sepolia.org

# Result interpretation:
# 0 = NO ALLOWANCE (this is the problem!)
# >= 1000000000000000 = OK (look elsewhere)
```

**If allowance = 0, this is the root cause!**

---

### **Step 2: Check User WETH Balance**

```bash
cast call 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  "balanceOf(address)(uint256)" \
  0x5a87A3c738cf99DB95787D51B627217B6dE12F62 \
  --rpc-url https://rpc.sepolia.org

# Need >= 1000000000000000 (0.001 WETH in wei)
```

---

### **Step 3: Analyze Transaction Trace**

**From VM Trace (check manually):**
```
Expected Call Stack (Success):
1. RouterHub.executeIntent()
   ├─ WETH.transferFrom(user, routerHub, 0.001)  ← May fail here!
   ├─ WETH.transfer(mockDEX, 0.001)
   ├─ MockDEXAdapter.swap()
   │  ├─ WETH.transferFrom(mockDEX, mockDEX, 0.001)
   │  ├─ USDC.transfer(user, expectedOut)
   └─ IntentCompleted event

Failed Call Stack:
1. RouterHub.executeIntent()
   └─ REVERT at transferFrom() ← Likely here!
```

**Key Question:** At which step did it revert?
- If revert at first `transferFrom()` → Allowance issue
- If revert at `swap()` → DEX adapter issue
- If revert at final transfer → Output token issue

---

### **Step 4: Compare Contract State**

**Amoy (Working) vs Sepolia (Failing):**

| Aspect | Amoy | Sepolia | Match? |
|--------|------|---------|--------|
| RouterHub deployed | ✅ 0x5335... | ✅ 0x15db... | N/A |
| MockDEXAdapter deployed | ✅ Check | ❓ Check | ? |
| Token registry correct | ✅ WMATIC/USDC | ❓ WETH/USDC | ? |
| User approved tokens | ✅ Yes | ❓ **Likely NO** | ❌ |
| User has balance | ✅ Yes | ❓ Check | ? |

---

### **Step 5: Check Backend Logs**

```bash
# Check backend logs for this transaction
cd /home/abeachmad/ZeroToll/backend
tail -100 uvicorn.log | grep -i "sepolia\|0x1613ce4f"

# Look for:
# - Token address resolution (WETH → 0x7b79...)
# - Gas estimation errors
# - Transaction build errors
```

---

## 💡 **Most Likely Root Cause (90% Confidence):**

### **Insufficient Allowance for WETH on Sepolia**

**Evidence:**
1. ✅ Same pattern as previous USDC failure (FAILED_TX_ANALYSIS.md)
2. ✅ Amoy works (user probably approved WMATIC)
3. ✅ Sepolia fails (user likely didn't approve WETH)
4. ✅ No specific error message = early revert (typical of allowance issue)

**Why Amoy Works:**
```
Scenario: User tested Amoy first
1. User approves WMATIC to RouterHub (Amoy)
2. Swap succeeds ✅
3. User tries Sepolia WITHOUT approving WETH
4. Swap fails ❌

Each chain requires separate approval!
```

---

## ✅ **Solution**

### **If Root Cause = Allowance (Expected):**

**Frontend Fix (Already Implemented):**
```jsx
// frontend/src/pages/Swap.jsx lines 161-214
// Approval check already exists!

const needsApproval = currentAllowance < amountInWei;

{needsApproval && !tokenIn.isNative ? (
  <button onClick={handleApprove}>
    Approve {tokenIn.symbol}
  </button>
) : (
  <button onClick={handleExecute}>
    Execute Swap
  </button>
)}
```

**User Action Required:**
```
1. Select Sepolia network in wallet
2. Select WETH as input token
3. Enter amount (0.001)
4. Click "Approve WETH" button ← USER MUST DO THIS!
5. Wait for approval TX to confirm
6. Then click "Execute Swap"
```

**Manual Approval (if needed):**
```bash
# Approve WETH to RouterHub on Sepolia
cast send 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  "approve(address,uint256)" \
  0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd \
  1000000000000000 \
  --rpc-url https://rpc.sepolia.org \
  --private-key $PRIVATE_KEY

# Then retry swap
```

---

### **If Root Cause = Other Issue:**

**Scenario 2: Token Not Supported**
```solidity
// Check MockDEXAdapter supports WETH/USDC pair on Sepolia
// May need to add pair to adapter
```

**Scenario 3: Contract Not Deployed**
```bash
# Verify RouterHub on Sepolia
cast code 0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd \
  --rpc-url https://rpc.sepolia.org

# If returns "0x" → Contract not deployed!
```

---

## 🔍 **Next Steps:**

### **Immediate Actions:**

1. **Run Allowance Check:**
   ```bash
   cast call 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
     "allowance(address,address)(uint256)" \
     0x5a87A3c738cf99DB95787D51B627217B6dE12F62 \
     0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd \
     --rpc-url https://rpc.sepolia.org
   ```

2. **If allowance = 0:**
   - User needs to approve WETH on Sepolia
   - Use frontend "Approve" button
   - Or manual cast send command

3. **If allowance > 0:**
   - Check balance
   - Check contract deployment
   - Analyze VM trace for exact revert point

---

## 📊 **Transaction Flow Comparison**

### **Amoy Success Flow:**
```
User approves WMATIC → RouterHub (Amoy) ✅
   ↓
User calls RouterHub.executeIntent() ✅
   ↓
RouterHub.transferFrom(user, routerHub, 1 WMATIC) ✅
   ↓
RouterHub.transfer(mockDEX, 1 WMATIC) ✅
   ↓
MockDEXAdapter.swap() ✅
   ↓
USDC transferred to user ✅
   ↓
IntentCompleted event ✅
```

### **Sepolia Failed Flow (Hypothesis):**
```
User DID NOT approve WETH → RouterHub (Sepolia) ❌
   ↓
User calls RouterHub.executeIntent()
   ↓
RouterHub.transferFrom(user, routerHub, 0.001 WETH)
   ↓
REVERT: ERC20 allowance check failed ❌
   ↓
Transaction reverted
   ↓
No events emitted
```

---

## 🎯 **Conclusion:**

**Primary Hypothesis (90%):** User didn't approve WETH to RouterHub on Sepolia

**Evidence:**
- ✅ Same pattern as previous failure
- ✅ Different chain = different approval needed
- ✅ No error message = early revert (allowance check)
- ✅ Amoy works (approved), Sepolia fails (not approved)

**Action Required:**
1. Verify allowance with cast call (see Step 1 above)
2. If 0, user must approve WETH on Sepolia
3. Retry swap after approval

**Status:** Awaiting allowance verification ⏳
