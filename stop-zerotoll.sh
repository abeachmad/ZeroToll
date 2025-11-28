#!/bin/bash

echo "🛑 Stopping ZeroToll Complete Stack"
echo "===================================="
echo ""

# Function to kill process by port
kill_port() {
    PORT=$1
    SERVICE=$2
    PIDS=$(lsof -ti:$PORT 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "🛑 Stopping $SERVICE (port $PORT)..."
        echo "$PIDS" | xargs -r kill -9 2>/dev/null
        echo "   ✅ $SERVICE stopped"
    else
        echo "   ℹ️  $SERVICE not running (port $PORT)"
    fi
}

# Function to kill process by name
kill_process() {
    PATTERN=$1
    SERVICE=$2
    if pkill -f "$PATTERN" 2>/dev/null; then
        echo "🛑 Stopping $SERVICE..."
        echo "   ✅ $SERVICE stopped"
    else
        echo "   ℹ️  $SERVICE not running"
    fi
}

# Stop services by port
kill_port 8000 "Backend"
kill_port 3000 "Bundler"
kill_port 3001 "Frontend"
kill_port 3002 "Policy Server"

# Stop services by process name (fallback)
kill_process "uvicorn server:app" "Backend (by name)"
kill_process "node server.js" "Policy Server (by name)"
kill_process "pnpm.*bundler" "Bundler (by name)"
kill_process "npm start" "Frontend (by name)"

# Optional: Stop MongoDB (prompt user)
echo ""
if pgrep -x mongod > /dev/null 2>&1; then
    read -p "Stop MongoDB? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo pkill -9 mongod && echo "   ✅ MongoDB stopped"
    else
        echo "   ℹ️  MongoDB left running"
    fi
else
    echo "   ℹ️  MongoDB not running"
fi

echo ""
echo "✅ All ZeroToll services stopped!"
echo ""
echo "📝 Cleanup:"
echo "   Logs are preserved in /tmp/zerotoll_*.log"
echo "   To view logs: tail -f /tmp/zerotoll_*.log"
echo ""
echo "🚀 To restart: ./start-zerotoll.sh"
echo ""
