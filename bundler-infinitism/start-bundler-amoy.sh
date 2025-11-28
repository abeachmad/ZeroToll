#!/bin/bash

# ZeroToll Bundler Startup Script
# Runs Infinitism bundler for Amoy testnet

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=== ZEROTOLL BUNDLER STARTUP ==="
echo "Network: Amoy Testnet"
echo "EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032"
echo "Port: 3000"
echo ""

# Check if private key is set
if [ -z "$BUNDLER_PRIVATE_KEY" ]; then
    echo "❌ ERROR: BUNDLER_PRIVATE_KEY environment variable not set"
    echo ""
    echo "Usage:"
    echo "  export BUNDLER_PRIVATE_KEY=0x..."
    echo "  ./start-bundler-amoy.sh"
    exit 1
fi

echo "✅ Private key configured"
echo ""

# Run bundler
echo "Starting bundler..."
yarn run bundler \
  --network https://rpc-amoy.polygon.technology \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --beneficiary 0x330A86eE67bA0Da0043EaD201866A32d362C394c \
  --minBalance 0.1 \
  --maxBundleGas 5000000 \
  --auto \
  --autoBundleInterval 3000 \
  --mnemonic <(echo "$BUNDLER_PRIVATE_KEY") \
  --unsafe \
  --port 3000
