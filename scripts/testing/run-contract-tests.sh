#!/bin/bash

# Script untuk menjalankan tests RelayerRegistry
# Cara pakai: bash scripts/testing/run-contract-tests.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🧪 Running RelayerRegistry Tests..."
echo ""

cd "$REPO_ROOT/packages/contracts"

# Install dependencies jika belum
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Compile contracts
echo "🔨 Compiling contracts..."
npx hardhat compile
echo ""

# Run tests
echo "🧪 Running tests..."
npx hardhat test test/RelayerRegistry.test.js

# Show results
echo ""
echo "✅ Tests completed!"
