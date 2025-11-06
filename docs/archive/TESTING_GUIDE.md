# 🧪 Testing Guide

## Test Checklist

### ✅ UI/UX Tests (5 minutes)

#### 1. Wallet Connection Modal
- [ ] Click "Connect Wallet" button
- [ ] Modal appears above all content (z-index 20000)
- [ ] Page scroll is locked when modal is open
- [ ] Press ESC key → modal closes
- [ ] Click overlay → modal closes
- [ ] Connect MetaMask successfully

#### 2. Account Dropdown
- [ ] Click wallet address (top right)
- [ ] Dropdown appears completely (not clipped)
- [ ] Dropdown has z-index 20002
- [ ] "Switch Network" option works
- [ ] "Disconnect" option works

#### 3. Token Picker
- [ ] From chain selector shows Amoy and Sepolia
- [ ] To chain selector shows Amoy and Sepolia
- [ ] Token lists load correctly
- [ ] Amoy shows: POL, WPOL, LINK, USDT, USDC, etc.
- [ ] Sepolia shows: ETH, WETH, LINK, USDT, USDC, etc.
- [ ] Select dropdowns have proper styling (bg-white/5)

#### 4. Native Token Badge
- [ ] Select POL as output → "Will unwrap to POL" badge appears
- [ ] Select ETH as output → "Will unwrap to ETH" badge appears
- [ ] Badge shows for native tokens only

#### 5. Token Swap Button
- [ ] Circular button between From/To sections
- [ ] Click button → tokens and chains swap
- [ ] Button rotates 180° on hover
- [ ] Swap animation is smooth

---

### ✅ Price Calculation Tests (10 minutes)

#### Test 1: ETH → POL (Cross-Chain)
```
Setup:
- From: Ethereum Sepolia → ETH
- To: Polygon Amoy → POL
- Amount: 0.01 ETH
- Fee Mode: INPUT

Expected Results:
- Quote shows: ~205.42 POL
- Calculation: 0.01 × $3709.35 / $0.179665 × 0.995 = 205.42 POL
- Oracle: Pyth
- Estimated Fee: ~0.002 ETH ($7.42)
```

#### Test 2: LINK → POL (Same Chain)
```
Setup:
- From: Polygon Amoy → LINK
- To: Polygon Amoy → POL
- Amount: 30 LINK
- Fee Mode: OUTPUT

Expected Results:
- Quote shows: ~3896.04 POL
- Calculation: 30 × $23.45 / $0.179665 × 0.995 = 3896.04 POL
- Oracle: Pyth
- Estimated Fee: ~0.6 LINK ($14.07)
- Info banner: "Fee skimmed from output tokens"
```

#### Test 3: POL → ETH (Cross-Chain)
```
Setup:
- From: Polygon Amoy → POL
- To: Ethereum Sepolia → ETH
- Amount: 100 POL
- Fee Mode: NATIVE

Expected Results:
- Quote shows: ~0.0048 ETH
- Calculation: 100 × $0.179665 / $3709.35 × 0.995 = 0.0048 ETH
- Oracle: TWAP (for NATIVE mode)
- Estimated Fee: ~0.002 POL ($0.00)
```

#### Test 4: USDT → USDC (Same Chain)
```
Setup:
- From: Polygon Amoy → USDT
- To: Polygon Amoy → USDC
- Amount: 100 USDT
- Fee Mode: STABLE

Expected Results:
- Quote shows: ~99.5 USDC
- Calculation: 100 × $1.0 / $1.0 × 0.995 = 99.5 USDC
- Oracle: TWAP
- Estimated Fee: ~0.5 USDC ($0.50)
```

---

### ✅ Fee Mode Tests (10 minutes)

#### Test 1: NATIVE Mode
```
- Select NATIVE fee mode
- Fee token should be: POL/ETH
- Oracle should be: TWAP
- Info banner: "Pay gas in native token"
```

#### Test 2: INPUT Mode
```
- Select INPUT fee mode
- Fee token should be: Same as input token
- Oracle should be: Pyth
- Info banner: "You'll sign Permit2 to lock fee from input token"
```

#### Test 3: OUTPUT Mode
```
- Select OUTPUT fee mode
- Fee token should be: Same as output token (or WPOL/WETH if native)
- Oracle should be: Pyth
- Info banner: "Fee skimmed from output tokens on destination"
```

#### Test 4: STABLE Mode
```
- Select STABLE fee mode
- Fee token should be: USDC
- Oracle should be: TWAP
- Some tokens may have this mode disabled (⚠️ icon)
```

---

### ✅ Backend API Tests (5 minutes)

#### Test 1: Health Check
```bash
curl http://localhost:8000/api/

Expected:
{"message":"ZeroToll API - Any-Token Fee Mode","version":"2.0.0"}
```

#### Test 2: Get Quote
```bash
curl -X POST http://localhost:8000/api/quote \
  -H "Content-Type: application/json" \
  -d '{
    "intent": {
      "user": "0x330A86eE67bA0Da0043EaD201866A32d362C394c",
      "tokenIn": "ETH",
      "amtIn": 0.01,
      "tokenOut": "POL",
      "minOut": 0.00995,
      "dstChainId": 80002,
      "feeMode": "INPUT",
      "feeCap": 0.005,
      "deadline": 1700000000,
      "nonce": 123
    }
  }'

Expected:
{
  "success": true,
  "relayer": "0x742d35...",
  "estimatedFee": "0.0020",
  "feeUSD": "$7.42",
  "oracleSource": "Pyth",
  "netOut": 205.426947,
  ...
}
```

