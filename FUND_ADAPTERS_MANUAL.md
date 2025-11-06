# 💰 Manual Adapter Funding Guide

## 🎯 Why Fund Adapters?

MockDEXAdapter needs **token reserves** to execute swaps:
- User swap USDC → POL? Adapter needs POL in reserve!
- User swap POL → USDC? Adapter needs USDC in reserve!

## 📍 Adapter Addresses:

- **Amoy**: `0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`
- **Sepolia**: `0x2Ed51974196EC8787a74c00C5847F03664d66Dc5`

---

## 🔧 Option 1: Fund via Scripts (Automated)

### Amoy:
```bash
cd /home/abeachmad/ZeroToll/packages/contracts

# Fund with 3 USDC + 0.02 WPOL
npx hardhat run scripts/fund-amoy-simple.js --network amoy
npx hardhat run scripts/fund-amoy-wpol.js --network amoy
```

### Sepolia:
```bash
# Fund with 3 USDC + 0.01 WETH
npx hardhat run scripts/fund-sepolia-simple.js --network sepolia
```

**Note:** Scripts akan pakai wallet `0x5a87a3c738cf99db95787d51b627217b6de12f62`

---

## 🔧 Option 2: Fund Manually via Wallet

### Amoy Adapter Funding:

1. **Connect MetaMask** ke Polygon Amoy testnet
2. **Import tokens**:
   - USDC: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`
   - WPOL: `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9`

3. **Transfer ke Adapter** (`0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7`):
   - Send **3 USDC**
   - Wrap POL → WPOL, then send **3 WPOL**

### Sepolia Adapter Funding:

1. **Connect MetaMask** ke Sepolia testnet
2. **Import tokens**:
   - USDC: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
   - WETH: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`

3. **Transfer ke Adapter** (`0x2Ed51974196EC8787a74c00C5847F03664d66Dc5`):
   - Send **3 USDC**
   - Wrap ETH → WETH, then send **0.01 WETH**

---

## ✅ Verify Funding:

```bash
cd /home/abeachmad/ZeroToll/packages/contracts

# Check Amoy adapter
npx hardhat run scripts/check-adapter-balance.js --network amoy

# Check Sepolia adapter
npx hardhat run scripts/check-adapter-balance.js --network sepolia
```

---

## 🚀 After Funding: Test Live Swap

```bash
cd /home/abeachmad/ZeroToll
./live-test.sh
# Choose: 1 (Full Stack)
```

**Then test:**
- Open http://localhost:3000
- Connect wallet
- Try: 0.5 USDC → POL (Amoy) or 0.5 USDC → ETH (Sepolia)

**Expected:**
✅ Approval succeeds  
✅ Swap succeeds  
✅ You receive tokens!

---

## 📊 Current Status:

**Amoy Adapter:**
- ✅ USDC: 3 (sent via script)
- ⏳ WPOL: Pending (need to wrap POL manually)

**Sepolia Adapter:**
- ⏳ USDC: Pending
- ⏳ WETH: Pending

**Recommendation:** Fund manually via MetaMask - faster and more reliable!

