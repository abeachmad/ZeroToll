# ✅ Scripts Updated for EIP-7702

## Updated Files:
1. `start-zerotoll.sh` - Start backend + frontend
2. `stop-zerotoll.sh` - Stop all services

## Changes Made:

### 1. Backend Port Changed: 8000 → 3002
- Backend now runs on port 3002 (same as EIP-7702 API)
- Removed old Phase 2 services (ZeroToll Relayer, Delegation API)
- Simplified to only backend + frontend

### 2. Removed Unnecessary Services
- ❌ ZeroToll Relayer (port 3002) - not needed for EIP-7702
- ❌ Delegation API (port 3003) - not needed for EIP-7702
- ✅ Python Backend (port 3002) - EIP-7702 enabled
- ✅ Frontend (port 3000)

### 3. Updated Service Info
- Shows EIP-7702 endpoints
- Shows relayer status (funded)
- Shows delegate contract addresses
- Simplified instructions

## How to Use:

### Start Services:
```bash
./start-zerotoll.sh
```

### Stop Services:
```bash
./stop-zerotoll.sh
```

## What Happens:

### Start Script:
1. ✅ Cleans up old processes
2. ✅ Starts Python backend on port 3002
3. ✅ Waits for backend to be ready
4. ✅ Starts frontend on port 3000
5. ✅ Shows service info and testing instructions

### Stop Script:
1. ✅ Stops tmux sessions
2. ✅ Kills processes by PID
3. ✅ Kills processes by port
4. ✅ Verifies ports are free
5. ✅ Shows restart instructions

## Service URLs:

- **Backend**: http://localhost:3002
- **Frontend**: http://localhost:3000
- **EIP-7702 Info**: http://localhost:3002/api/eip7702/info

## Testing:

1. Run: `./start-zerotoll.sh`
2. Wait for services to start
3. Open: http://localhost:3000/swap
4. Connect wallet (Sepolia)
5. Toggle "EIP-7702 Gasless"
6. Test swap!

---

**Status**: Scripts updated and ready ✅  
**Backend Port**: 3002 ✅  
**Frontend Port**: 3000 ✅  
**Services**: Simplified (backend + frontend only) ✅
