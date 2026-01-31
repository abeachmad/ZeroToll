# Test Native Token Fix - Quick Guide

**Goal**: Verify that EIP-7702 swaps work with native token outputs (POL/ETH)

---

## Prerequisites

1. Services running: `./start-zerotoll.sh`
2. Wallet connected to Amoy or Sepolia
3. Test tokens available (USDC, etc.)

---

## Test Steps

### 1. Open Swap Page
```
http://localhost:3000/swap
```

### 2. Enable EIP-7702 Mode
- Look for "EIP-7702 Gasless" toggle
- Enable it (should show ⚡ icon)

### 3. Configure Swap
**Input**:
- Token: USDC (or any ERC-20)
- Amount: 1.0

**Output**:
- Token: POL (Amoy) or ETH (Sepolia) - **NATIVE TOKEN**
- This is the critical test case!

### 4. Execute Swap
1. Click "Get Quote" (should fetch from Pyth oracle)
2. Click "⚡ Execute EIP-7702 (50% Cheaper!)"
3. Watch console for logs

### 5. Expected Behavior

**Console Logs**:
```javascript
🔍 Token addresses: {
  tokenIn: { 
    symbol: 'USDC', 
    original: '0x...', 
    actual: '0x...' 
  },
  tokenOut: { 
    symbol: 'POL', 
    original: 'NATIVE',  // ← Original value
    actual: '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9'  // ← Converted to WPOL!
  }
}
```

**MetaMask Prompts**:
1. Sign EIP-7702 authorization
2. Sign EIP-2612 permit
3. Sign swap intent

**Success**:
- ✅ No "Address 'NATIVE' is invalid" error
- ✅ All signatures complete
- ✅ Swap submitted to relayer
- ✅ Transaction hash returned

---

## What Was Fixed

### Before Fix ❌
```javascript
// Passed "NATIVE" directly to executeSwap
const result = await eip7702Swap.executeSwap({
  tokenIn: tokenIn.address,
  tokenOut: tokenOut.address,  // ← "NATIVE" causes error!
  amountIn: amount,
  minAmountOut: minOut
});
```

**Error**: `InvalidAddressError: Address "NATIVE" is invalid`

### After Fix ✅
```javascript
// Convert native to wrapped token address
const getTokenAddress = (token) => {
  if (token.isNative || token.address === 'NATIVE') {
    const network = chainId === 80002 ? 'amoy' : 'sepolia';
    return contractsConfig[network].wrappedToken;
  }
  return token.address;
};

const tokenInAddress = getTokenAddress(tokenIn);
const tokenOutAddress = getTokenAddress(tokenOut);  // ← WPOL/WETH address!

const result = await eip7702Swap.executeSwap({
  tokenIn: tokenInAddress,
  tokenOut: tokenOutAddress,  // ← Valid address!
  amountIn: amount,
  minAmountOut: minOut
});
```

**Result**: Signature succeeds with valid wrapped token address

---

## Wrapped Token Addresses

| Network | Native | Wrapped | Address |
|---------|--------|---------|---------|
| Amoy | POL | WPOL | `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9` |
| Sepolia | ETH | WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

---

## Troubleshooting

### Error: "EIP-7702 not supported on this chain"
- Switch wallet to Amoy (80002) or Sepolia (11155111)

### Error: "Failed to get quote"
- Check backend is running: `curl http://localhost:8000/api/eip7702/info`
- Check Pyth oracle connection

### Error: "User rejected signature"
- User cancelled in MetaMask
- Try again

### Error: Still getting "NATIVE" error
- Clear browser cache
- Restart frontend: `cd frontend && npm start`
- Check file was saved: `git diff frontend/src/pages/Swap.jsx`

---

## Verification Checklist

- [ ] Services started successfully
- [ ] Frontend loads at http://localhost:3000/swap
- [ ] EIP-7702 toggle visible and working
- [ ] Native token (POL/ETH) selectable as output
- [ ] Console shows wrapped token address conversion
- [ ] No "NATIVE" address error
- [ ] All 3 signatures complete in MetaMask
- [ ] Swap submitted successfully
- [ ] Transaction hash received

---

## Success Criteria

✅ **Fix is working if**:
1. No "Address 'NATIVE' is invalid" error
2. Console shows wrapped token address
3. All signatures complete
4. Swap executes successfully

❌ **Fix needs adjustment if**:
1. Still getting "NATIVE" error
2. Wrong wrapped token address used
3. Signature fails with different error

---

## Next Steps After Testing

### If Test Passes ✅
1. Test on both networks (Amoy and Sepolia)
2. Test with different token pairs
3. Measure actual gas savings
4. Update documentation with results

### If Test Fails ❌
1. Check console for error details
2. Verify wrapped token addresses in `contracts.json`
3. Check `getTokenAddress` helper logic
4. Review EIP-712 signature structure

---

## Quick Commands

### Start Services
```bash
./start-zerotoll.sh --test
```

### Check Backend
```bash
curl http://localhost:8000/api/eip7702/info
```

### View Logs
```bash
# Backend logs
tail -f .pids/backend.log

# Frontend console
# Open browser DevTools → Console
```

### Stop Services
```bash
./stop-zerotoll.sh
```

---

**Status**: Ready to test ✅
**Expected Result**: Native token swaps work without address error
**Time Required**: 5-10 minutes
