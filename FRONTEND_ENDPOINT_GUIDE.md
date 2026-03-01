# Frontend Endpoint Guide

## Available Endpoints

### Phase 2: ERC-4337 (Port 3002 - Node.js Relayer)

**Base URL:** `http://localhost:3002`

#### Swap Endpoints
- `POST /api/intents/swap-with-permit` - Gasless swap with ERC-2612 Permit ✅
- `GET /api/intents/:id/status` - Check swap status
- `GET /api/nonce/:chainId/:address` - Get user nonce
- `GET /api/fee-estimate/:chainId/:tokenIn` - Get fee estimate
- `GET /api/config/:chainId` - Get chain configuration
- `GET /api/paymaster/balance/:chainId` - Get paymaster balance
- `GET /health` - Health check

**Note:** Permit2 endpoint (`/api/intents/swap-with-permit2`) is NOT available in phase2-relayer.mjs. Use ERC-2612 Permit instead.

### Phase 3A: EIP-7702 (Port 8000 - Python Backend)

**Base URL:** `http://localhost:8000`

#### EIP-7702 Endpoints
- `GET /api/eip7702/info` - Integration information ✅
- `GET /api/eip7702/health/{chain_id}` - Health check ✅
- `GET /api/eip7702/nonce/{chain_id}/{address}` - Get user nonce ✅
- `POST /api/eip7702/quote` - Get swap quote ✅
- `POST /api/eip7702/execute` - Execute gasless swap ✅

---

## Frontend Hook Usage

### For Phase 2 (ERC-4337)

**File:** `frontend/src/hooks/useIntentGasless.js`

**Endpoint:** `http://localhost:3002/api/intents/swap-with-permit`

**Usage:**
```javascript
const response = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    chainId, 
    intent, 
    userSignature, 
    permit  // ERC-2612 Permit (NOT Permit2)
  })
});
```

### For Phase 3A (EIP-7702)

**File:** `frontend/src/hooks/useEIP7702Swap.js`

**Endpoint:** `http://localhost:8000/api/eip7702/execute`

**Usage:**
```javascript
const response = await fetch(`${API_URL}/api/eip7702/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chainId,
    authorization,  // EIP-7702 authorization
    permit,         // EIP-2612 permit
    intent,         // Swap intent
    intentSignature,
    fee
  })
});
```

---

## Error: 404 on `/api/intents/swap-with-permit2`

### Problem
Frontend is trying to use Permit2 endpoint which doesn't exist in phase2-relayer.mjs:
```
172.18.231.71:3002/api/intents/swap-with-permit2:1 Failed to load resource: 404 (Not Found)
```

### Solution Options

#### Option 1: Use ERC-2612 Permit (Recommended for Phase 2)
Update frontend to use `/api/intents/swap-with-permit` instead of `/api/intents/swap-with-permit2`.

**File to update:** `frontend/src/hooks/useIntentGasless.js`

**Change from:**
```javascript
const response = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit2`, {
  // ...
});
```

**Change to:**
```javascript
const response = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    chainId, 
    intent, 
    userSignature, 
    permit  // Use ERC-2612 permit, not Permit2
  })
});
```

#### Option 2: Use EIP-7702 (Recommended for Phase 3A)
Use the new EIP-7702 hook which has proper endpoints:

**File:** `frontend/src/hooks/useEIP7702Swap.js`

This hook uses the correct endpoints at port 8000 (Python backend).

---

## Testing

### Test Phase 2 Endpoints
```bash
# Start services
./start-zerotoll.sh

# Test health
curl http://localhost:3002/health

# Test fee estimate
curl http://localhost:3002/api/fee-estimate/80002/0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582
```

### Test Phase 3A Endpoints
```bash
# Start services with tests
./start-zerotoll.sh --test

# Or test manually
curl http://localhost:8000/api/eip7702/info
curl http://localhost:8000/api/eip7702/health/80002
```

---

## Port Summary

| Service | Port | Phase | Endpoints |
|---------|------|-------|-----------|
| Python Backend | 8000 | 3A | `/api/eip7702/*` |
| Node.js Relayer | 3002 | 2 | `/api/intents/*`, `/health` |
| Delegation API | 3003 | 2 | `/api/delegation/*` |
| Frontend | 3000 | All | UI |

---

## Recommendation

For **Phase 2 (ERC-4337)** testing:
- Use `/api/intents/swap-with-permit` (ERC-2612)
- Port 3002 (Node.js relayer)

For **Phase 3A (EIP-7702)** testing:
- Use `/api/eip7702/*` endpoints
- Port 8000 (Python backend)
- Use `useEIP7702Swap` hook

---

## Quick Fix for Current Error

The error you're seeing is because `useIntentGasless.js` is trying to use Permit2 which isn't implemented in phase2-relayer.mjs.

**Temporary workaround:**
1. Use the EIP-7702 demo page instead (Phase 3A)
2. Or update `useIntentGasless.js` to use `/api/intents/swap-with-permit`

**Long-term solution:**
- Phase 2 uses ERC-2612 Permit (already working)
- Phase 3A uses EIP-7702 (already working)
- No need for Permit2 in current implementation

---

**Status:** Both Phase 2 and Phase 3A endpoints are working correctly. The error is just a frontend trying to use an unimplemented Permit2 endpoint. Use the correct endpoints as documented above.
