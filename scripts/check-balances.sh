#!/bin/bash

# ==============================================
# ZeroToll Balance Checker
# ==============================================
# Checks ETH balance for deployer and relayer on all testnets

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}"
echo "=================================================="
echo "  ZeroToll Balance Checker"
echo "=================================================="
echo -e "${NC}"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}ERROR: .env file not found!${NC}"
    exit 1
fi

# Load environment
source .env

# Check if cast is installed (from Foundry)
if ! command -v cast &> /dev/null; then
    echo -e "${YELLOW}⚠️  'cast' not found. Installing Foundry...${NC}"
    curl -L https://foundry.paradigm.xyz | bash
    foundryup
fi

# Get addresses from private keys
echo -e "${YELLOW}Deriving addresses from private keys...${NC}"
DEPLOYER_ADDRESS=$(cast wallet address $PRIVATE_KEY_DEPLOYER)
RELAYER_ADDRESS=$(cast wallet address $RELAYER_PRIVATE_KEY)

echo "Deployer: $DEPLOYER_ADDRESS"
echo "Relayer:  $RELAYER_ADDRESS"
echo ""

# Function to check balance
check_balance() {
    local network=$1
    local rpc=$2
    local address=$3
    local name=$4
    
    echo -e "${YELLOW}Checking $name on $network...${NC}"
    
    balance=$(cast balance $address --rpc-url $rpc 2>/dev/null || echo "0")
    
    if [ "$balance" == "0" ]; then
        echo -e "  ${RED}❌ Balance: 0 ETH${NC}"
    else
        balance_eth=$(cast --to-unit $balance ether)
        echo -e "  ${GREEN}✓ Balance: $balance_eth ETH${NC}"
    fi
}

echo -e "${GREEN}=================================================="
echo "  Sepolia (Chain ID: 11155111)"
echo -e "==================================================${NC}"
check_balance "Sepolia" "$SEPOLIA_RPC_URL" "$DEPLOYER_ADDRESS" "Deployer"
check_balance "Sepolia" "$SEPOLIA_RPC_URL" "$RELAYER_ADDRESS" "Relayer"
echo ""

echo -e "${GREEN}=================================================="
echo "  Polygon Amoy (Chain ID: 80002)"
echo -e "==================================================${NC}"
check_balance "Amoy" "$AMOY_RPC_URL" "$DEPLOYER_ADDRESS" "Deployer"
check_balance "Amoy" "$AMOY_RPC_URL" "$RELAYER_ADDRESS" "Relayer"
echo ""

echo -e "${GREEN}=================================================="
echo "  Arbitrum Sepolia (Chain ID: 421614)"
echo -e "==================================================${NC}"
check_balance "Arbitrum Sepolia" "$ARBITRUM_SEPOLIA_RPC_URL" "$DEPLOYER_ADDRESS" "Deployer"
check_balance "Arbitrum Sepolia" "$ARBITRUM_SEPOLIA_RPC_URL" "$RELAYER_ADDRESS" "Relayer"
echo ""

echo -e "${GREEN}=================================================="
echo "  Optimism Sepolia (Chain ID: 11155420)"
echo -e "==================================================${NC}"
check_balance "Optimism Sepolia" "$OPTIMISM_SEPOLIA_RPC_URL" "$DEPLOYER_ADDRESS" "Deployer"
check_balance "Optimism Sepolia" "$OPTIMISM_SEPOLIA_RPC_URL" "$RELAYER_ADDRESS" "Relayer"
echo ""

echo -e "${GREEN}=================================================="
echo "  Faucet Links"
echo -e "==================================================${NC}"
echo "Sepolia:          https://sepoliafaucet.com"
echo "Amoy:             https://faucet.polygon.technology"
echo "Arbitrum Sepolia: https://faucet.arbitrum.io"
echo "Optimism Sepolia: https://app.optimism.io/faucet"
echo ""
echo "Send testnet ETH to:"
echo "  Deployer: $DEPLOYER_ADDRESS"
echo "  Relayer:  $RELAYER_ADDRESS"
