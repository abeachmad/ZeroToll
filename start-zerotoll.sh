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

# Check .env.credentials (primary config)
if [ -f "$SCRIPT_DIR/.env.credentials" ]; then
    echo "   ✅ .env.credentials found"
    if grep -q "PIMLICO_API_KEY" "$SCRIPT_DIR/.env.credentials"; then
        echo "      - PIMLICO_API_KEY: ✅ Set"
    else
        echo "      - PIMLICO_API_KEY: ⚠️ Missing"
    fi
    if grep -q "RELAYER_PRIVATE_KEY" "$SCRIPT_DIR/.env.credentials"; then
        echo "      - RELAYER_PRIVATE_KEY: ✅ Set"
    else
        echo "      - RELAYER_PRIVATE_KEY: ⚠️ Missing"
    fi
    if grep -q "ZEROTOLL_ROUTER_SEPOLIA" "$SCRIPT_DIR/.env.credentials"; then
        ROUTER=$(grep "ZEROTOLL_ROUTER_SEPOLIA" "$SCRIPT_DIR/.env.credentials" | cut -d'=' -f2)
        echo "      - Router (Sepolia): $ROUTER"
    fi
else
    echo "   ⚠️  .env.credentials missing - copy from .env.example"
fi

# Also check backend .env for legacy support
if [ -f "$SCRIPT_DIR/backend/.env" ]; then
    echo "   ✅ Backend .env found (legacy)"
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

# Load credentials for relayer
if [ -f "$SCRIPT_DIR/.env.credentials" ]; then
    echo "   📋 Loading credentials from .env.credentials"
    set -a
    source "$SCRIPT_DIR/.env.credentials"
    set +a
fi

# Use tmux to keep the relayer running
tmux new-session -d -s zerotoll "cd $SCRIPT_DIR && set -a && source .env.credentials && set +a && cd backend && node pimlico-v3-relayer.mjs 2>&1 | tee $SCRIPT_DIR/.pids/relayer.log"

# Wait for relayer
echo "⏳ Waiting for Pimlico Relayer..."
for i in {1..20}; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        RELAYER_STATUS=$(curl -s http://localhost:3001/health)
        echo "✅ Pimlico Relayer ready"
        SMART_ACCOUNT=$(echo $RELAYER_STATUS | python3 -c "import sys,json; print(json.load(sys.stdin).get('chains',[{}])[0].get('smartAccount','N/A'))" 2>/dev/null || echo "N/A")
        echo "   Smart Account: $SMART_ACCOUNT"
        ROUTER=$(curl -s http://localhost:3001/api/config/11155111 | python3 -c "import sys,json; print(json.load(sys.stdin).get('routerAddress','N/A'))" 2>/dev/null || echo "N/A")
        echo "   Router (Sepolia): $ROUTER"
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
echo "📝 Contracts (Sepolia - chainId 11155111):"
echo "   • Router:     0x577560699EF88e99f15d04df57c9552056d2a10D"
echo "   • zUSDC:      0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
echo "   • zETH:       0x8153FA09Be1689D44C343f119C829F6702A8720b"
echo "   • zPOL:       0x63c31C4247f6AA40B676478226d6FEB5707649D6"
echo "   • zLINK:      0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C"
echo ""
echo "📝 Contracts (Polygon Amoy - chainId 80002):"
echo "   • Router:     0xc75df1943d6EFE04b422b9bB45509782609Fc67a"
echo "   • zUSDC:      0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD"
echo "   • zETH:       0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9"
echo "   • zPOL:       0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d"
echo "   • zLINK:      0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1"
echo ""
echo "📝 Logs:"
echo "   tail -f $SCRIPT_DIR/.pids/backend.log"
echo "   tail -f $SCRIPT_DIR/.pids/relayer.log"
echo "   tail -f $SCRIPT_DIR/.pids/gasless.log"
echo "   tail -f $SCRIPT_DIR/.pids/delegation.log"
echo "   tail -f $SCRIPT_DIR/.pids/frontend.log"
echo ""
echo "🧪 Testing Pimlico Gasless Swaps:"
echo "   1. Open http://localhost:3000/swap"
echo "   2. Connect MetaMask (Sepolia or Polygon Amoy)"
echo "   3. Select zUSDC, zETH, zPOL, or zLINK token"
echo "   4. Toggle 'Pimlico Gasless' ON"
echo "   5. Execute swap - YOU PAY \$0 IN GAS!"
echo ""
echo "🚰 Get Test Tokens (call faucet() on any zToken):"
echo "   Sepolia:"
echo "   • zUSDC: 0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
echo "   Amoy:"
echo "   • zUSDC: 0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD"
echo "   • zETH:  0x8153FA09Be1689D44C343f119C829F6702A8720b"
echo ""
echo "🛑 Stop: ./stop-zerotoll.sh"
echo ""
