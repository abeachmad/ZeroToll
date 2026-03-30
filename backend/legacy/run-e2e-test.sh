#!/bin/bash
# Run self-hosted relayer and e2e test together

cd "$(dirname "$0")/../.."

echo "[DEPRECATED] backend/legacy/run-e2e-test.sh is a legacy helper."
echo "[DEPRECATED] Official entry point: ./start-zerotoll.sh"
echo "[DEPRECATED] This script still targets backend/legacy/self-hosted-relayer.mjs."
echo "[DEPRECATED] Legacy inventory: backend/LEGACY_SERVICES.md"

echo "Starting self-hosted relayer in background..."
node backend/legacy/self-hosted-relayer.mjs &
RELAYER_PID=$!

# Wait for relayer to start
sleep 5

# Check if relayer is running
if ! curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "❌ Relayer failed to start"
    kill $RELAYER_PID 2>/dev/null
    exit 1
fi

echo "✅ Relayer running"
echo ""

# Run e2e test
echo "Running E2E test..."
node backend/test-self-hosted-e2e.mjs

# Cleanup
echo ""
echo "Stopping relayer..."
kill $RELAYER_PID 2>/dev/null
