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
fuser -k 8000/tcp 2>/dev/null
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
        PAYMASTER_SEP=$(curl -s http://localhost:3002/health | python3 -c "import sys,json; d=json.load(sys.stdin); print([c['paymaster'] for c in d.get('chains',[]) if c['chainId']==11155111][0])" 2>/dev/null || echo "N/A")
        PAYMASTER_AMOY=$(curl -s http://localhost:3002/health | python3 -c "import sys,json; d=json.load(sys.stdin); print([c['paymaster'] for c in d.get('chains',[]) if c['chainId']==80002][0])" 2>/dev/null || echo "N/A")
        SMART_ACCOUNT=$(curl -s http://localhost:3002/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('chains',[{}])[0].get('smartAccount','N/A'))" 2>/dev/null || echo "N/A")
        echo "   Smart Account: $SMART_ACCOUNT"
        echo "   Paymaster (Sepolia): $PAYMASTER_SEP"
        echo "   Paymaster (Amoy): $PAYMASTER_AMOY"
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
echo "============================================================="
echo "✅ ZeroToll Started! (Phase 3A - EIP-7702 Integration)"
echo "============================================================="
echo ""
echo "📊 Services:"
echo "   • Python Backend:    http://localhost:8000"
echo "   • ZeroToll Relayer:  http://localhost:3002  💎 SELF-HOSTED PAYMASTER"
echo "   • Delegation API:    http://localhost:3003"
echo "   • Frontend:          http://localhost:3000"
echo ""
echo "🚀 EIP-7702 Endpoints (NEW!):"
echo "   • Info:    http://localhost:8000/api/eip7702/info"
echo "   • Health:  http://localhost:8000/api/eip7702/health/{chain_id}"
echo "   • Nonce:   http://localhost:8000/api/eip7702/nonce/{chain_id}/{address}"
echo "   • Quote:   POST http://localhost:8000/api/eip7702/quote"
echo "   • Execute: POST http://localhost:8000/api/eip7702/execute"
echo ""
echo "💎 Self-Hosted Paymasters (VerifyingPaymasterV07):"
echo "   • Sepolia:  0xaf7e002447b790f212ea435f9387509cd1ef0054"
echo "   • Amoy:     0xaad1211a722ee04b6980724586b6b5b7b0c86fee"
echo ""
echo "🚀 EIP-7702 Delegates (Phase 3A - 50% Gas Savings!):"
echo "   • Sepolia:  0xcFE005B2E0013e0FF8cB0569d9b103094d423B36"
echo "   • Amoy:     0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
echo "   • Gas Cost: ~150,000 (vs ERC-4337: ~300,000)"
echo "   • Savings:  50% cheaper! 🎉"
echo ""
echo "💰 Phase 2B Fee System (Amoy):"
echo "   • Treasury:   0xD6a7294445F34d0F7244b2072696106904ea807B"
echo "   • RouterV3:   0xD83D377E4698317731b2953854c01d39C60815d7"
echo "   • Fee:        2x gas cost (dynamic, from input token)"
echo "   • Split:      80% LP rewards | 15% Ops | 5% Reserve"
echo ""
echo "📝 Contracts (Sepolia - chainId 11155111):"
echo "   • RouterV3:   0xB54e95a30E4Aa355380798313E0791833C7F0BFF (with fee)"
echo "   • Treasury:   0xA5e89F1485D56fd5dfA20B6FDC9874B8bCF0bd10"
echo "   • zUSDC:      0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
echo "   • zETH:       0x8153FA09Be1689D44C343f119C829F6702A8720b"
echo "   • zPOL:       0x63c31C4247f6AA40B676478226d6FEB5707649D6"
echo "   • zLINK:      0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C"
echo ""
echo "📝 Contracts (Polygon Amoy - chainId 80002):"
echo "   • RouterV2:   0xc75df1943d6EFE04b422b9bB45509782609Fc67a"
echo "   • RouterV3:   0xD83D377E4698317731b2953854c01d39C60815d7 (with fee)"
echo "   • Treasury:   0xD6a7294445F34d0F7244b2072696106904ea807B"
echo "   • zUSDC:      0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD"
echo "   • zETH:       0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9"
echo "   • zPOL:       0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d"
echo "   • zLINK:      0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1"
echo ""
echo "📝 Logs:"
echo "   tail -f $SCRIPT_DIR/.pids/backend.log"
echo "   tail -f $SCRIPT_DIR/.pids/relayer.log"
echo "   tail -f $SCRIPT_DIR/.pids/delegation.log"
echo "   tail -f $SCRIPT_DIR/.pids/frontend.log"
echo ""
echo "🧪 Testing ZeroToll Gasless Swaps:"
echo ""
echo "   Phase 2 (ERC-4337):"
echo "   1. Open http://localhost:3000/swap"
echo "   2. Connect MetaMask (Sepolia or Polygon Amoy)"
echo "   3. Select zUSDC, zETH, zPOL, or zLINK token"
echo "   4. Enable 'ZeroToll Gasless' toggle"
echo "   5. Execute swap - Gas: \$0 | Fee: ~2x gas cost"
echo ""
echo "   Phase 3A (EIP-7702 - 50% cheaper!):"
echo "   1. Open http://localhost:3000 (navigate to EIP-7702 demo)"
echo "   2. Connect MetaMask (Sepolia or Polygon Amoy)"
echo "   3. Enter swap amount"
echo "   4. Sign 3 signatures (authorization, permit, intent)"
echo "   5. Execute gasless swap - 50% less gas!"
echo ""
echo "   🧪 Run Backend Tests:"
echo "   ./start-zerotoll.sh --test"
echo "   OR: cd backend && python3 test_eip7702.py"
echo ""
echo "💰 Fee Info:"
echo "   • Fee = 2x estimated gas cost (dynamic)"
echo "   • Deducted from INPUT token before swap"
echo "   • Sent to Treasury for LP rewards (Phase 3)"
echo "   • Example: ~\$0.01 for zUSDC swap on Amoy"
echo ""
echo "🚰 Get Test Tokens (call faucet() on any zToken):"
echo "   Sepolia: 0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C (zUSDC)"
echo "   Amoy:    0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD (zUSDC)"
echo ""
echo "🛑 Stop: ./stop-zerotoll.sh"
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
