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
cd backend
nohup venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
cd ..
sleep 3

# Check backend status
if curl -s http://localhost:8000/api/ > /dev/null; then
    echo "✅ Backend is running on http://localhost:8000"
else
    echo "❌ Backend failed to start"
    exit 1
fi

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
echo "🔗 Deployed Contracts:"
echo "   • Polygon Amoy:    0xc6Dd26D3eE0F58fAb15Dc87bEe3A66896B6D4127"
echo "   • Ethereum Sepolia: 0x19091A6c655704c8fb55023635eE3298DcDf66FF"
echo ""
echo "⚠️  Currently in DEMO MODE (no real transactions)"
echo "   To enable real transactions, set RELAYER_PRIVATE_KEY in backend/.env"
echo ""
echo "📝 Logs:"
echo "   • Backend:  tail -f backend.log"
echo "   • Frontend: tail -f frontend.log"
echo "   • MongoDB:  tail -f /tmp/mongodb.log"
echo ""
echo "🧪 Test the app:"
echo "   1. Open http://localhost:3000"
echo "   2. Connect MetaMask wallet"
echo "   3. Switch to Polygon Amoy or Ethereum Sepolia"
echo "   4. Try a swap (ETH → POL or vice versa)"
echo "   5. Check transaction history"
echo ""