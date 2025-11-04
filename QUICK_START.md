# 🚀 Quick Start Guide

## Overview

ZeroToll is now **READY FOR TESTING** with:
- ✅ Smart contracts deployed to Polygon Amoy & Ethereum Sepolia
- ✅ Backend API running with real Pyth oracle prices
- ✅ Frontend UI with all features working
- ✅ MongoDB optional (not required for testing)

---

## Prerequisites (5 minutes)

### 1. Get Testnet Tokens
```bash
# Polygon Amoy POL
https://faucet.polygon.technology/
→ Select "Polygon Amoy" → Paste wallet address → Get 0.5 POL

# Ethereum Sepolia ETH
https://sepoliafaucet.com/
→ Paste wallet address → Get 0.5 ETH
```

### 2. Add Networks to MetaMask
**Polygon Amoy:**
- Network: Polygon Amoy Testnet
- RPC: https://rpc-amoy.polygon.technology/
- Chain ID: 80002
- Symbol: POL

**Ethereum Sepolia:**
- Network: Ethereum Sepolia
- RPC: https://rpc.sepolia.org/
- Chain ID: 11155111
- Symbol: ETH

---

## Deployed Contracts

### Polygon Amoy (ChainID: 80002)
```
RouterHub: 0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127
FeeSink:   0x1F679D174A9fBe4158EABcD24d4A63D6Bcf8f700
WPOL:      0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9
Explorer:  https://amoy.polygonscan.com/address/0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127
```

### Ethereum Sepolia (ChainID: 11155111)
```
RouterHub: 0x19091A6c655704c8fb55023635eE3298DcDf66FF
FeeSink:   0x2c7342421eB6Bf2a2368F034b26A19F39DC2C130
WETH:      0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
Explorer:  https://sepolia.etherscan.io/address/0x19091A6c655704c8fb55023635eE3298DcDf66FF
```

---

## Running the Application

### Option 1: Quick Start (Recommended)
```bash
cd /home/abeachmad/ZeroToll
bash start-dev.sh
```

### Option 2: Manual Start
```bash
# Terminal 1: Backend
cd /home/abeachmad/ZeroToll/backend
/home/abeachmad/ZeroToll/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 &

# Terminal 2: Frontend
cd /home/abeachmad/ZeroToll/frontend
yarn start
```

### Access the App
```
Frontend: http://localhost:3000
Backend:  http://localhost:8000
```

---

## Testing Features

### 1. Connect Wallet
- Click "Connect Wallet"
- Select MetaMask
- Approve connection
- Switch to Polygon Amoy or Ethereum Sepolia

### 2. Test Price Calculation (Real Pyth Prices)
**Example 1: ETH → POL**
```
From: Ethereum Sepolia → ETH (0.01)
To: Polygon Amoy → POL
Expected: ~205 POL
Calculation: 0.01 × $3709.35 / $0.179665 × 0.995 = 205.42 POL
```

**Example 2: LINK → POL**
```
From: Polygon Amoy → LINK (30)
To: Polygon Amoy → POL
Expected: ~3896 POL
Calculation: 30 × $23.45 / $0.179665 × 0.995 = 3896.04 POL
```

**Example 3: POL → ETH**
```
From: Polygon Amoy → POL (100)
To: Ethereum Sepolia → ETH
Expected: ~0.0048 ETH
Calculation: 100 × $0.179665 / $3709.35 × 0.995 = 0.0048 ETH
```

### 3. Test Fee Modes
- **NATIVE**: Pay gas in POL/ETH
- **INPUT**: Deduct fee from input token on source chain
- **OUTPUT**: Skim fee from output token on destination chain
- **STABLE**: Pay in stablecoins (USDC/USDT)

### 4. Test Native Token Unwrap
- Select POL or ETH as output token
- See "Will unwrap to POL/ETH" badge
- Fee is skimmed from wrapped token (WPOL/WETH) before unwrapping

