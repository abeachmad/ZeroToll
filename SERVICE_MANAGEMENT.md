# 🚀 ZeroToll Service Management

This directory contains scripts to manage all ZeroToll services simultaneously.

## Quick Start

### Start All Services
```bash
./start-zerotoll.sh
```

This will start:
- ✅ MongoDB (if not already running)
- ✅ Backend (Python FastAPI) on port 8000
- ✅ Policy Server (Node.js) on port 3002
- ✅ Bundler (Infinitism) on port 3000
- ✅ Frontend (React) on port 3001

### Check Status
```bash
./status-zerotoll.sh
```

Shows real-time status of all services with:
- Process IDs
- Port numbers
- Endpoint accessibility
- Logs locations

### Stop All Services
```bash
./stop-zerotoll.sh
```

Gracefully stops all services and optionally MongoDB.

---

## Service Details

### Backend (FastAPI)
- **Port:** 8000
- **URL:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **Log:** `/tmp/zerotoll_backend.log`
- **Purpose:** Swap execution, demo mode, transaction handling

### Frontend (React)
- **Port:** 3001
- **URL:** http://localhost:3001
- **Log:** `/tmp/zerotoll_frontend.log`
- **Purpose:** User interface for swaps, wallet connection

### Bundler (Infinitism)
- **Port:** 3000
- **URL:** http://localhost:3000/rpc
- **Log:** `/tmp/zerotoll_bundler.log`
- **Purpose:** ERC-4337 bundler for gasless transactions
- **Network:** Polygon Amoy testnet

### Policy Server (Express.js)
- **Port:** 3002
- **URL:** http://localhost:3002
- **Health Check:** http://localhost:3002/api/health
- **Log:** `/tmp/zerotoll_policy_server.log`
- **Purpose:** Paymaster signature provider for gasless swaps

### MongoDB
- **Port:** 27017
- **Log:** `/tmp/mongodb.log`
- **Purpose:** Transaction history storage

---

## Logs

View logs in real-time:

```bash
# All logs
tail -f /tmp/zerotoll_*.log

# Individual services
tail -f /tmp/zerotoll_backend.log
tail -f /tmp/zerotoll_frontend.log
tail -f /tmp/zerotoll_bundler.log
tail -f /tmp/zerotoll_policy_server.log
```

---

## Troubleshooting

### Port Already in Use
If you get "port already in use" errors:
```bash
./stop-zerotoll.sh
./start-zerotoll.sh
```

### Service Won't Start
Check the logs:
```bash
tail -50 /tmp/zerotoll_<service>.log
```

Common issues:
- **Backend:** Check Python venv is activated, MongoDB is running
- **Bundler:** Verify `pnpm` is installed, network RPC is accessible
- **Policy Server:** Check Node.js version >= 16
- **Frontend:** Verify `npm install` has been run

### MongoDB Not Starting
```bash
# Check if MongoDB is installed
mongod --version

# Ensure data directory exists
sudo mkdir -p /data/db
sudo chown -R $USER:$USER /data/db

# Start manually
sudo mongod --dbpath /data/db --logpath /tmp/mongodb.log --fork
```

### Bundler Fails to Start
```bash
# Ensure pnpm dependencies are installed
cd ~/bundler-infinitism/packages/bundler
pnpm install

# Check bundler configuration
cat localconfig/mnemonic.txt  # Should contain mnemonic
```

---

## Manual Service Management

### Start Services Individually

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
PORT=3001 npm start
```

**Bundler:**
```bash
cd ~/bundler-infinitism/packages/bundler
pnpm run bundler --network amoy
```

**Policy Server:**
```bash
cd backend/policy-server
node server.js
```

**MongoDB:**
```bash
sudo mongod --dbpath /data/db --logpath /tmp/mongodb.log --fork
```

---

## Environment Variables

### Backend (.env)
Located at: `backend/.env`

```env
MONGODB_URL=mongodb://localhost:27017/
AMOY_RPC=https://rpc-amoy.polygon.technology
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
```

### Frontend (.env)
Located at: `frontend/.env`

```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_BUNDLER_RPC=http://localhost:3000/rpc
REACT_APP_POLICY_SERVER_URL=http://localhost:3002
```

### Policy Server (.env)
Located at: `backend/policy-server/.env`

```env
AMOY_PAYMASTER=0xC721582d25895956491436459df34cd817C6AB74
SEPOLIA_PAYMASTER=0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9
POLICY_SERVER_SIGNER_KEY=0xba65e483a87127ba468cec3a151773a7ae84c64b9cae49fffee6db46c90cf314
```

---

## Development Workflow

### Start for Development
```bash
# Start all services
./start-zerotoll.sh

# Open frontend
open http://localhost:3001

# Watch logs
tail -f /tmp/zerotoll_*.log
```

### Restart After Code Changes

**Backend (auto-reloads):**
- Just save your Python files, uvicorn auto-reloads

**Frontend (auto-reloads):**
- Just save your React files, hot reload happens automatically

**Policy Server (manual restart):**
```bash
lsof -ti:3002 | xargs kill -9
cd backend/policy-server && node server.js > /tmp/zerotoll_policy_server.log 2>&1 &
```

**Bundler (manual restart):**
```bash
lsof -ti:3000 | xargs kill -9
cd ~/bundler-infinitism/packages/bundler && pnpm run bundler --network amoy > /tmp/zerotoll_bundler.log 2>&1 &
```

---

## Production Deployment

For production, use a process manager like **PM2**:

```bash
# Install PM2
npm install -g pm2

# Start services with PM2
pm2 start backend/ecosystem.config.js
pm2 start frontend/ecosystem.config.js
pm2 start backend/policy-server/ecosystem.config.js
pm2 start bundler/ecosystem.config.js

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ZeroToll Stack                         │
└─────────────────────────────────────────────────────────────┘

Frontend (React)           Backend (FastAPI)
    :3001                       :8000
      │                           │
      │                           │
      └─────────┬─────────────────┘
                │
                ▼
         MongoDB (:27017)
         Transaction DB

Frontend (React)           Policy Server (Express)
    :3001                       :3002
      │                           │
      │                           │
      └─────────┬─────────────────┘
                │
                ▼
         Bundler (:3000)
         ERC-4337 UserOp Handler
                │
                ▼
         EntryPoint Contract
         (On-chain execution)
```

---

## Next Steps

1. **Start Services:** `./start-zerotoll.sh`
2. **Check Status:** `./status-zerotoll.sh`
3. **Open Frontend:** http://localhost:3001
4. **Test Gasless Swap:**
   - Toggle "Gasless Swap" ON
   - Select tokens
   - Execute swap
   - Pay $0 gas! 🎉

---

## Support

- **Documentation:** `/PHASE4_COMPLETE.md`
- **Quick Start:** `/GASLESS_QUICKSTART.md`
- **Logs:** `/tmp/zerotoll_*.log`

**Happy Swapping!** ⚡
