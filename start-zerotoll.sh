#!/bin/bash

echo "🚀 Starting ZeroToll (Gasless Swaps with Pimlico)"
echo "==================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "node.*relayer" 2>/dev/null
pkill -f "node gasless_api.mjs" 2>/dev/null
pkill -f "node delegation-gasless-api.mjs" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "craco start" 2>/dev/null
tmux kill-session -t zerotoll 2>/dev/null
tmux kill-session -t frontend 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
fuser -k 3001/tcp 2>/dev/null
fuser -k 3002/tcp 2>/dev/null
fuser -k 3003/tcp 2>/dev/null
sleep 2
echo "✅ Ports cleared"

# Create log directory
mkdir -p "$SCRIPT_DIR/.pids"
rm -f "$SCRIPT_DIR/.pids"/*.log 2>/dev/null

# Fix line endings
sed -i 's/\r$//' "$SCRIPT_DIR/backend/.env" 2>/dev/null

# Check .env files
echo ""
echo "🔍 Checking environment..."
if [ -f "$SCRIPT_DIR/backend/.env" ]; then
    echo "   ✅ Backend .env found"
    if grep -q "PIMLICO_API_KEY" "$SCRIPT_DIR/backend/.env"; then
        echo "      - PIMLICO_API_KEY: ✅ Set"
    else
        echo "      - PIMLICO_API_KEY: ⚠️ Missing"
    fi
    if grep -q "RELAYER_PRIVATE_KEY" "$SCRIPT_DIR/backend/.env"; then
        echo "      - RELAYER_PRIVATE_KEY: ✅ Set"
    else
        echo "      - RELAYER_PRIVATE_KEY: ⚠️ Missing"
    fi
else
    echo "   ⚠️  Backend .env missing - copy from .env.example"
fi

# Start Python Backend (API server)
echo ""
echo "🔧 Starting Python Backend (port 8000)..."
cd "$SCRIPT_DIR/backend"

if [ -f "venv/bin/python" ]; then
    setsid ./venv/bin/python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload > "$SCRIPT_DIR/.pids/backend.log" 2>&1 &
    BACKEND_PID=$!
elif [ -f "venv/bin/python3" ]; then
    setsid ./venv/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload > "$SCRIPT_DIR/.pids/backend.log" 2>&1 &
    BACKEND_PID=$!
else
    setsid python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload > "$SCRIPT_DIR/.pids/backend.log" 2>&1 &
    BACKEND_PID=$!
fi
echo $BACKEND_PID > "$SCRIPT_DIR/.pids/backend.pid"

# Wait for backend
echo "⏳ Waiting for Python backend..."
for i in {1..30}; do
    if curl -s http://localhost:8000/api/ > /dev/null 2>&1; then
        echo "✅ Python Backend ready (PID: $BACKEND_PID)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Python Backend may still be starting... check logs"
    fi
    sleep 1
done

# Start Pimlico Relayer (Node.js - ERC-4337 gasless)
echo ""
echo "⚡ Starting Pimlico Relayer (port 3001)..."
cd "$SCRIPT_DIR/backend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing Node.js dependencies..."
    npm install > /dev/null 2>&1
fi

# Use tmux to keep the relayer running
tmux new-session -d -s zerotoll "cd $SCRIPT_DIR/backend && node pimlico-v3-relayer.mjs 2>&1 | tee $SCRIPT_DIR/.pids/relayer.log"

# Wait for relayer
echo "⏳ Waiting for Pimlico Relayer..."
for i in {1..20}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        RELAYER_STATUS=$(curl -s http://localhost:3001/health)
        echo "✅ Pimlico Relayer ready"
        echo "   Smart Account: $(echo $RELAYER_STATUS | grep -o '"smartAccount":"[^"]*"' | cut -d'"' -f4)"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "⚠️  Pimlico Relayer may still be starting... check logs"
    fi
    sleep 1
done

# Start Gasless API (Node.js - legacy)
echo ""
echo "⛽ Starting Gasless API (port 3002)..."
cd "$SCRIPT_DIR/backend"

setsid node gasless_api.mjs > "$SCRIPT_DIR/.pids/gasless.log" 2>&1 &
GASLESS_PID=$!
echo $GASLESS_PID > "$SCRIPT_DIR/.pids/gasless.pid"

# Wait for gasless API
echo "⏳ Waiting for Gasless API..."
for i in {1..15}; do
    if curl -s http://localhost:3002/api/gasless/check/0x0000000000000000000000000000000000000000/80002 > /dev/null 2>&1; then
        echo "✅ Gasless API ready (PID: $GASLESS_PID)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  Gasless API may still be starting... check logs"
    fi
    sleep 1
done

# Start Delegation API (Node.js)
echo ""
echo "🔑 Starting Delegation API (port 3003)..."
cd "$SCRIPT_DIR/backend"

setsid node delegation-gasless-api.mjs > "$SCRIPT_DIR/.pids/delegation.log" 2>&1 &
DELEGATION_PID=$!
echo $DELEGATION_PID > "$SCRIPT_DIR/.pids/delegation.pid"

# Wait for delegation API
echo "⏳ Waiting for Delegation API..."
for i in {1..15}; do
    if curl -s http://localhost:3003/api/delegation/delegate-info > /dev/null 2>&1; then
        echo "✅ Delegation API ready (PID: $DELEGATION_PID)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  Delegation API may still be starting... check logs"
    fi
    sleep 1
done

# Start Frontend (CRA with craco)
echo ""
echo "🎨 Starting Frontend (port 3000)..."
cd "$SCRIPT_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing Frontend dependencies..."
    npm install > /dev/null 2>&1
fi

# Use tmux for frontend too
tmux new-session -d -s frontend "cd $SCRIPT_DIR/frontend && npm start 2>&1 | tee $SCRIPT_DIR/.pids/frontend.log"

# Wait for frontend
echo "⏳ Frontend starting..."
for i in {1..45}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend ready"
        break
    fi
    if [ $i -eq 45 ]; then
        echo "⚠️  Frontend may still be starting... check logs"
    fi
    sleep 1
done

echo ""
echo "==================================================="
echo "✅ ZeroToll Started!"
echo "==================================================="
echo ""
echo "📊 Services:"
echo "   • Python Backend:   http://localhost:8000"
echo "   • Pimlico Relayer:  http://localhost:3001  ⚡ GASLESS"
echo "   • Gasless API:      http://localhost:3002"
echo "   • Delegation API:   http://localhost:3003"
echo "   • Frontend:         http://localhost:3000"
echo ""
echo "📝 Logs:"
echo "   tail -f $SCRIPT_DIR/.pids/backend.log"
echo "   tail -f $SCRIPT_DIR/.pids/relayer.log"
echo "   tail -f $SCRIPT_DIR/.pids/gasless.log"
echo "   tail -f $SCRIPT_DIR/.pids/delegation.log"
echo "   tail -f $SCRIPT_DIR/.pids/frontend.log"
echo ""
echo "🧪 Testing Pimlico Gasless Swaps (Sepolia):"
echo "   1. Open http://localhost:3000/swap"
echo "   2. Connect MetaMask (Sepolia testnet)"
echo "   3. Select ZTA or ZTB token"
echo "   4. Toggle 'Pimlico Gasless' ON"
echo "   5. Execute swap - YOU PAY \$0 IN GAS!"
echo ""
echo "🚰 Get Test Tokens:"
echo "   • ZTA Faucet: Call faucet() on 0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf"
echo "   • ZTB Faucet: Call faucet() on 0x8fb844251af76AF090B005643D966FC52852100a"
echo ""
echo "🛑 Stop: ./stop-zerotoll.sh"
echo ""
