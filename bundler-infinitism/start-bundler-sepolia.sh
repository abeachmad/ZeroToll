#!/bin/bash

# ZeroToll Bundler - Sepolia
# Runs Infinitism bundler for Sepolia testnet

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=== ZEROTOLL BUNDLER - SEPOLIA ==="
echo "Network: Sepolia Testnet (Chain ID: 11155111)"
echo "EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032"
echo "Beneficiary: 0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A"
echo "Port: 3000"
echo ""

# Use bundler.key file
if [ ! -f "bundler.key" ]; then
    echo "❌ ERROR: bundler.key file not found"
    exit 1
fi

BUNDLER_KEY=$(cat bundler.key | tr -d '\n')
echo "✅ Bundler key loaded"
echo ""

# Run bundler
echo "Starting bundler..."
yarn run bundler \
  --network https://ethereum-sepolia-rpc.publicnode.com \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --beneficiary 0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A \
  --minBalance 0.05 \
  --maxBundleGas 5000000 \
  --auto \
  --autoBundleInterval 3000 \
  --privateKey $BUNDLER_KEY \
  --unsafe \
  --port 3000
