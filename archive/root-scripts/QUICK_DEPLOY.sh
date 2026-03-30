#!/bin/bash

echo "🚀 Quick Deploy RelayerRegistry to Testnets"
echo ""

cd packages/contracts

echo "📍 Deploying to Amoy..."
npx hardhat run scripts/deploy-relayer-registry.js --network amoy

echo ""
echo "📍 Deploying to Sepolia..."
npx hardhat run scripts/deploy-relayer-registry.js --network sepolia

echo ""
echo "✅ Deployment complete!"
echo "Check deployments/ folder for addresses"
