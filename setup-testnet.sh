#!/bin/bash

echo "🚀 ZeroToll Testnet Setup"
echo "========================="

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "📦 Starting MongoDB..."
    sudo -u mongodb mongod --dbpath /data/db --logpath /tmp/mongodb.log --fork
    sleep 2
fi

# Check MongoDB status
if pgrep -x "mongod" > /dev/null; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB failed to start"
    exit 1
fi

# Install backend dependencies if needed
if [ ! -f "backend/venv/lib/python3.12/site-packages/web3/__init__.py" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    venv/bin/pip install web3==6.15.1 eth-account==0.10.0
    cd ..
fi

# Start backend
echo "🔧 Starting backend..."
pkill -f "uvicorn server:app" 2>/dev/null
sleep 1
cd backend
nohup /home/abeachmad/ZeroToll/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 5

# Check backend status
for i in {1..10}; do
    if curl -s http://localhost:8000/api/ > /dev/null 2>&1; then
        echo "✅ Backend is running on http://localhost:8000"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Backend failed to start - check backend.log"
        exit 1
    fi
    sleep 1
done

# Start frontend
echo "🎨 Starting frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    yarn install
fi

# Start frontend in background
nohup yarn start > ../frontend.log 2>&1 &
cd ..

echo ""
echo "🎉 ZeroToll is starting up!"
echo ""
echo "📊 Services:"
echo "   • Backend:  http://localhost:8000"
echo "   • Frontend: http://localhost:3000 (starting...)"
echo "   • MongoDB:  localhost:27017"
echo ""
echo "🔗 Supported Networks:"
echo "   • Polygon Amoy (80002)"
echo "   • Ethereum Sepolia (11155111)"
echo "   • Arbitrum Sepolia (421614)"
echo "   • Optimism Sepolia (11155420)"
echo ""
if grep -q "RELAYER_PRIVATE_KEY=0x" backend/.env 2>/dev/null; then
    echo "✅ REAL TRANSACTION MODE ENABLED"
    echo "   Relayer: 0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A"
else
    echo "⚠️  DEMO MODE - Set RELAYER_PRIVATE_KEY in backend/.env for real transactions"
fi
echo ""
echo "📝 Logs:"
echo "   • Backend:  tail -f backend.log"
echo "   • Frontend: tail -f frontend.log"
echo "   • MongoDB:  tail -f /tmp/mongodb.log"
echo ""
echo "🧪 Test the app:"
echo "   1. Open http://localhost:3000"
echo "   2. Connect MetaMask wallet"
echo "   3. Switch to any supported testnet"
echo "   4. Get testnet tokens from faucets"
echo "   5. Try a swap (ETH, POL, LINK, ARB, or OP)"
echo "   6. Verify transaction on block explorer"
echo ""