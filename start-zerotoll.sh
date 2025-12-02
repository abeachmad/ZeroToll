#!/bin/bash

echo "🚀 Starting ZeroToll (EIP-7702 TRUE GASLESS Swaps)"
echo "==================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "node gasless_api.mjs" 2>/dev/null
pkill -f "node delegation-gasless-api.mjs" 2>/dev/null
pkill -f "node gasless-relay-api.mjs" 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
fuser -k 3002/tcp 2>/dev/null
fuser -k 3003/tcp 2>/dev/null
fuser -k 3004/tcp 2>/dev/null
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

# Start Gasless API (Node.js)
echo ""
echo "⛽ Starting Gasless API (port 3002)..."
cd "$SCRIPT_DIR/backend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing Node.js dependencies..."
    npm install > /dev/null 2>&1
fi

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

# Start Frontend (Next.js)
echo ""
echo "🎨 Starting Frontend - Next.js (port 3000)..."
cd "$SCRIPT_DIR/frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing Frontend dependencies..."
    npm install > /dev/null 2>&1
fi

setsid npm run dev > "$SCRIPT_DIR/.pids/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/.pids/frontend.pid"

# Wait for frontend
echo "⏳ Frontend starting (Next.js is fast!)..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ Frontend ready (PID: $FRONTEND_PID)"
        break
    fi
    if [ $i -eq 30 ]; then
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
echo "   • Gasless API:      http://localhost:3002"
echo "   • Delegation API:   http://localhost:3003"
echo "   • Frontend:         http://localhost:3000"
echo ""
echo "📝 Logs:"
echo "   tail -f $SCRIPT_DIR/.pids/backend.log"
echo "   tail -f $SCRIPT_DIR/.pids/gasless.log"
echo "   tail -f $SCRIPT_DIR/.pids/delegation.log"
echo "   tail -f $SCRIPT_DIR/.pids/frontend.log"
echo ""
echo "🧪 Testing TRUE Gasless Swaps:"
echo "   1. Open http://localhost:3000"
echo "   2. Connect MetaMask (Sepolia testnet)"
echo "   3. Enable Smart Account in MetaMask settings"
echo "   4. Click 'Test Gasless Approval' - YOU PAY \$0 IN GAS!"
echo ""
echo "🛑 Stop: ./stop-zerotoll.sh"
echo ""
