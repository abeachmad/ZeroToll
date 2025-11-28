#!/bin/bash

echo "📊 ZeroToll Service Status"
echo "=========================="
echo ""

# Function to check port
check_port() {
    PORT=$1
    SERVICE=$2
    if lsof -ti:$PORT > /dev/null 2>&1; then
        PID=$(lsof -ti:$PORT)
        echo "✅ $SERVICE - Running (PID: $PID, Port: $PORT)"
        return 0
    else
        echo "❌ $SERVICE - Not running (Port: $PORT)"
        return 1
    fi
}

# Function to check HTTP endpoint
check_http() {
    URL=$1
    SERVICE=$2
    if curl -s -o /dev/null -w "%{http_code}" "$URL" | grep -q "200\|404" 2>/dev/null; then
        echo "   🌐 Endpoint accessible: $URL"
        return 0
    else
        echo "   ⚠️  Endpoint not responding: $URL"
        return 1
    fi
}

# Check MongoDB
if pgrep -x mongod > /dev/null 2>&1; then
    MONGO_PID=$(pgrep -x mongod)
    echo "✅ MongoDB - Running (PID: $MONGO_PID)"
else
    echo "❌ MongoDB - Not running"
fi

echo ""

# Check Backend
if check_port 8000 "Backend"; then
    check_http "http://localhost:8000/api/" "Backend API"
fi

echo ""

# Check Bundler
if check_port 3000 "Bundler"; then
    if curl -s http://localhost:3000/rpc -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}' | grep -q "0x0000000071727De22E5E9d8BAf0edAc6f37da032" 2>/dev/null; then
        echo "   🌐 Bundler RPC accessible and working"
    else
        echo "   ⚠️  Bundler RPC not responding correctly"
    fi
fi

echo ""

# Check Frontend
if check_port 3001 "Frontend"; then
    echo "   🌐 Frontend should be accessible at: http://localhost:3001"
fi

echo ""

# Check Policy Server
if check_port 3002 "Policy Server"; then
    check_http "http://localhost:3002/api/health" "Policy Server"
fi

echo ""
echo "📄 Logs:"
echo "   Backend:       tail -f /tmp/zerotoll_backend.log"
echo "   Bundler:       tail -f /tmp/zerotoll_bundler.log"
echo "   Frontend:      tail -f /tmp/zerotoll_frontend.log"
echo "   Policy Server: tail -f /tmp/zerotoll_policy_server.log"
echo ""

# Summary
TOTAL=5
RUNNING=0

pgrep -x mongod > /dev/null && ((RUNNING++))
lsof -ti:8000 > /dev/null 2>&1 && ((RUNNING++))
lsof -ti:3000 > /dev/null 2>&1 && ((RUNNING++))
lsof -ti:3001 > /dev/null 2>&1 && ((RUNNING++))
lsof -ti:3002 > /dev/null 2>&1 && ((RUNNING++))

echo "📈 Summary: $RUNNING/$TOTAL services running"
echo ""

if [ $RUNNING -eq $TOTAL ]; then
    echo "✅ All services operational!"
elif [ $RUNNING -eq 0 ]; then
    echo "❌ No services running. Start with: ./start-zerotoll.sh"
else
    echo "⚠️  Some services not running. Restart with: ./stop-zerotoll.sh && ./start-zerotoll.sh"
fi
echo ""
