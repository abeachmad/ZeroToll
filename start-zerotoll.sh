#!/bin/bash

echo "🚀 Starting ZeroToll"
echo "===================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Kill existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "uvicorn server:app" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null
pkill -f "craco start" 2>/dev/null
fuser -k 8000/tcp 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 2
echo "✅ Ports cleared"

# Create log directory
mkdir -p "$SCRIPT_DIR/.pids"
rm -f "$SCRIPT_DIR/.pids"/*.log 2>/dev/null

# Fix line endings
sed -i 's/\r$//' "$SCRIPT_DIR/backend/.env" 2>/dev/null

# Start Backend
echo ""
echo "🔧 Starting Backend..."
cd "$SCRIPT_DIR/backend"
setsid "$SCRIPT_DIR/backend/venv/bin/python" -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload > "$SCRIPT_DIR/.pids/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$SCRIPT_DIR/.pids/backend.pid"

# Wait for backend
echo "⏳ Waiting for backend..."
for i in {1..20}; do
    if curl -s http://localhost:8000/api/ > /dev/null 2>&1; then
        echo "✅ Backend ready (PID: $BACKEND_PID)"
        break
    fi
    [ $i -eq 20 ] && echo "⚠️  Backend may still be starting..."
    sleep 1
done

# Start Frontend
echo ""
echo "🎨 Starting Frontend..."
cd "$SCRIPT_DIR/frontend"
setsid npm start > "$SCRIPT_DIR/.pids/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$SCRIPT_DIR/.pids/frontend.pid"

# Wait a bit for frontend to start
sleep 5

echo ""
echo "============================================"
echo "✅ ZeroToll Started!"
echo "============================================"
echo ""
echo "📊 Services:"
echo "   • Backend:   http://localhost:8000"
echo "   • Frontend:  http://localhost:3000 (compiling ~60s)"
echo ""
echo "�  Logs:"
echo "   tail -f $SCRIPT_DIR/.pids/backend.log"
echo "   tail -f $SCRIPT_DIR/.pids/frontend.log"
echo ""
echo "🌐 Open http://localhost:3000 after ~60 seconds"
echo "🛑 Stop: ./stop-zerotoll.sh"
echo ""
