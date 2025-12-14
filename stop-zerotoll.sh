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
            # Kill the process group
            kill -TERM -"$pid" 2>/dev/null
            sleep 1
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
        echo "🛑 Killing processes on port $port ($name)..."
        echo "$pids" | xargs -r kill -9 2>/dev/null
        echo "   ✅ Port $port cleared"
    fi
}

# Kill tmux sessions first
echo "📋 Stopping tmux sessions..."
tmux kill-session -t zerotoll 2>/dev/null && echo "   ✅ zerotoll session killed" || echo "   ℹ️  zerotoll session not found"
tmux kill-session -t frontend 2>/dev/null && echo "   ✅ frontend session killed" || echo "   ℹ️  frontend session not found"

echo ""
echo "📋 Stopping services by PID..."
stop_service "backend"
stop_service "gasless"
stop_service "delegation"
stop_service "frontend"
stop_service "relayer"

echo ""
echo "🔍 Killing processes by port..."
kill_port 8000 "Python Backend"
kill_port 3001 "Pimlico Relayer"
kill_port 3002 "Gasless API"
kill_port 3003 "Delegation API"
kill_port 3004 "Relay API"
kill_port 3000 "Frontend"

echo ""
echo "🧹 Cleaning up remaining processes..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "node.*relayer" 2>/dev/null
pkill -f "node gasless_api.mjs" 2>/dev/null
pkill -f "node delegation-gasless-api.mjs" 2>/dev/null
pkill -f "node gasless-relay-api.mjs" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "craco start" 2>/dev/null
pkill -f "node.*frontend" 2>/dev/null
pkill -f "node.*react" 2>/dev/null
pkill -f "pimlico-v3-relayer" 2>/dev/null
pkill -f "pimlico-relayer" 2>/dev/null
pkill -f "pimlico-v2-relayer" 2>/dev/null

# Force kill ports if still in use
sleep 1
echo ""
echo "🔍 Force killing any remaining port usage..."

for port in 8000 3000 3001 3002 3003 3004; do
    fuser -k $port/tcp 2>/dev/null
done

sleep 1

# Final verification
echo ""
echo "🔍 Verifying ports are free..."
all_clear=true
for port in 8000 3000 3001 3002 3003 3004; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "❌ Port $port still in use!"
        all_clear=false
    else
        echo "✅ Port $port free"
    fi
done

echo ""
echo "============================================"
if [ "$all_clear" = true ]; then
    echo "✅ ZeroToll stopped successfully!"
else
    echo "⚠️  Some ports may still be in use"
    echo "   Try: sudo fuser -k 8000/tcp 3000/tcp 3001/tcp 3002/tcp 3003/tcp 3004/tcp"
fi
echo "============================================"
echo ""
echo "📄 Logs preserved in: $SCRIPT_DIR/.pids/"
echo "🚀 Restart: ./start-zerotoll.sh"
echo ""
echo "📋 Current Contract Addresses:"
echo "   Sepolia Router: 0x577560699EF88e99f15d04df57c9552056d2a10D"
echo "   Amoy Router:    0xc75df1943d6EFE04b422b9bB45509782609Fc67a"
echo ""
