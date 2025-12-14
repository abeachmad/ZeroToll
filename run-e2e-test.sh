#!/bin/bash
cd /home/abeachmad/ZeroToll

# Load environment variables
set -a
source .env.credentials
set +a

# Kill any existing relayer
pkill -f "pimlico-v3-relayer" 2>/dev/null
sleep 2

# Start relayer in background
node backend/pimlico-v3-relayer.mjs &
RELAYER_PID=$!
echo "Relayer started with PID: $RELAYER_PID"

# Wait for relayer to be ready
sleep 12

# Run the E2E test
echo ""
echo "Running E2E test..."
node backend/test-api-e2e.mjs

# Cleanup
kill $RELAYER_PID 2>/dev/null
