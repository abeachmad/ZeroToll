#!/bin/bash

echo "🔐 ZeroToll Environment Setup"
echo "=============================="
echo ""
echo "⚠️  IMPORTANT: Use TESTNET wallet only!"
echo "   DO NOT use private key from your main wallet."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to validate private key
validate_private_key() {
    local key=$1
    # Remove 0x prefix if exists
    key=${key#0x}
    
    # Check if 64 characters hex
    if [[ ${#key} -eq 64 ]] && [[ $key =~ ^[0-9a-fA-F]+$ ]]; then
        echo "$key"
        return 0
    else
        return 1
    fi
}

# Setup backend .env
echo -e "${YELLOW}Setting up backend/.env...${NC}"
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✅ backend/.env already exists${NC}"
    read -p "Do you want to update RELAYER_PRIVATE_KEY? (y/n): " update_backend
    
    if [ "$update_backend" = "y" ]; then
        echo ""
        echo "Enter your TESTNET private key (64 characters, with or without 0x):"
        read -s private_key
        
        validated_key=$(validate_private_key "$private_key")
        if [ $? -eq 0 ]; then
            # Update private key in .env
            if grep -q "RELAYER_PRIVATE_KEY=" backend/.env; then
                sed -i "s/RELAYER_PRIVATE_KEY=.*/RELAYER_PRIVATE_KEY=$validated_key/" backend/.env
                echo -e "${GREEN}✅ Private key updated in backend/.env${NC}"
            else
                echo "RELAYER_PRIVATE_KEY=$validated_key" >> backend/.env
                echo -e "${GREEN}✅ Private key added to backend/.env${NC}"
            fi
        else
            echo -e "${RED}❌ Invalid private key format!${NC}"
            echo "Private key must be 64 hexadecimal characters (with or without 0x prefix)"
            exit 1
        fi
    fi
else
    echo -e "${RED}❌ backend/.env not found${NC}"
    echo "Creating from .env.example..."
    cp backend/.env.example backend/.env
    
    echo ""
    echo "Enter your TESTNET private key (64 characters, with or without 0x):"
    read -s private_key
    
    validated_key=$(validate_private_key "$private_key")
    if [ $? -eq 0 ]; then
        sed -i "s/RELAYER_PRIVATE_KEY=.*/RELAYER_PRIVATE_KEY=$validated_key/" backend/.env
        echo -e "${GREEN}✅ backend/.env created with private key${NC}"
    else
        echo -e "${RED}❌ Invalid private key format!${NC}"
        exit 1
    fi
fi

# Setup frontend .env
echo ""
echo -e "${YELLOW}Setting up frontend/.env...${NC}"
if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✅ frontend/.env already exists${NC}"
else
    cp frontend/.env.example frontend/.env
    echo -e "${GREEN}✅ frontend/.env created${NC}"
fi

# Check MongoDB
echo ""
echo -e "${YELLOW}Checking MongoDB...${NC}"
if systemctl is-active --quiet mongodb; then
    echo -e "${GREEN}✅ MongoDB is running${NC}"
elif systemctl is-active --quiet mongod; then
    echo -e "${GREEN}✅ MongoDB is running${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB is not running${NC}"
    echo "Starting MongoDB..."
    sudo systemctl start mongodb 2>/dev/null || sudo systemctl start mongod 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ MongoDB started${NC}"
    else
        echo -e "${RED}❌ Failed to start MongoDB${NC}"
        echo "Please install MongoDB: sudo apt install mongodb"
    fi
fi

# Summary
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Environment Setup Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Get testnet tokens:"
echo "   - POL Amoy: https://faucet.polygon.technology/"
echo "   - ETH Sepolia: https://sepoliafaucet.com/"
echo ""
echo "2. Start services:"
echo "   Terminal 1: cd backend && python3 server.py"
echo "   Terminal 2: cd frontend && yarn start"
echo ""
echo "3. Open browser: http://localhost:3000"
echo ""
echo -e "${GREEN}Happy testing! 🎉${NC}"
