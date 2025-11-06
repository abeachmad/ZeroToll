# 🚀 ZeroToll Live Test Guide

**Status**: ✅ RouterHub Working on Amoy & Sepolia  
**Date**: November 6, 2025

---

## Quick Start (Choose One)

### Option 1: Interactive Menu (EASIEST)
```bash
cd /home/abeachmad/ZeroToll
chmod +x live-test.sh
./live-test.sh
```

### Option 2: Direct Full Stack
```bash
cd /home/abeachmad/ZeroToll
./start-zerotoll.sh
```

### Option 3: Development Mode (with logs)
```bash
cd /home/abeachmad/ZeroToll
./start-dev.sh
```

---

## What Each Script Does

| Script | Purpose | When to Use |
|--------|---------|-------------|
| **`live-test.sh`** ⭐ | Interactive menu | First time / Quick test |
| **`start-zerotoll.sh`** | Full stack (backend + frontend) | Live demo / Production test |
| **`start-dev.sh`** | Development mode | Debugging / Development |
| **`start-frontend-only.sh`** | UI only | Design testing |
| ~~`deploy-zerotoll.sh`~~ | Deploy contracts | ❌ Already deployed |
| ~~`setup-env.sh`~~ | Environment setup | ❌ Already configured |
| ~~`setup-testnet.sh`~~ | Testnet setup | ❌ Already done |

---

## After Starting

### Ports
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api
- **MongoDB**: localhost:27017

### Test Flow
1. Open http://localhost:3000
2. Connect wallet (MetaMask)
3. Switch to Amoy or Sepolia testnet
4. Try swap: 0.1 USDC → WPOL/LINK
5. Check transaction on explorer

---

## Deployed Contracts

### Polygon Amoy Testnet ⭐ (Primary for Buildathon)
```
RouterHub:       0x63db4Ac855DD552947238498Ab5da561cce4Ac0b
MockDEXAdapter:  0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7
Test USDC:       0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB
WPOL:            0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9
```
**Successful TX**: https://amoy.polygonscan.com/tx/0xb21ac51945734534ad8aec3c80e86ce6c69b2bb5ede3025b38d05ad3ac076c73

### Ethereum Sepolia Testnet
```
RouterHub:       0x1449279761a3e6642B02E82A7be9E5234be00159
MockDEXAdapter:  0x2Ed51974196EC8787a74c00C5847F03664d66Dc5
USDC:            0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
LINK:            0x779877A7B0D9E8603169DdbD7836e478b4624789
```
**Successful TX**: https://sepolia.etherscan.io/tx/0xe3767cb49376bb8a4b58d5617bb2a162ed3c5e8cf996ee970797346a409e88f7

---

## Get Testnet Tokens

### Amoy (POL)
- Faucet: https://faucet.polygon.technology/
- Test USDC: Call `faucet()` on `0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB`

### Sepolia (ETH)
- Faucet: https://sepoliafaucet.com/
- USDC: Use Uniswap faucet or bridge

---

## Troubleshooting

### Backend not starting
```bash
# Check if port is in use
lsof -i :8000

# Kill existing process
pkill -f uvicorn

# Restart
./start-zerotoll.sh
```

### Frontend not loading
```bash
cd frontend
rm -rf node_modules package-lock.json
yarn install
yarn start
```

### MongoDB not running
```bash
sudo systemctl start mongodb
# or
sudo -u mongodb mongod --dbpath /data/db --fork
```

### Transaction failing
- Check you're on correct network (Amoy/Sepolia)
- Check you have testnet tokens
- Check gas price settings
- View detailed error: See `ROUTERHUB_DEBUG_RESOLUTION.md`

---

## API Endpoints

### Health Check
```bash
curl http://localhost:8000/api/
```

### Get Quote
```bash
curl -X POST http://localhost:8000/api/quote \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "0xCE61416f41c5c3F501Ca8DC0469b5778ddE532BB",
    "tokenOut": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
    "amountIn": "100000",
    "network": "amoy"
  }'
```

### Get History
```bash
curl http://localhost:8000/api/history?user=0xYourAddress
```

---

## Known Working Test Cases

### Amoy
- ✅ 0.1 USDC → 0.0997 WPOL
- ✅ Gas: ~115,000
- ✅ Fee: ~0.003 POL

### Sepolia
- ✅ 0.01 USDC → 0.000664 LINK
- ✅ Gas: ~145,000
- ✅ Fee: ~0.004 ETH

---

## Files You DON'T Need

These are for initial setup (already done):
- ❌ `deploy-zerotoll.sh`
- ❌ `QUICK_DEPLOY.sh`
- ❌ `setup-env.sh`
- ❌ `setup-testnet.sh`
- ❌ `test-setup.sh`

---

## Next Steps After Testing

1. **If everything works:**
   - Record demo video
   - Take screenshots for buildathon
   - Document user flow

2. **If issues found:**
   - Check logs: `tail -f /tmp/zerotoll_backend.log`
   - Check browser console (F12)
   - See `ROUTERHUB_DEBUG_RESOLUTION.md`

3. **For production:**
   - Deploy to Polygon mainnet
   - Update RPC endpoints
   - Enable real DEX integration (QuickSwap)

---

**Last Updated**: November 6, 2025  
**Debugging Session**: Complete ✅  
**Status**: Ready for Live Demo 🎯
