#!/bin/bash

echo "Stopping ZeroToll"
echo "================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

stop_service() {
    local name="$1"
    local pidfile="$SCRIPT_DIR/.pids/${name}.pid"

    if [ ! -f "$pidfile" ]; then
        echo "  - $name PID file not found"
        return
    fi

    local pid
    pid=$(cat "$pidfile")

    if kill -0 "$pid" 2>/dev/null; then
        echo "  - Stopping $name (PID: $pid)"
        kill -TERM -"$pid" 2>/dev/null || true
        sleep 1
        kill -9 "$pid" 2>/dev/null || true
        pkill -P "$pid" 2>/dev/null || true
    else
        echo "  - $name not running (stale PID)"
    fi

    rm -f "$pidfile"
}

kill_port() {
    local port="$1"
    local name="$2"
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)

    if [ -n "$pids" ]; then
        echo "  - Clearing port $port ($name)"
        echo "$pids" | xargs -r kill -9 2>/dev/null || true
    fi
}

echo "Stopping tmux sessions..."
tmux kill-session -t zerotoll 2>/dev/null && echo "  - zerotoll session killed" || echo "  - zerotoll session not found"
tmux kill-session -t frontend 2>/dev/null && echo "  - frontend session killed" || echo "  - frontend session not found"

echo ""
echo "Stopping services by PID..."
stop_service "backend"
stop_service "delegation"
stop_service "frontend"
stop_service "relayer"

echo ""
echo "Clearing service ports..."
kill_port 8000 "Python Backend"
kill_port 3002 "ZeroToll Relayer"
kill_port 3003 "Delegation API"
kill_port 3000 "Frontend"

echo ""
echo "Cleaning remaining processes..."
pkill -f "uvicorn server:app" 2>/dev/null || true
pkill -f "node.*relayer" 2>/dev/null || true
pkill -f "node phase2-relayer.mjs" 2>/dev/null || true
pkill -f "node delegation-gasless-api.mjs" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
pkill -f "craco start" 2>/dev/null || true
pkill -f "node.*frontend" 2>/dev/null || true
pkill -f "node.*react" 2>/dev/null || true

echo ""
echo "Stopping MongoDB..."
if pgrep -x mongod >/dev/null 2>&1; then
    mongod --shutdown --dbpath "$HOME/mongodb-data" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "  - MongoDB stopped gracefully"
    else
        pkill -x mongod 2>/dev/null || true
        echo "  - MongoDB stopped (forced)"
    fi
else
    echo "  - MongoDB not running"
fi

sleep 1

echo ""
echo "Force-clearing any remaining port usage..."
for port in 8000 3000 3002 3003; do
    fuser -k "$port"/tcp 2>/dev/null || true
done

sleep 1

echo ""
echo "Verifying ports are free..."
all_clear=true
for port in 8000 3000 3002 3003; do
    if lsof -ti:"$port" >/dev/null 2>&1; then
        echo "  - Port $port still in use"
        all_clear=false
    else
        echo "  - Port $port free"
    fi
done

echo ""
echo "============================"
if [ "$all_clear" = true ]; then
    echo "ZeroToll stopped successfully"
else
    echo "Some ports may still be in use"
    echo "Try: sudo fuser -k 3000/tcp 3002/tcp 3003/tcp 8000/tcp"
fi
echo "============================"
echo ""
echo "Logs preserved in: $SCRIPT_DIR/.pids/"
echo "Restart with: bash ./start-zerotoll.sh"
