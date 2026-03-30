#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
    check_http "http://localhost:8000/api/eip7702/info" "Backend EIP-7702 API"
fi

echo ""

# Check Relayer
if check_port 3002 "ZeroToll Relayer"; then
    check_http "http://localhost:3002/health" "ZeroToll Relayer"
fi

echo ""

# Check Frontend
if check_port 3000 "Frontend"; then
    echo "   🌐 Frontend should be accessible at: http://localhost:3000"
fi

echo ""

# Check Delegation API
if check_port 3003 "Delegation API"; then
    check_http "http://localhost:3003/api/delegation/delegate-info" "Delegation API"
fi

echo ""
echo "📄 Logs:"
echo "   Backend:       tail -f $SCRIPT_DIR/.pids/backend.log"
echo "   Relayer:       tail -f $SCRIPT_DIR/.pids/relayer.log"
echo "   Delegation:    tail -f $SCRIPT_DIR/.pids/delegation.log"
echo "   Frontend:      tail -f $SCRIPT_DIR/.pids/frontend.log"
echo ""

# Summary
TOTAL=5
RUNNING=0

pgrep -x mongod > /dev/null && ((RUNNING++))
lsof -ti:8000 > /dev/null 2>&1 && ((RUNNING++))
lsof -ti:3002 > /dev/null 2>&1 && ((RUNNING++))
lsof -ti:3003 > /dev/null 2>&1 && ((RUNNING++))
lsof -ti:3000 > /dev/null 2>&1 && ((RUNNING++))

echo "📈 Summary: $RUNNING/$TOTAL services running"
echo ""

if [ $RUNNING -eq $TOTAL ]; then
    echo "✅ All services operational!"
elif [ $RUNNING -eq 0 ]; then
    echo "❌ No services running. Start with: bash ./start-zerotoll.sh"
else
    echo "⚠️  Some services not running. Restart with: bash ./stop-zerotoll.sh && bash ./start-zerotoll.sh"
fi
echo "ℹ️  Legacy policy-server/bundler utilities are not included in this status check."
echo ""
