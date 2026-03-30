#!/bin/bash
# ============================================
# ZeroToll Phase 2 Deployment Script
# ============================================
# 
# This script deploys the self-hosted paymaster stack.
# Run from repo root: bash ./scripts/deploy/deploy-phase2.sh
#
# Prerequisites:
# 1. Set PRIVATE_KEY_DEPLOYER in .env
# 2. Set POLICY_SIGNER_ADDRESS in .env
# 3. Have testnet funds (ETH for Sepolia, POL for Amoy)
#
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo ""
echo "============================================"
echo "  ZEROTOLL PHASE 2 DEPLOYMENT"
echo "============================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "   Copy .env.example to .env and fill in your values"
    exit 1
fi

# Load .env
source .env

# Check required variables
if [ -z "$PRIVATE_KEY_DEPLOYER" ]; then
    echo "❌ PRIVATE_KEY_DEPLOYER not set in .env"
    exit 1
fi

if [ -z "$POLICY_SIGNER_ADDRESS" ]; then
    echo "❌ POLICY_SIGNER_ADDRESS not set in .env"
    echo "   This is the address that will sign UserOps for the paymaster"
    exit 1
fi

echo "Policy Signer: $POLICY_SIGNER_ADDRESS"
echo ""

# Navigate to contracts directory
cd "$REPO_ROOT/packages/contracts"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Compile contracts
echo "Compiling contracts..."
npx hardhat compile

# Deploy to Sepolia
echo ""
echo "============================================"
echo "  DEPLOYING TO SEPOLIA"
echo "============================================"
echo ""

npx hardhat run scripts/deploy-verifying-paymaster.js --network sepolia

echo ""
read -p "Enter Sepolia paymaster address: " SEPOLIA_PAYMASTER

# Deploy to Amoy
echo ""
echo "============================================"
echo "  DEPLOYING TO AMOY"
echo "============================================"
echo ""

npx hardhat run scripts/deploy-verifying-paymaster.js --network amoy

echo ""
read -p "Enter Amoy paymaster address: " AMOY_PAYMASTER

# Go back to root
cd "$REPO_ROOT"

# Update .env with paymaster addresses
echo ""
echo "Updating .env with paymaster addresses..."

# Check if variables already exist
if grep -q "SEPOLIA_VERIFYING_PAYMASTER=" .env; then
    sed -i "s/SEPOLIA_VERIFYING_PAYMASTER=.*/SEPOLIA_VERIFYING_PAYMASTER=$SEPOLIA_PAYMASTER/" .env
else
    echo "SEPOLIA_VERIFYING_PAYMASTER=$SEPOLIA_PAYMASTER" >> .env
fi

if grep -q "AMOY_VERIFYING_PAYMASTER=" .env; then
    sed -i "s/AMOY_VERIFYING_PAYMASTER=.*/AMOY_VERIFYING_PAYMASTER=$AMOY_PAYMASTER/" .env
else
    echo "AMOY_VERIFYING_PAYMASTER=$AMOY_PAYMASTER" >> .env
fi

echo "✅ .env updated"

# Summary
echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE"
echo "============================================"
echo ""
echo "Sepolia Paymaster: $SEPOLIA_PAYMASTER"
echo "Amoy Paymaster:    $AMOY_PAYMASTER"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Fund the paymasters:"
echo "   cd packages/contracts"
echo "   npx hardhat run scripts/fund-paymaster.js --network sepolia"
echo "   npx hardhat run scripts/fund-paymaster.js --network amoy"
echo ""
echo "2. Start the Infinitism bundler:"
echo "   cd archive/vendor/bundler-infinitism"
echo "   ./start-bundler.sh"
echo ""
echo "3. Preferred local runtime:"
echo "   ./start-zerotoll.sh"
echo ""
echo "4. Legacy self-hosted relayer (reference only):"
echo "   node backend/legacy/self-hosted-relayer.mjs"
echo ""
echo "5. (Optional) Start gas tank monitor:"
echo "   node backend/gas-tank-monitor.mjs"
echo ""
echo "============================================"