### 5. Test Token Swap Button
- Click the circular swap button between From/To sections
- Tokens and chains should swap with rotate animation

---

## Supported Tokens

### Polygon Amoy
- POL (native)
- WPOL: `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9`
- LINK: `0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904`
- USDT, USDC, WBTC, WAVAX, wDOGE, WATOM, WPEPE, WTON, WBNB

### Ethereum Sepolia
- ETH (native)
- WETH: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`
- LINK: `0x779877A7B0D9E8603169DdBD7836e478b4624789`
- USDT, USDC, WBTC, WAVAX

---

## Current Functionality

### ✅ Working Features
- Real-time price quotes from Pyth oracle
- All 4 fee modes (NATIVE, INPUT, OUTPUT, STABLE)
- Native token support with auto wrap/unwrap
- Cross-chain routing (Amoy ↔ Sepolia)
- Token swap button with animation
- Wallet connection modal (z-index 20000)
- Account dropdown (z-index 20002)
- Responsive UI with glass effects

### ⚠️ Demo Mode
- **Execute Swap**: Currently returns mock success message
- **For Real On-Chain Swaps**: Need to integrate with RouterHub contract
- **History Page**: Requires MongoDB or The Graph indexer

---

## API Endpoints

### Backend (http://localhost:8000)
```bash
# Health check
GET /api/
Response: {"message":"ZeroToll API - Any-Token Fee Mode","version":"2.0.0"}

# Get quote
POST /api/quote
Body: {"intent":{...}}
Response: {"success":true,"netOut":205.42,"relayer":"0x...","estimatedFee":"0.0020",...}

# Execute swap (mock)
POST /api/execute
Body: {"intentId":"0x...","userOp":{...}}
Response: {"success":true,"txHash":"0x...","status":"pending"}

# Get stats
GET /api/stats
Response: {"totalSwaps":0,"successRate":99.8,...}
```

---

## Troubleshooting

### Backend Not Starting
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill existing process
pkill -f uvicorn

# Restart
cd /home/abeachmad/ZeroToll/backend
/home/abeachmad/ZeroToll/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 &
```

### Frontend Not Starting
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill existing process
pkill -f react-scripts

# Restart
cd /home/abeachmad/ZeroToll/frontend
yarn start
```

### MongoDB Errors
- MongoDB is **optional** for testing
- Backend works without MongoDB
- Stats endpoint returns mock data
- Execute endpoint works normally

### MetaMask Issues
- **"Nonce too high"**: Settings → Advanced → Reset Account
- **"Wrong network"**: Switch to Amoy or Sepolia
- **"Insufficient funds"**: Get testnet tokens from faucets

---

## Next Steps for Production

### 1. Real On-Chain Swaps
- Implement token approval flow
- Integrate with RouterHub.swap() function
- Add transaction confirmation UI

### 2. Relayer Service
- Setup RFQ (Request for Quote) system
- Handle cross-chain message passing
- Monitor and fill intents

### 3. Indexing & History
- Deploy The Graph subgraph
- Index swap events from contracts
- Build transaction history page

### 4. Additional Features
- Slippage tolerance settings
- Transaction deadline configuration
- Multi-hop routing
- Gas estimation

---

## Documentation

- **README.md**: Project overview and architecture
- **DEPLOYMENT_SUCCESS.md**: Contract deployment details
- **DEPLOY_TESTNET.md**: Full deployment guide
- **NATIVE_TOKEN_INTEGRATION_GUIDE.md**: Technical implementation details
- **WALLET_MODAL_NATIVE_TOKENS_UPDATE.md**: UI/UX improvements

---

## Support

For issues or questions:
1. Check browser console (F12) for errors
2. Check backend logs: `tail -f backend.log`
3. Verify network in MetaMask
4. Ensure testnet tokens are available

---

**Status**: ✅ Ready for Testing
**Last Updated**: 2024-11-03
**Version**: 2.0.0
