#!/bin/bash

echo "=============================================="
echo "EIP-7702 TRUE GASLESS TEST RUNNER"
echo "=============================================="
echo ""

cd "$(dirname "$0")"

echo "Running TRUE gasless verification test..."
echo ""

node test-final-gasless-verification.mjs

echo ""
echo "=============================================="
echo "Test complete!"
echo "=============================================="
