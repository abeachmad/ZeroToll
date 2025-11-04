#!/bin/bash

echo "🚀 ZeroToll Deployment Setup"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Creating from .env.example..."
    cp .env.example .env
fi

echo -e "${YELLOW}📝 Setup Private Key${NC}"
echo ""
echo "⚠️  IMPORTANT: Use TESTNET wallet only!"
echo "⚠️  DO NOT use wallet with real funds!"
echo ""
echo "How to get private key from MetaMask:"
echo "1. Open MetaMask"
echo "2. Click 3 dots → Account Details"
echo "3. Click 'Show Private Key'"
echo "4. Enter MetaMask password"
echo "5. Copy private key (format: 0x...)"
echo ""

read -p "Enter your private key (or press Enter to skip): " PRIVATE_KEY

if [ ! -z "$PRIVATE_KEY" ]; then
    # Update .env file
    sed -i "s/PRIVATE_KEY_DEPLOYER=.*/PRIVATE_KEY_DEPLOYER=$PRIVATE_KEY/" .env
    sed -i "s/PRIVATE_KEY_RELAYER=.*/PRIVATE_KEY_RELAYER=$PRIVATE_KEY/" .env
    echo -e "${GREEN}✅ Private key saved to .env${NC}"
else
    echo -e "${YELLOW}⚠️  Skipped. Edit .env manually:${NC}"
    echo "   nano .env"
    echo ""
    exit 0
fi

echo ""
read -p "Enter your wallet address for treasury (or press Enter to skip): " TREASURY

if [ ! -z "$TREASURY" ]; then
    sed -i "s/TREASURY_ADDRESS=.*/TREASURY_ADDRESS=$TREASURY/" .env
    echo -e "${GREEN}✅ Treasury address saved${NC}"
fi

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Get testnet tokens:"
echo "   - POL Amoy: https://faucet.polygon.technology/"
echo "   - ETH Sepolia: https://sepoliafaucet.com/"
echo ""
echo "2. Install dependencies:"
echo "   yarn install"
echo ""
echo "3. Deploy contracts:"
echo "   yarn hardhat run scripts/quickDeploy.js --network amoy"
echo "   yarn hardhat run scripts/quickDeploy.js --network sepolia"
