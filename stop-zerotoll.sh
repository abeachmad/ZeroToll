#!/bin/bash

echo "🛑 Stopping ZeroToll"
echo "===================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to stop service by PID file
stop_service() {
    local name=$1
    local pidfile="$SCRIPT_DIR/.pids/${name}.pid"
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            echo "🛑 Stopping $name (PID: $pid)..."
            kill -9 "$pid" 2>/dev/null
            # Also kill child processes
            pkill -P "$pid" 2>/dev/null
            echo "   ✅ $name stopped"
        else
            echo "   ℹ️  $name not running (stale PID)"
        fi
        rm -f "$pidfile"
    else
        echo "   ℹ️  $name PID file not found"
    fi
}

# Function to kill by port
kill_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "🛑 Stopping $name on port $port..."
        echo "$pids" | xargs -r kill -9 2>/dev/null
        echo "   ✅ $name stopped"
    fi
}

# Stop by PID files
stop_service "backend"
stop_service "frontend"

# Fallback: kill by port
kill_port 8000 "Backend"
kill_port 3000 "Frontend"

# Fallback: kill by process name
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "craco start" 2>/dev/null
pkill -f "node.*frontend" 2>/dev/null

echo ""
echo "✅ ZeroToll stopped!"
echo ""
echo "📄 Logs preserved in: $SCRIPT_DIR/.pids/"
echo "🚀 Restart: ./start-zerotoll.sh"
echo ""
