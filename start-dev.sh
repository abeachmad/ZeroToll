#!/bin/bash

echo "🚀 Starting ZeroToll Development Services"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to cleanup on exit
cleanup() {
    echo -e "\n🛑 Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Check and setup backend venv
echo -e "${YELLOW}📦 Checking backend setup...${NC}"
if [ ! -d "backend/venv" ]; then
    echo "Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing Python dependencies..."
    pip install -r requirements.txt
    cd ..
    echo -e "${GREEN}✅ Backend setup complete${NC}"
else
    echo -e "${GREEN}✅ Backend venv exists${NC}"
fi

# Check frontend dependencies
echo -e "${YELLOW}📦 Checking frontend setup...${NC}"
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    yarn install
    cd ..
    echo -e "${GREEN}✅ Frontend setup complete${NC}"
else
    echo -e "${GREEN}✅ Frontend dependencies exist${NC}"
fi

# Start backend
echo ""
echo -e "${YELLOW}📦 Starting Backend...${NC}"
cd backend
# Load environment variables from .env
set -a
source .env 2>/dev/null
set +a
./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
cd ..

# Wait for backend to start
echo "Waiting for backend to initialize..."
sleep 5

# Check if backend is running
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend failed to start. Check backend.log${NC}"
    tail -20 backend.log
    exit 1
fi

# Start frontend
echo ""
echo -e "${YELLOW}📦 Starting Frontend...${NC}"
cd frontend
BROWSER=none yarn start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ..

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Services Running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Logs:"
echo "  Backend:  tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Wait for processes
wait
