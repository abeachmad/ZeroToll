#!/bin/bash

echo "🚀 ZeroToll Test Setup"
echo "======================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env files exist
echo -e "\n${YELLOW}Checking .env files...${NC}"

if [ ! -f "frontend/.env" ]; then
    echo -e "${RED}❌ frontend/.env not found${NC}"
    echo "Creating from .env.example..."
    cp frontend/.env.example frontend/.env
    echo -e "${GREEN}✅ Created frontend/.env${NC}"
else
    echo -e "${GREEN}✅ frontend/.env exists${NC}"
fi

if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ backend/.env not found${NC}"
    echo "Creating from .env.example..."
    cp backend/.env.example backend/.env
    echo -e "${GREEN}✅ Created backend/.env${NC}"
else
    echo -e "${GREEN}✅ backend/.env exists${NC}"
fi

# Check Node.js
echo -e "\n${YELLOW}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js installed: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    exit 1
fi

# Check Python
echo -e "\n${YELLOW}Checking Python...${NC}"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python installed: $PYTHON_VERSION${NC}"
else
    echo -e "${RED}❌ Python not found. Please install Python 3.9+${NC}"
    exit 1
fi

# Install frontend dependencies
echo -e "\n${YELLOW}Installing frontend dependencies...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    yarn install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Frontend dependencies already installed${NC}"
fi
cd ..

# Install backend dependencies
echo -e "\n${YELLOW}Installing backend dependencies...${NC}"
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Backend venv already exists${NC}"
fi
cd ..

# Summary
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Edit .env files with your private keys"
echo "2. Get testnet tokens:"
echo "   - POL Amoy: https://faucet.polygon.technology/"
echo "   - ETH Sepolia: https://sepoliafaucet.com/"
echo ""
echo "3. Start services:"
echo "   Terminal 1: cd backend && python server.py"
echo "   Terminal 2: cd frontend && yarn start"
echo ""
echo "4. Open browser: http://localhost:3000"
echo ""
echo -e "${GREEN}Happy testing! 🎉${NC}"
