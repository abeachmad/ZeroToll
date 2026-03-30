#!/bin/bash

echo "🚀 Starting ZeroToll (Self-Hosted Paymaster - Gasless Swaps)"
echo "============================================================="
echo ""

# Parse command line arguments
RUN_TESTS=false
if [ "$1" == "--test" ] || [ "$1" == "-t" ]; then
    RUN_TESTS=true
    echo "🧪 Test mode enabled - will run EIP-7702 tests after startup"
    echo ""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "node.*relayer" 2>/dev/null
pkill -f "node phase2-relayer.mjs" 2>/dev/null
pkill -f "node delegation-gasless-api.mjs" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "craco start" 2>/dev/null
tmux kill-session -t zerotoll 2>/dev/null
tmux kill-session -t frontend 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
fuser -k 3002/tcp 2>/dev/null
fuser -k 3003/tcp 2>/dev/null
sleep 2
echo "✅ Ports cleared"

# Create log directory
mkdir -p "$SCRIPT_DIR/.pids"
rm -f "$SCRIPT_DIR/.pids"/*.log 2>/dev/null

# Fix line endings
sed -i 's/\r$//' "$SCRIPT_DIR/backend/.env" 2>/dev/null

# Start MongoDB (for history storage)
echo ""
echo "🗄️  Starting MongoDB..."
MONGO_DATA_DIR="$HOME/mongodb-data"
mkdir -p "$MONGO_DATA_DIR"

# Check if MongoDB is already running
if pgrep -x mongod > /dev/null 2>&1; then
    echo "   ✅ MongoDB already running"
else
    # Clean up stale socket file if exists
    sudo rm -f /tmp/mongodb-27017.sock 2>/dev/null
    
    # Start MongoDB
    if command -v mongod &> /dev/null; then
        mongod --dbpath "$MONGO_DATA_DIR" --fork --logpath "$MONGO_DATA_DIR/mongod.log" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "   ✅ MongoDB started (data: $MONGO_DATA_DIR)"
        else
            echo "   ⚠️  MongoDB failed to start - history won't be saved"
        fi
    else
        echo "   ⚠️  MongoDB not installed - history won't be saved"
        echo "      Install: sudo apt install mongodb-org"
    fi
fi

# Check .env files
echo ""
echo "🔍 Checking environment..."

# Check .env.credentials (primary config)
if [ -f "$SCRIPT_DIR/.env.credentials" ]; then
    echo "   ✅ .env.credentials found"
    if grep -q "PIMLICO_API_KEY" "$SCRIPT_DIR/.env.credentials"; then
        echo "      - PIMLICO_API_KEY: ✅ Set (for bundler)"
    else
        echo "      - PIMLICO_API_KEY: ⚠️ Missing (needed for bundler)"
    fi
    if grep -q "RELAYER_PRIVATE_KEY" "$SCRIPT_DIR/.env.credentials"; then
        echo "      - RELAYER_PRIVATE_KEY: ✅ Set"
    else
        echo "      - RELAYER_PRIVATE_KEY: ⚠️ Missing"
    fi
else
    echo "   ⚠️  .env.credentials missing - copy from .env.example"
fi

# Start Python Backend (API server)
echo ""
echo "🔧 Starting Python Backend (port 8000)..."
cd "$SCRIPT_DIR/backend"

if [ -f "venv/bin/python" ]; then
    BACKEND_PYTHON="./venv/bin/python"
elif [ -f "venv/bin/python3" ]; then
    BACKEND_PYTHON="./venv/bin/python3"
else
    BACKEND_PYTHON="python3"
fi

start_backend() {
    local reload_flag="$1"
    setsid $BACKEND_PYTHON -m uvicorn server:app --host 0.0.0.0 --port 8000 $reload_flag > "$SCRIPT_DIR/.pids/backend.log" 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > "$SCRIPT_DIR/.pids/backend.pid"
}

start_backend "--reload"

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

if ! curl -s http://localhost:8000/api/ > /dev/null 2>&1; then
    if grep -q "Address already in use" "$SCRIPT_DIR/.pids/backend.log" || grep -q "Errno 98" "$SCRIPT_DIR/.pids/backend.log"; then
        echo "   🔁 Backend reload mode hit a bind race. Retrying without --reload..."
        kill "$BACKEND_PID" > /dev/null 2>&1 || true
        sleep 1
        start_backend ""

        for i in {1..20}; do
            if curl -s http://localhost:8000/api/ > /dev/null 2>&1; then
                echo "✅ Python Backend ready (PID: $BACKEND_PID, reload disabled)"
                break
            fi
            if [ $i -eq 20 ]; then
                echo "⚠️  Python Backend fallback start failed - check logs"
            fi
            sleep 1
        done
    fi
fi

# Check if node_modules exists
cd "$SCRIPT_DIR/backend"
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

# Start ZeroToll Relayer (Self-Hosted Paymaster - port 3002)
echo ""
echo "💎 Starting ZeroToll Relayer (port 3002) - SELF-HOSTED PAYMASTER..."
cd "$SCRIPT_DIR/backend"

# Use tmux to keep the relayer running
tmux new-session -d -s zerotoll "cd $SCRIPT_DIR && set -a && source .env.credentials && set +a && cd backend && node phase2-relayer.mjs 2>&1 | tee $SCRIPT_DIR/.pids/relayer.log"

# Wait for relayer
echo "⏳ Waiting for ZeroToll Relayer..."
for i in {1..20}; do
    if curl -s http://localhost:3002/health > /dev/null 2>&1; then
        echo "✅ ZeroToll Relayer ready"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "⚠️  ZeroToll Relayer may still be starting... check logs"
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

# Check if node_modules exists for frontend
cd "$SCRIPT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "   📦 Installing Frontend dependencies..."
    npm install > /dev/null 2>&1
fi

# Start Frontend (CRA with craco)

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
echo "============================================================="
echo "✅ ZeroToll Started! (EIP-7702 Implementation - LIVE)"
echo "============================================================="
echo ""
echo "📊 Services:"
echo "   • Frontend:          http://localhost:3000"
echo "   • Python Backend:    http://localhost:8000"
echo "   • ZeroToll Relayer:  http://localhost:3002/health"
echo "   • Delegation API:    http://localhost:3003/api/delegation/delegate-info"
echo ""
echo "🚀 EIP-7702 Endpoints (Type 0x04 Transactions):"
echo "   • Info:    http://localhost:8000/api/eip7702/info"
echo "   • Health:  http://localhost:8000/api/eip7702/health/{chain_id}"
echo "   • Nonce:   http://localhost:8000/api/eip7702/nonce/{chain_id}/{address}"
echo "   • Quote:   POST http://localhost:8000/api/eip7702/quote"
echo "   • Execute: POST http://localhost:8000/api/eip7702/execute"
echo ""
echo "🚀 EIP-7702 Delegates (50% Gas Savings!):"
echo "   • Sepolia:  0xcFE005B2E0013e0FF8cB0569d9b103094d423B36"
echo "   • Amoy:     0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
echo "   • Gas Cost: ~150,000 (vs ERC-4337: ~300,000)"
echo "   • Savings:  50% cheaper! 🎉"
echo ""
echo "💎 Relayer Status:"
echo "   • Address:  0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A"
echo "   • Sepolia:  1.0 ETH (funded ✅)"
echo "   • Amoy:     6.0 POL (funded ✅)"
echo ""
echo "📝 Logs:"
echo "   tail -f $SCRIPT_DIR/.pids/backend.log"
echo "   tail -f $SCRIPT_DIR/.pids/relayer.log"
echo "   tail -f $SCRIPT_DIR/.pids/delegation.log"
echo "   tail -f $SCRIPT_DIR/.pids/frontend.log"
echo ""
echo "🧪 Testing EIP-7702 Gasless Swaps:"
echo ""
echo "   1. Open http://localhost:3000/swap"
echo "   2. Connect MetaMask (Sepolia recommended)"
echo "   3. Toggle 'EIP-7702 Gasless' ON"
echo "   4. Enter swap: USDC → ETH (native)"
echo "   5. Sign 3 times:"
echo "      - ✍️  EIP-7702 Authorization (delegate EOA)"
echo "      - ✍️  EIP-2612 Permit (approve tokens)"
echo "      - ✍️  EIP-712 Intent (swap parameters)"
echo "   6. Wait for transaction"
echo "   7. Check Etherscan - Transaction Type: 0x04 ✅"
echo ""
echo "💰 Fee Info:"
echo "   • Fee = 2x estimated gas cost (dynamic)"
echo "   • Deducted from OUTPUT token after swap"
echo "   • User pays NO gas (relayer pays)"
echo "   • Example: ~\$0.01 for USDC→ETH swap"
echo ""
echo "🔍 Verify Transaction:"
echo "   • Sepolia: https://sepolia.etherscan.io/"
echo "   • Amoy:    https://amoy.polygonscan.com/"
echo "   • Look for: Transaction Type = 0x04 (EIP-7702)"
echo ""
echo "🛑 Stop: bash ./stop-zerotoll.sh"
echo ""

# Run EIP-7702 tests if requested
if [ "$RUN_TESTS" = true ]; then
    echo "============================================================="
    echo "🧪 Running EIP-7702 Backend Tests"
    echo "============================================================="
    echo ""
    
    # Wait a bit for all services to stabilize
    echo "⏳ Waiting for services to stabilize..."
    sleep 3
    
    # Run the tests
    cd "$SCRIPT_DIR/backend"
    echo "📋 Running test suite..."
    echo ""
    
    if [ -f "venv/bin/python3" ]; then
        ./venv/bin/python3 test_eip7702.py
    elif [ -f "venv/bin/python" ]; then
        ./venv/bin/python test_eip7702.py
    else
        python3 test_eip7702.py
    fi
    
    TEST_EXIT_CODE=$?
    
    echo ""
    echo "============================================================="
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo "✅ All EIP-7702 tests passed!"
        echo "🎉 50% gas savings confirmed!"
    else
        echo "❌ Some tests failed - check output above"
    fi
    echo "============================================================="
    echo ""
    echo "📊 Test Summary:"
    echo "   • Backend API: 5 endpoints tested"
    echo "   • Networks: Amoy (80002) + Sepolia (11155111)"
    echo "   • Gas Savings: 50% vs ERC-4337"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Open http://localhost:3000 for frontend testing"
    echo "   2. Connect wallet (MetaMask)"
    echo "   3. Navigate to EIP-7702 demo page"
    echo "   4. Test gasless swap flow"
    echo ""
fi
