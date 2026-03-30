#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

echo "[DEPRECATED] run-relayer.sh starts a legacy relayer."
echo "[DEPRECATED] Official entry point: ./start-zerotoll.sh"
echo "[DEPRECATED] Legacy inventory: backend/LEGACY_SERVICES.md"

# Load environment variables
set -a
source .env.credentials
set +a

# Kill any existing relayer
pkill -f "pimlico-v3-relayer" 2>/dev/null
sleep 2

# Create log directory
mkdir -p .pids

# Start relayer with setsid to create new session
setsid node backend/legacy/pimlico-v3-relayer.mjs > .pids/relayer.log 2>&1 &
RELAYER_PID=$!
echo $RELAYER_PID > .pids/relayer.pid
echo "Relayer started with PID: $RELAYER_PID"

# Wait for it to be ready
for i in {1..20}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo "✅ Relayer is ready!"
        break
    fi
    sleep 1
done

# Test the endpoint
echo ""
echo "Testing relayer..."
SEPOLIA_ROUTER=$(curl -s http://localhost:3001/api/config/11155111 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('routerAddress','N/A'))" 2>/dev/null)
AMOY_ROUTER=$(curl -s http://localhost:3001/api/config/80002 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('routerAddress','N/A'))" 2>/dev/null)

echo "Sepolia Router: $SEPOLIA_ROUTER"
echo "Amoy Router: $AMOY_ROUTER"
echo ""
echo "Relayer is running in background (PID: $RELAYER_PID)"
echo "Logs: tail -f .pids/relayer.log"
