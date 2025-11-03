#!/bin/bash

echo "🚀 Starting ZeroToll Development Environment"
echo "============================================"
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB not running. Starting MongoDB..."
    sudo systemctl start mongod 2>/dev/null || mongod --fork --logpath /var/log/mongodb.log 2>/dev/null
    sleep 2
fi

# Start Backend
echo "📦 Starting Backend (FastAPI)..."
cd /home/abeachmad/ZeroToll/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Backend URL: http://localhost:8000"

# Wait for backend to start
sleep 3

# Start Frontend
echo ""
echo "🎨 Starting Frontend (React)..."
cd /home/abeachmad/ZeroToll/frontend
BROWSER=none yarn start &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Frontend URL: http://localhost:3000"

echo ""
echo "✅ Development servers started!"
echo ""
echo "📝 Access the app:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000/api"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "🛑 To stop servers:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo "   or press Ctrl+C"
echo ""

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait
