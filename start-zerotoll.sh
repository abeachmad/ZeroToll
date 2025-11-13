#!/bin/bash

echo "🚀 Starting ZeroToll Complete Stack"
echo "===================================="
echo ""

# Kill existing processes on ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:8000 2>/dev/null | xargs -r kill -9 2>/dev/null  # Backend
lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null  # Frontend/Bundler
lsof -ti:3001 2>/dev/null | xargs -r kill -9 2>/dev/null  # Bundler RPC
lsof -ti:3002 2>/dev/null | xargs -r kill -9 2>/dev/null  # Policy Server
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "yarn start" 2>/dev/null
pkill -f "node server.js" 2>/dev/null
pkill -f "pnpm.*bundler" 2>/dev/null
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

# Start Policy Server
echo "🔐 Starting Policy Server..."
cd /home/abeachmad/ZeroToll/backend/policy-server
nohup node server.js > /tmp/zerotoll_policy_server.log 2>&1 &
POLICY_PID=$!
cd /home/abeachmad/ZeroToll

echo "⏳ Waiting for policy server..."
for i in {1..10}; do
    if curl -s http://localhost:3002/api/health > /dev/null 2>&1; then
        echo "✅ Policy Server ready (PID: $POLICY_PID)"
        break
    fi
    sleep 1
done

# Start Bundler
echo "📦 Starting Bundler (Infinitism)..."
cd /home/abeachmad/ZeroToll/bundler-infinitism/packages/bundler
nohup yarn bundler --config ./localconfig/bundler.amoy.config.json > /tmp/zerotoll_bundler.log 2>&1 &
BUNDLER_PID=$!
cd /home/abeachmad/ZeroToll

echo "⏳ Waiting for bundler..."
for i in {1..15}; do
    if curl -s http://localhost:3000/rpc -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}' | grep -q "0x0000000071727De22E5E9d8BAf0edAc6f37da032" 2>/dev/null; then
        echo "✅ Bundler ready (PID: $BUNDLER_PID)"
        break
    fi
    sleep 1
done

# Start frontend (on port 3001 to avoid conflict with bundler)
echo "🎨 Starting Frontend..."
cd /home/abeachmad/ZeroToll/frontend
PORT=3001 nohup npm start > /tmp/zerotoll_frontend.log 2>&1 &
FRONTEND_PID=$!
cd /home/abeachmad/ZeroToll

echo ""
echo "✅ ZeroToll Complete Stack is Running!"
echo ""
echo "📊 Services:"
echo "   • Backend:        http://localhost:8000 ✅"
echo "   • Frontend:       http://localhost:3001 (compiling...)"
echo "   • Bundler:        http://localhost:3000/rpc ✅"
echo "   • Policy Server:  http://localhost:3002 ✅"
echo "   • MongoDB:        localhost:27017 ✅"
echo ""
echo "📝 Process IDs:"
echo "   • Backend:        $BACKEND_PID"
echo "   • Frontend:       $FRONTEND_PID"
echo "   • Bundler:        $BUNDLER_PID"
echo "   • Policy Server:  $POLICY_PID"
echo ""
echo "📄 Logs:"
echo "   • Backend:        tail -f /tmp/zerotoll_backend.log"
echo "   • Frontend:       tail -f /tmp/zerotoll_frontend.log"
echo "   • Bundler:        tail -f /tmp/zerotoll_bundler.log"
echo "   • Policy Server:  tail -f /tmp/zerotoll_policy_server.log"
echo ""
echo "🛑 To stop all services: ./stop-zerotoll.sh"
echo ""
echo ""
echo "📝 Logs: tail -f /tmp/zerotoll_backend.log"
echo "🛑 Stop: ./stop-zerotoll.sh"
echo ""
