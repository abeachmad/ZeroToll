#!/bin/bash

echo "🛑 Stopping ZeroToll (EIP-7702 Implementation)"
echo "==========================================="
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
            kill -TERM -"$pid" 2>/dev/null
            sleep 1
            kill -9 "$pid" 2>/dev/null
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
stop_service "delegation"
stop_service "frontend"
stop_service "relayer"

echo ""
echo "🔍 Killing processes by port..."
kill_port 8000 "Python Backend"
kill_port 3002 "ZeroToll Relayer"
kill_port 3003 "Delegation API"
kill_port 3000 "Frontend"

echo ""
echo "🧹 Cleaning up remaining processes..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "node.*relayer" 2>/dev/null
pkill -f "node phase2-relayer.mjs" 2>/dev/null
pkill -f "node delegation-gasless-api.mjs" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "craco start" 2>/dev/null
pkill -f "node.*frontend" 2>/dev/null
pkill -f "node.*react" 2>/dev/null

# Stop MongoDB (optional - keeps data for next start)
echo ""
echo "🗄️  Stopping MongoDB..."
if pgrep -x mongod > /dev/null 2>&1; then
    # Graceful shutdown
    mongod --shutdown --dbpath "$HOME/mongodb-data" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   ✅ MongoDB stopped gracefully"
    else
        # Force kill if graceful shutdown fails
        pkill -x mongod 2>/dev/null
        echo "   ✅ MongoDB stopped (forced)"
    fi
else
    echo "   ℹ️  MongoDB not running"
fi

# Force kill ports if still in use
sleep 1
echo ""
echo "🔍 Force killing any remaining port usage..."

for port in 8000 3000 3002 3003; do
    fuser -k $port/tcp 2>/dev/null
done

sleep 1

# Final verification
echo ""
echo "🔍 Verifying ports are free..."
all_clear=true
for port in 8000 3000 3002 3003; do
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
    echo "   Try: sudo fuser -k 3000/tcp 3002/tcp"
fi
echo "============================================"
echo ""
echo "📄 Logs preserved in: $SCRIPT_DIR/.pids/"
echo "🚀 Restart: ./start-zerotoll.sh"
echo ""
echo "💡 EIP-7702 Info:"
echo "   • Delegate (Sepolia): 0xcFE005B2E0013e0FF8cB0569d9b103094d423B36"
echo "   • Delegate (Amoy):    0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
echo "   • Relayer:            0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A"
echo "   • Gas Savings:        50% vs ERC-4337"
echo "   • Transaction Type:   0x04 (EIP-7702)"
echo ""
