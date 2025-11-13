# 🚀 ZeroToll - Quick Command Reference

## Service Management

```bash
# Start all services
./start-zerotoll.sh

# Check status
./status-zerotoll.sh

# Stop all services
./stop-zerotoll.sh

# Restart everything
./stop-zerotoll.sh && ./start-zerotoll.sh
```

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3001 | Swap UI |
| Backend | http://localhost:8000 | API |
| Backend Docs | http://localhost:8000/docs | OpenAPI |
| Bundler | http://localhost:3000/rpc | ERC-4337 |
| Policy Server | http://localhost:3002 | Paymaster |
| MongoDB | localhost:27017 | Database |

## Logs

```bash
# Watch all logs
tail -f /tmp/zerotoll_*.log

# Individual logs
tail -f /tmp/zerotoll_backend.log
tail -f /tmp/zerotoll_frontend.log
tail -f /tmp/zerotoll_bundler.log
tail -f /tmp/zerotoll_policy_server.log
```

## Testing

```bash
# Check bundler
curl http://localhost:3000/rpc -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}'

# Check policy server
curl http://localhost:3002/api/health

# Check backend
curl http://localhost:8000/api/
```

## Development

```bash
# Backend (auto-reloads)
cd backend && source venv/bin/activate && uvicorn server:app --reload

# Frontend (auto-reloads)
cd frontend && PORT=3001 npm start

# Policy Server (manual restart)
cd backend/policy-server && node server.js

# Bundler (manual restart)
cd ~/bundler-infinitism/packages/bundler && pnpm run bundler --network amoy
```

## Key Files

| File | Purpose |
|------|---------|
| `start-zerotoll.sh` | Start all services |
| `stop-zerotoll.sh` | Stop all services |
| `status-zerotoll.sh` | Check service status |
| `backend/.env` | Backend configuration |
| `frontend/.env` | Frontend configuration |
| `backend/policy-server/.env` | Policy server config |

## Troubleshooting

```bash
# Port conflicts
./stop-zerotoll.sh
./start-zerotoll.sh

# View recent errors
tail -50 /tmp/zerotoll_<service>.log

# Kill specific port
lsof -ti:8000 | xargs kill -9
```

## Testing Gasless Swaps

1. Start services: `./start-zerotoll.sh`
2. Open: http://localhost:3001/swap
3. Connect wallet: `0x5a87A3c738cf99DB95787D51B627217B6dE12F62`
4. Toggle "Gasless Swap" ON ⚡
5. Select tokens and execute
6. Pay $0 gas! 🎉

## Documentation

- **Complete Guide:** `SERVICE_MANAGEMENT.md`
- **Phase 4 Done:** `PHASE4_COMPLETE.md`
- **Gasless Guide:** `GASLESS_QUICKSTART.md`
- **Phase 3 Done:** `PHASE3_COMPLETE.md`