#### Test 3: Execute Swap (Mock)
```bash
curl -X POST http://localhost:8000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "intentId": "0x123",
    "userOp": {
      "sender": "0x330A86eE67bA0Da0043EaD201866A32d362C394c",
      "nonce": 123,
      "feeMode": "INPUT",
      "feeToken": "ETH"
    }
  }'

Expected:
{
  "success": true,
  "txHash": "0x123",
  "status": "pending"
}
```

#### Test 4: Get Stats
```bash
curl http://localhost:8000/api/stats

Expected:
{
  "totalSwaps": 0,
  "successfulSwaps": 0,
  "successRate": 99.8,
  "totalVolume": "$0",
  "gasSaved": "$0.00",
  "supportedTokens": 8,
  ...
}
```

---

### ✅ Contract Verification (5 minutes)

#### Polygon Amoy
```
1. Open: https://amoy.polygonscan.com/address/0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127
2. Verify contract is deployed
3. Check contract creation transaction
4. View contract code (if verified)
```

#### Ethereum Sepolia
```
1. Open: https://sepolia.etherscan.io/address/0x19091A6c655704c8fb55023635eE3298DcDf66FF
2. Verify contract is deployed
3. Check contract creation transaction
4. View contract code (if verified)
```

---

### ✅ Error Handling Tests (5 minutes)

#### Test 1: Invalid Amount
```
- Enter amount: -1 or 0
- Click "Get Quote"
- Expected: Error toast "Enter a valid amount"
```

#### Test 2: Invalid Fee Cap
```
- Enter fee cap: -1 or 0
- Click "Get Quote"
- Expected: Error toast "Enter a valid fee cap"
```

#### Test 3: Wallet Not Connected
```
- Disconnect wallet
- Click "Get Quote"
- Expected: Error toast "Please connect your wallet first"
```

#### Test 4: Wrong Network
```
- Switch MetaMask to Ethereum Mainnet
- Click "Get Quote"
- Expected: Error toast "Please switch to Polygon Amoy or Ethereum Sepolia"
```

#### Test 5: No Quote
```
- Click "Execute Swap" without getting quote first
- Expected: Error toast "Get a quote first"
```

---

### ✅ Performance Tests (5 minutes)

#### Test 1: Quote Response Time
```
- Enter swap details
- Click "Get Quote"
- Measure time to receive quote
- Expected: < 2 seconds
```

#### Test 2: UI Responsiveness
```
- Switch between tokens rapidly
- Change amounts quickly
- Toggle fee modes
- Expected: No lag or freezing
```

#### Test 3: Multiple Quotes
```
- Get quote for ETH → POL
- Change to LINK → POL
- Get new quote
- Expected: Previous quote clears, new quote loads
```

---

## Test Results Template

```markdown
## Test Results - [Date]

### Environment
- Browser: Chrome/Firefox/Safari
- MetaMask Version: X.X.X
- Network: Amoy/Sepolia
- Wallet Address: 0x...

### UI/UX Tests
- [ ] Wallet Modal: PASS/FAIL
- [ ] Account Dropdown: PASS/FAIL
- [ ] Token Picker: PASS/FAIL
- [ ] Native Badge: PASS/FAIL
- [ ] Swap Button: PASS/FAIL

### Price Calculation Tests
- [ ] ETH → POL: PASS/FAIL (Expected: 205.42, Got: ___)
- [ ] LINK → POL: PASS/FAIL (Expected: 3896.04, Got: ___)
- [ ] POL → ETH: PASS/FAIL (Expected: 0.0048, Got: ___)

### Fee Mode Tests
- [ ] NATIVE: PASS/FAIL
- [ ] INPUT: PASS/FAIL
- [ ] OUTPUT: PASS/FAIL
- [ ] STABLE: PASS/FAIL

### Backend API Tests
- [ ] Health Check: PASS/FAIL
- [ ] Get Quote: PASS/FAIL
- [ ] Execute: PASS/FAIL
- [ ] Stats: PASS/FAIL

### Contract Verification
- [ ] Amoy Contract: PASS/FAIL
- [ ] Sepolia Contract: PASS/FAIL

### Error Handling
- [ ] Invalid Amount: PASS/FAIL
- [ ] Invalid Fee Cap: PASS/FAIL
- [ ] Wallet Not Connected: PASS/FAIL
- [ ] Wrong Network: PASS/FAIL
- [ ] No Quote: PASS/FAIL

### Performance
- [ ] Quote Response Time: ___ seconds
- [ ] UI Responsiveness: PASS/FAIL
- [ ] Multiple Quotes: PASS/FAIL

### Issues Found
1. [Issue description]
2. [Issue description]

### Screenshots
- [Attach screenshots]

### Notes
- [Additional observations]
```

---

## Automated Testing (Future)

### Unit Tests
```bash
cd frontend
yarn test
```

### Integration Tests
```bash
cd packages/contracts
yarn test
```

### E2E Tests
```bash
# Using Playwright or Cypress
yarn test:e2e
```

---

**Last Updated**: 2024-11-03
**Version**: 2.0.0
