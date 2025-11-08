#!/bin/bash
echo "🛑 Stopping ZeroToll services..."

# Stop backend
pkill -9 -f "uvicorn" && echo "✅ Backend stopped" || echo "⚠️  Backend not running"

# Stop frontend
pkill -9 -f "craco" && echo "✅ Frontend stopped" || echo "⚠️  Frontend not running"

# Verify ports
lsof -i :8000 2>/dev/null || echo "✅ Port 8000 free"
lsof -i :3000 2>/dev/null || echo "✅ Port 3000 free"

echo "🎉 All services stopped!"
