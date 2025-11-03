# Testing Checklist - Wave-2 Improvements

## Pre-Deployment

### Backend
- [ ] Install dependencies: `cd backend && pip install -r requirements.txt`
- [ ] Check MongoDB connection
- [ ] Verify CORS_ORIGINS in .env
- [ ] Test `/api/stats` endpoint
- [ ] Test `/api/history` endpoint
- [ ] Test `/api/quote` endpoint
- [ ] Restart backend: `sudo supervisorctl restart backend`

### Frontend
- [ ] Install dependencies: `cd frontend && yarn install`
- [ ] Check REACT_APP_BACKEND_URL in .env
- [ ] Build: `yarn build`
- [ ] Restart frontend: `sudo supervisorctl restart frontend`

### Subgraph
- [ ] Update schema: `cd packages/subgraph && graph codegen`
- [ ] Build: `graph build`
- [ ] Deploy to Amoy: `graph deploy --studio zerotoll-amoy`
- [ ] Deploy to Sepolia: `graph deploy --studio zerotoll-sepolia`

---

## Landing Page Tests

### Copy & Messaging
- [ ] Hero: "Pay fees in any token you're swapping (input/output), stablecoins, or native—your choice"
- [ ] Feature 1: "Any-Token Fee Payment" (not "Gasless Transactions")
- [ ] Feature 2: "Output-fee skimming on destination + Input-fee locking on source (Permit2)"
- [ ] How It Works Step 1: Mentions fee mode selection
- [ ] How It Works Step 3: "Pay in Any Token" (not "Pay in Stablecoins")

### Live Metrics Dashboard
- [ ] Component renders without errors
- [ ] "Gas Saved (7d)" displays value from API
- [ ] "Any-Token Adoption" displays percentage
- [ ] "Refund Rate" displays percentage
- [ ] Success Rate, Avg Fee, Total Volume, Total Swaps display
- [ ] Mode Distribution shows bars for INPUT/OUTPUT/STABLE/NATIVE
- [ ] "Real-time" indicator with spinning icon
- [ ] Auto-refreshes every 30 seconds
- [ ] Testnet badge: "⚠️ Testnet: Amoy ↔ Sepolia"

### Footer
- [ ] Contract addresses section displays (Paymaster, RouterHub, Vault, SettlementHub)
- [ ] Resources section: GitHub, Polygon Docs, ERC-4337 Spec links work
- [ ] Legal section: Terms, Privacy, Security Policy links
- [ ] Bottom text: "© 2025 ZeroToll. MIT License. Powered by Polygon & ERC-4337."
- [ ] Chain IDs: "Polygon Amoy (80002) · Ethereum Sepolia (11155111)"
- [ ] Warning: "⚠️ Testnet demo. Permissionless LP vault. Non-custodial."

### Navigation
- [ ] "Launch App" button (header) → /swap
- [ ] "Get Started" button (hero) → /swap
- [ ] "Learn More" button (hero) → scrolls or navigates
- [ ] "Launch App" button (CTA) → /swap

---

## Swap Page Tests

### Fee Mode Selector
- [ ] All 4 modes visible (NATIVE, INPUT, OUTPUT, STABLE)
- [ ] USDC: All 4 modes enabled
- [ ] WBTC: Only INPUT, OUTPUT enabled (NATIVE, STABLE disabled with ⚠️)
- [ ] WAVAX: Only INPUT, OUTPUT enabled
- [ ] Disabled modes show tooltip: "Not available for {token} (no oracle/low liquidity)"
- [ ] Selected mode has violet border
- [ ] Color coding: INPUT (violet), OUTPUT (aqua), STABLE (blue), NATIVE (gray)

### Dynamic Fee Cap Label
- [ ] NATIVE mode: "Max Fee Cap (POL/ETH)"
- [ ] INPUT mode + WBTC: "Max Fee Cap (WBTC)"
- [ ] OUTPUT mode + WAVAX: "Max Fee Cap (WAVAX)"
- [ ] STABLE mode: "Max Fee Cap (USDC)"
- [ ] Tooltip: "Surplus auto-refunded on-chain"
- [ ] Helper text: "✅ Fee ≤ cap enforced on-chain. Unused amount refunded in fee token."

### Fee Mode Explainer
- [ ] "How it works" button toggles explainer
- [ ] NATIVE mode: Shows 4 steps with Zap icon (gray)
- [ ] INPUT mode: Shows 4 steps with Lock icon (violet), mentions Permit2
- [ ] OUTPUT mode: Shows 4 steps with Coins icon (aqua), mentions FeeSink
- [ ] STABLE mode: Shows 4 steps with DollarSign icon (blue), mentions EIP-2612

### Info Banners
- [ ] OUTPUT mode: Shows aqua banner "Fee skimmed from output tokens on destination..."
- [ ] INPUT mode: Shows violet banner "You'll sign Permit2 to lock fee from input token..."
- [ ] NATIVE/STABLE modes: No banner

### Quote Display
- [ ] "Get Quote" button works
- [ ] Quote shows: Relayer address (truncated)
- [ ] Quote shows: Fee Token (dynamic based on mode)
- [ ] Quote shows: Estimated Fee + USD value
- [ ] Quote shows: Oracle source (Pyth/TWAP)
- [ ] Quote shows: Price age (if Pyth): "age 12s"
- [ ] Quote shows: Confidence (if Pyth): "conf 0.15%"
- [ ] Quote shows: "Includes on-chain price update fee (Pyth)" if applicable
- [ ] Quote shows: "✅ Fee ≤ cap. Surplus auto-refunded in fee token."

### Info Cards
- [ ] Current Mode: Color-coded (violet/aqua/blue/gray)
- [ ] Supported Tokens: 8
- [ ] Success Rate: 99.8%
- [ ] Network: "Amoy → Sepolia" (dynamic)
- [ ] Fee Token: Dynamic based on mode
- [ ] Cap Enforcement: "✓ On-chain"

### Execute Swap
- [ ] "Execute Swap" button disabled until quote received
- [ ] Success message shows tx hash
- [ ] Toast notification appears

---

## History Page Tests

### Stats Grid
- [ ] Total Swaps displays
- [ ] Success Rate displays with %
- [ ] Total Volume displays with $
- [ ] Gas Saved (7d) displays with $
- [ ] Avg Fee displays
- [ ] Refund Rate displays with %
- [ ] Any-Token Share displays with %
- [ ] Supported Tokens: 8

### Transaction Table
- [ ] Headers: Time, Route, Amount In, Amount Out (Net), Fee & Refund, Mode, Oracle, Status, Tx
- [ ] Time: Formatted as locale string
- [ ] Route: "Amoy → Sepolia" with arrow
- [ ] Amount In: Shows value + token symbol
- [ ] Amount Out: Shows gross amount + token symbol
- [ ] Net Out: Shows net amount if different (OUTPUT mode)
- [ ] Fee: Shows fee amount + fee token symbol
- [ ] Refund: Shows "↩ {amount} refund" if > 0 (green text)
- [ ] Mode: Color-coded badge (INPUT violet, OUTPUT aqua, STABLE blue, NATIVE gray)
- [ ] Oracle: Shows source (Pyth/TWAP) + age if available
- [ ] Status: Color-coded badge (success green, pending yellow, failed red)
- [ ] Tx: External link icon, opens explorer in new tab

### Empty State
- [ ] If no history: "No transactions yet. Start swapping!"
- [ ] Loading state: "Loading..."

### Navigation
- [ ] "Back to Swap" button → /swap

---

## API Tests

### `/api/stats`
```bash
curl http://localhost:8000/api/stats
```
Expected fields:
- [ ] totalSwaps (number)
- [ ] successfulSwaps (number)
- [ ] successRate (number or string with %)
- [ ] totalVolume (string with $)
- [ ] gasSaved (string with $)
- [ ] supportedTokens (8)
- [ ] avgFeeUSD (string with $)
- [ ] refundRate (string with %)
- [ ] anyTokenShare (string with %)
- [ ] modeDistribution (object with native, input, output, stable)

