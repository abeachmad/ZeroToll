#!/bin/bash

echo "🚀 Starting ZeroToll Multi-Testnet DApp"
echo "========================================"
echo ""

# Kill existing processes on ports
lsof -ti:8000 2>/dev/null | xargs -r kill -9 2>/dev/null
lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "yarn start" 2>/dev/null
sleep 2

echo "✅ Ports cleared"

# Start MongoDB if needed
if ! pgrep -x mongod > /dev/null 2>&1; then
    echo "🔧 Starting MongoDB..."
    sudo mongod --dbpath /data/db --logpath /tmp/mongodb.log --bind_ip 127.0.0.1 --fork > /dev/null 2>&1
    sleep 2
    echo "✅ MongoDB started"
else
    echo "✅ MongoDB already running"
fi

# Start backend
echo "🔧 Starting Backend..."
cd /home/abeachmad/ZeroToll/backend
source venv/bin/activate
set -a
source .env
set +a
nohup uvicorn server:app --host 0.0.0.0 --port 8000 --reload > /tmp/zerotoll_backend.log 2>&1 &
BACKEND_PID=$!
cd /home/abeachmad/ZeroToll

echo "⏳ Waiting for backend..."
for i in {1..15}; do
    if curl -s http://localhost:8000/api/ > /dev/null 2>&1; then
        echo "✅ Backend ready (PID: $BACKEND_PID)"
        break
    fi
    sleep 1
done

# Start frontend
echo "🎨 Starting Frontend..."
cd /home/abeachmad/ZeroToll/frontend
nohup yarn start > /tmp/zerotoll_frontend.log 2>&1 &
FRONTEND_PID=$!
cd /home/abeachmad/ZeroToll

echo ""
echo "✅ ZeroToll is running!"
echo ""
echo "📊 Services:"
echo "   • Backend:  http://localhost:8000 ✅"
echo "   • Frontend: http://localhost:3000 (compiling...)"
echo ""
echo "📝 Logs: tail -f /tmp/zerotoll_backend.log"
echo "🛑 Stop: ./stop-zerotoll.sh"
echo ""
