# ZeroToll Service Management

This repo currently has one official local runtime path: `bash ./start-zerotoll.sh`.

## Official Commands

### Start
```bash
bash ./start-zerotoll.sh
npm run start:local
```

### Status
```bash
bash ./status-zerotoll.sh
npm run status:local
```

### Stop
```bash
bash ./stop-zerotoll.sh
npm run stop:local
```

## Official Service Topology

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| MongoDB | 27017 | `mongodb://localhost:27017` | Transaction history storage |
| Backend (FastAPI) | 8000 | http://localhost:8000 | Quotes, execution, history, config, EIP-7702 routes |
| ZeroToll Relayer | 3002 | http://localhost:3002/health | ERC-4337 relayer and paymaster flow |
| Delegation API | 3003 | http://localhost:3003/api/delegation/delegate-info | Delegation metadata and gasless helpers |
| Frontend (React) | 3000 | http://localhost:3000 | Main web UI |

## Logs

`start-zerotoll.sh` writes runtime logs into `.pids/` at the repo root.

```bash
tail -f .pids/backend.log
tail -f .pids/relayer.log
tail -f .pids/delegation.log
tail -f .pids/frontend.log
```

MongoDB keeps its own log under `~/mongodb-data/mongod.log` when started by the script.

## Health Checks

```bash
curl http://localhost:8000/api/
curl http://localhost:8000/api/eip7702/info
curl http://localhost:3002/health
curl http://localhost:3003/api/delegation/delegate-info
curl http://localhost:3000
```

## Manual Service Start

### Backend
```bash
cd backend
./venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Relayer
```bash
cd backend
set -a
source ../.env.credentials
set +a
node phase2-relayer.mjs
```

### Delegation API
```bash
cd backend
node delegation-gasless-api.mjs
```

### Frontend
```bash
cd frontend
npm start
```

## Important Environment Variables

### Repo root `.env.credentials`
```env
PIMLICO_API_KEY=...
RELAYER_PRIVATE_KEY=...
```

### Backend
```env
MONGODB_URL=mongodb://localhost:27017/
AMOY_RPC=https://rpc-amoy.polygon.technology
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
```

### Frontend
```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_RELAYER_URL=http://localhost:3002
REACT_APP_DELEGATION_API_URL=http://localhost:3003
```

## Legacy Utilities

The following are still in the repo, but they are not part of the official `start-zerotoll.sh` stack:

- `scripts/`
- `archive/legacy-services/root-scripts/start-services.sh`
- `archive/legacy-services/root-scripts/run-relayer.sh`
- `archive/legacy-services/root-scripts/run-e2e-test.sh`
- `backend/legacy/`
- `archive/legacy-services/`
- `archive/experiments/`
- `archive/vendor/`
- `backend/LEGACY_SERVICES.md`

Treat them as legacy or experimental paths until the repo cleanup is completed.

Historical status notes, deployment logs, and one-off fix reports that used to live at the repo root are now archived under `docs/archive/root-notes/`.
