# Start Frontend - Quick Guide

## ✅ Frontend Hook Updated!

File `frontend/src/hooks/useEIP7702Swap.js` sudah di-update dengan BatchExecutor addresses:

```javascript
const BATCH_EXECUTOR_ADDRESS = {
  80002: '0x8153FA09Be1689D44C343f119C829F6702A8720b', // Amoy
  11155111: '0x8dD08D3369e1c36a03b30587a032b5A8Aaa177F9' // Sepolia
};
```

## 🚀 Cara Start Frontend

```bash
cd frontend
npm start
```

**BUKAN `npm run dev`** - gunakan `npm start`!

## 📝 Setelah Frontend Running

1. **Buka browser** → http://localhost:3000

2. **Connect wallet:**
   - Click "Connect Wallet"
   - Pilih MetaMask atau OKX Wallet
   - Approve connection

3. **Switch network:**
   - Switch ke Sepolia atau Amoy testnet
   - Pastikan ada USDC di wallet

4. **Test EIP-7702 Swap:**
   - Input amount: 0.5 USDC
   - Select output: WETH (Sepolia) atau WPOL (Amoy)
   - Click "Swap with EIP-7702"

5. **Sign transactions:**
   - **Transaction 1:** Authorization signature
     - Ini untuk delegate EOA ke BatchExecutor
     - Sign di MetaMask
   
   - **Transaction 2:** Execute batch
     - Ini untuk execute approve + swap
     - Sign di MetaMask

6. **Wait for confirmation:**
   - Transaction akan di-process
   - Check di block explorer

7. **Verify USDC deduction:**
   - Check USDC balance - harus berkurang! ✅
   - Check output token balance - harus bertambah! ✅

## 🔍 Troubleshooting

### Error: "Cannot find module"
```bash
cd frontend
npm install
npm start
```

### Error: "Port 3000 already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
npm start
```

### Error: "signAuthorization is not a function"
- Update viem: `npm install viem@latest`
- Restart frontend

### Wallet tidak connect
- Refresh page
- Clear browser cache
- Try different wallet

## 📊 Expected Results

**Before Swap:**
```
USDC: 10.0
WETH: 0.0
```

**After Swap:**
```
USDC: 9.5  ← TERPOTONG 0.5! ✅
WETH: 0.001 ← DAPAT WETH! ✅
```

## 🎯 Success Indicators

- ✅ Transaction type: `0x04` (EIP-7702)
- ✅ Status: Success
- ✅ Events: `Transfer(user, router, amount)`
- ✅ USDC balance decreased
- ✅ Output token balance increased

## 📚 Block Explorers

**Sepolia:**
- https://sepolia.etherscan.io/

**Amoy:**
- https://amoy.polygonscan.com/

## 🔑 Deployed Addresses

### Sepolia
```
BatchExecutor: 0x8dD08D3369e1c36a03b30587a032b5A8Aaa177F9
USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
WETH: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
```

### Amoy
```
BatchExecutor: 0x8153FA09Be1689D44C343f119C829F6702A8720b
USDC: 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582
WPOL: 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9
```

---

**POKOKNYA SWAP 7702 HARUS BERHASIL DIMANA DANA USER TERPOTONG** ← **READY!** ✅

**Command:** `cd frontend && npm start` 🚀