### `/api/history`
```bash
curl http://localhost:8000/api/history
```
Expected fields per item:
- [ ] id, user, fromChain, toChain
- [ ] tokenIn, tokenOut, amountIn, amountOut, netOut
- [ ] feeMode, feePaid, feeToken, refund
- [ ] oracleSource, priceAge (optional)
- [ ] status, txHash, explorerUrl
- [ ] timestamp

### `/api/quote`
```bash
curl -X POST http://localhost:8000/api/quote \
  -H "Content-Type: application/json" \
  -d '{"intent": {...}}'
```
Expected fields:
- [ ] success (boolean)
- [ ] relayer (address)
- [ ] costEstimate (string)
- [ ] estimatedFee (string)
- [ ] feeUSD (string)
- [ ] oracleSource (Pyth/TWAP)
- [ ] deadline (timestamp)

---

## Cross-Browser Tests

### Desktop
- [ ] Chrome: All features work
- [ ] Firefox: All features work
- [ ] Safari: All features work
- [ ] Edge: All features work

### Mobile
- [ ] Chrome Mobile: Responsive layout
- [ ] Safari Mobile: Responsive layout
- [ ] Mode selector: 2-column grid on mobile

---

## Accessibility Tests

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Enter/Space activates buttons
- [ ] Escape closes modals/tooltips

### Screen Reader
- [ ] All buttons have labels
- [ ] All images have alt text
- [ ] All tooltips have title attributes

### Color Contrast
- [ ] Text on backgrounds meets WCAG AA
- [ ] Disabled states clearly visible
- [ ] Color-coded modes distinguishable

---

## Performance Tests

### Load Times
- [ ] Landing page: < 2s
- [ ] Swap page: < 2s
- [ ] History page: < 3s (with data)

### API Response Times
- [ ] `/api/stats`: < 500ms
- [ ] `/api/history`: < 1s
- [ ] `/api/quote`: < 2s

### Auto-Refresh
- [ ] LiveMetrics refreshes every 30s without lag
- [ ] No memory leaks after 5 minutes

---

## Edge Cases

### Swap Page
- [ ] Invalid amount: Shows error toast
- [ ] Invalid fee cap: Shows error toast
- [ ] Amount > 1e12: Shows error toast
- [ ] Fee cap > 1e6: Shows error toast
- [ ] No quote: "Execute Swap" button disabled
- [ ] Network error: Shows error toast

### History Page
- [ ] Empty history: Shows empty state
- [ ] API error: Graceful fallback
- [ ] Missing txHash: No explorer link
- [ ] Missing refund: No refund display

### LiveMetrics
- [ ] API error: Component doesn't crash
- [ ] Missing stats: Shows loading state
- [ ] Zero swaps: Handles division by zero

---

## Security Tests

### CORS
- [ ] Only allowed origins can access API
- [ ] Credentials not exposed in responses

### Input Validation
- [ ] SQL injection attempts rejected
- [ ] XSS attempts sanitized
- [ ] Invalid addresses rejected
- [ ] Invalid chain IDs rejected

### Rate Limiting
- [ ] Excessive requests throttled
- [ ] No DoS vulnerability

---

## Final Checks

### Documentation
- [ ] README.md updated
- [ ] IMPROVEMENTS_WAVE2.md complete
- [ ] WAVE2_READY.md complete
- [ ] TESTING_CHECKLIST.md complete

### Git
- [ ] All changes committed
- [ ] Pushed to main branch
- [ ] No merge conflicts
- [ ] Clean git status

### Deployment
- [ ] Backend running on correct port
- [ ] Frontend running on correct port
- [ ] Environment variables set
- [ ] Logs show no errors

---

## Sign-Off

- [ ] All critical tests passed
- [ ] All high priority tests passed
- [ ] All medium priority tests passed
- [ ] Demo script prepared
- [ ] Backup plan ready

**Tester**: _______________
**Date**: _______________
**Status**: ⬜ PASS / ⬜ FAIL
**Notes**: _______________
