#!/bin/bash

echo "🚀 Starting ZeroToll Multi-Testnet DApp"
echo "========================================"
echo ""

# Kill existing processes
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "yarn start" 2>/dev/null
sleep 2

# Start MongoDB if not running
if ! pgrep -x "mongod" > /dev/null; then
    echo "📦 Starting MongoDB..."
    # Remove stale lock file if exists
    if [ -f /data/db/mongod.lock ]; then
        echo "   Removing stale lock file..."
        sudo rm -f /data/db/mongod.lock
    fi
    # Start MongoDB
    sudo mongod --dbpath /data/db --logpath /tmp/mongodb.log --bind_ip 127.0.0.1 --fork > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✅ MongoDB started successfully"
    else
        echo "   ⚠️  MongoDB failed to start (check /tmp/mongodb.log)"
    fi
    sleep 2
else
    echo "✅ MongoDB already running"
fi

# Start Backend
echo "🔧 Starting Backend..."
cd /home/abeachmad/ZeroToll/backend
# Load environment variables from .env
set -a
source .env 2>/dev/null
set +a
/home/abeachmad/ZeroToll/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 > /tmp/zerotoll_backend.log 2>&1 &
cd ..

# Wait for backend
echo "⏳ Waiting for backend..."
for i in {1..15}; do
    if curl -s http://localhost:8000/api/ > /dev/null 2>&1; then
        echo "✅ Backend ready at http://localhost:8000"
        break
    fi
    sleep 1
done

# Start Frontend
echo "🎨 Starting Frontend..."
cd /home/abeachmad/ZeroToll/frontend
yarn start > /tmp/zerotoll_frontend.log 2>&1 &
cd ..

echo ""
echo "✅ ZeroToll is starting!"
echo ""
echo "📊 Services:"
echo "   • Backend:  http://localhost:8000"
echo "   • Frontend: http://localhost:3000 (starting...)"
echo ""
echo "🌐 Supported Networks:"
echo "   • Ethereum Sepolia (11155111)"
echo "   • Polygon Amoy (80002)"
echo "   • Arbitrum Sepolia (421614)"
echo "   • Optimism Sepolia (11155420)"
echo ""
echo "💰 Supported Tokens:"
echo "   • ETH, POL, LINK"
echo ""
echo "📝 Logs:"
echo "   • Backend:  tail -f /tmp/zerotoll_backend.log"
echo "   • Frontend: tail -f /tmp/zerotoll_frontend.log"
echo ""
echo "🧪 Testing:"
echo "   1. Open http://localhost:3000"
echo "   2. Connect wallet (MetaMask)"
echo "   3. Get testnet tokens from faucets"
echo "   4. Try native token transfers"
echo "   5. Verify on block explorers"
echo ""
