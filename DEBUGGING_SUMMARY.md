# ZeroToll Debugging Summary

**Date:** 2025-11-13  
**Session:** Complete Stack Debugging - Two Rounds

---

## Issues Found & Fixed

### Round 1: Initial Startup Errors

#### Issue 1: Frontend - Missing ethers Dependency
**Error:**
```
Module not found: Can't resolve 'ethers' in '/home/abeachmad/ZeroToll/frontend/src/hooks'
Module not found: Can't resolve 'ethers' in '/home/abeachmad/ZeroToll/frontend/src/lib'
Module not found: Can't resolve 'ethers' in '/home/abeachmad/ZeroToll/frontend/src/pages'
```

**Root Cause:**  
Phase 4 gasless implementation added files that import `ethers`:
- `frontend/src/lib/accountAbstraction.js`
- `frontend/src/hooks/useGaslessSwap.js`
- `frontend/src/pages/Swap.jsx`

But frontend uses `viem/wagmi` stack and didn't have `ethers` installed.

**Fix:**
- Added `"ethers": "^6.13.0"` to `frontend/package.json` dependencies
- Installed via: `yarn add ethers@^6.13.0`

**Status:** ✅ Fixed

---

#### Issue 2: Bundler - Wrong Directory Path
**Error:**
```
./start-zerotoll.sh: line 69: cd: /home/abeachmad/bundler-infinitism/packages/bundler: No such file or directory
```

**Root Cause:**  
`start-zerotoll.sh` referenced wrong path (missing `ZeroToll/` prefix)

**Fix:**
Changed in `start-zerotoll.sh`:
```bash
# OLD:
cd /home/abeachmad/bundler-infinitism/packages/bundler

# NEW:
cd /home/abeachmad/ZeroToll/bundler-infinitism/packages/bundler
```

**Status:** ✅ Fixed

---

#### Issue 3: Bundler - Missing Script Error
**Error:**
```
ERR_PNPM_NO_SCRIPT Missing script: bundler
```

**Root Cause:**  
Script used `pnpm run bundler --network amoy` but:
- Bundler uses `yarn`, not `pnpm`
- Correct command is just `bundler` not `run bundler`
- `--network` flag not supported (uses config file instead)

**Fix:**
Changed bundler command in `start-zerotoll.sh`:
```bash
# OLD:
nohup pnpm run bundler --network amoy > /tmp/zerotoll_bundler.log 2>&1 &

# NEW:
nohup yarn bundler --config ./localconfig/bundler.amoy.config.json > /tmp/zerotoll_bundler.log 2>&1 &
```

**Status:** ✅ Fixed

---

#### Issue 4: Bundler - No Amoy Configuration
**Problem:**  
Only `bundler.config.json` existed (localhost config), no Amoy testnet config

**Fix:**
Created `bundler-infinitism/packages/bundler/localconfig/bundler.amoy.config.json`:
```json
{
  "chainId": 80002,
  "gasFactor": "1",
  "port": "3000",
  "privateApiPort": "3003",
  "network": "https://rpc-amoy.polygon.technology/",
  "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  "beneficiary": "0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e",
  "minBalance": "0.1",
  "mnemonic": "./localconfig/mnemonic.txt",
  "maxBundleGas": 5000000,
  "minStake": "0.1",
  "minUnstakeDelay": 0,
  "autoBundleInterval": 3,
  "autoBundleMempoolSize": 10,
  "unsafe": true
}
```

**Values Source:**
- EntryPoint: From PHASE3_COMPLETE.md (v0.7 address)
- Beneficiary: From PHASE3_COMPLETE.md (bundler wallet)
- Network: Amoy public RPC
- ChainId: Polygon Amoy testnet (80002)

**Status:** ✅ Fixed

---

#### Issue 5: Bundler - Test Mnemonic
**Problem:**  
`mnemonic.txt` contained default test mnemonic (unfunded wallet)

**Fix:**
Updated `bundler-infinitism/packages/bundler/localconfig/mnemonic.txt` with actual bundler wallet mnemonic from PHASE3_COMPLETE.md

**Status:** ✅ Fixed

---

#### Issue 6: Bundler - Validation Error
**Error:**
```
FATAL: full validation requires a node with debug_traceCall. for local UNSAFE mode: use --unsafe
error Command failed with exit code 1.
```

**Root Cause:**  
Bundler requires either:
- Archive node with `debug_traceCall` support, OR
- `--unsafe` mode for testing with public RPC

Amoy public RPC doesn't support debug_traceCall

**Fix:**
Added `"unsafe": true` to `bundler.amoy.config.json`

**Status:** ✅ Fixed

---

### Round 2: Port Conflict

#### Issue 7: Frontend-Bundler Port Conflict
**Error:**
```
Something is already running on port 3001.
```

**Root Cause:**  
Bundler's `privateApiPort` was set to `3001`, conflicting with frontend

**Fix:**
Changed `privateApiPort` in `bundler.amoy.config.json`:
```json
"privateApiPort": "3003"  // Changed from 3001
```

**Status:** ✅ Fixed

---

## Final Verification (Second Debugging Round)

### Service Status
```
✅ MongoDB - Running (PID: 5101)
✅ Backend - Running (PID: 6230, Port: 8000)
✅ Bundler - Running (PID: 6359, Port: 3000)
✅ Frontend - Running (PID: 6477, Port: 3001)
✅ Policy Server - Running (PID: 6294, Port: 3002)

Summary: 5/5 services running
```

### API Tests

**Bundler RPC:**
```bash
curl http://localhost:3000/rpc -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}'

Response: {"jsonrpc":"2.0","id":1,"result":["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]}
✅ Working - Returns EntryPoint v0.7 address
```

**Policy Server:**
```bash
curl http://localhost:3002/health

Response: {"status":"ok","signer":"0x84d44b412CeA92064B5441fB7CfC354Ec1750eb2","networks":["amoy","sepolia"]}
✅ Working - Ready to sponsor UserOps
```

**Backend:**
```bash
curl http://localhost:8000/api/stats

Response: {"totalSwaps":39,"successfulSwaps":18,...}
✅ Working - API responding with stats
```

**Frontend:**
```bash
curl -o /dev/null -w "%{http_code}" http://localhost:3001

Response: 200
✅ Working - Frontend accessible
```

### Log Checks
- **Frontend:** ✅ No errors (ethers module resolved)
- **Bundler:** ✅ No errors (unsafe mode working)
- **Backend:** ✅ No errors (MongoDB connected)
- **Policy Server:** ✅ No errors (ready to sponsor)

---

## Files Modified

### 1. frontend/package.json
**Change:** Added ethers dependency
```json
"ethers": "^6.13.0"
```

### 2. start-zerotoll.sh
**Changes:**
- Fixed bundler directory path
- Updated bundler command to use config file
```bash
cd /home/abeachmad/ZeroToll/bundler-infinitism/packages/bundler
nohup yarn bundler --config ./localconfig/bundler.amoy.config.json > /tmp/zerotoll_bundler.log 2>&1 &
```

### 3. bundler-infinitism/packages/bundler/localconfig/bundler.amoy.config.json
**Status:** Created new file
**Purpose:** Amoy testnet configuration with EntryPoint v0.7

### 4. bundler-infinitism/packages/bundler/localconfig/mnemonic.txt
**Change:** Updated with actual bundler wallet mnemonic (from existing docs)

---

## Port Allocation

| Service        | Port | Purpose                |
|----------------|------|------------------------|
| Backend        | 8000 | Transaction API        |
| Bundler Public | 3000 | ERC-4337 RPC           |
| Frontend       | 3001 | React UI               |
| Policy Server  | 3002 | Paymaster Sponsorship  |
| Bundler Private| 3003 | Bundler Admin API      |
| MongoDB        | 27017| Database               |

---

## No Hardcoded Values

All configuration values used were sourced from existing documentation:
- **EntryPoint Address:** From PHASE3_COMPLETE.md (deployed v0.7)
- **Bundler Wallet:** From PHASE3_COMPLETE.md (beneficiary address)
- **Bundler Mnemonic:** From PHASE3_COMPLETE.md (wallet recovery phrase)
- **Network RPC:** Polygon public documentation (Amoy testnet)
- **Chain ID:** Polygon public documentation (80002 for Amoy)

No new addresses or private keys were generated during debugging.

---

## Summary

**Total Issues Found:** 7  
**Total Issues Fixed:** 7  
**Success Rate:** 100%

**Debugging Rounds Completed:** 2  
- Round 1: Fixed 6 initial issues
- Round 2: Fixed 1 port conflict, verified all services

**Final Status:** ✅ All ZeroToll services operational

---

**Next Steps:**
1. Access frontend at http://localhost:3001
2. Navigate to Swap page
3. Toggle "Gasless Swap" mode
4. Test complete gasless swap flow
5. Verify UserOp submission to bundler
6. Confirm paymaster sponsorship working
