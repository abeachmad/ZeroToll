#!/bin/bash

# Verify BatchExecutor Deployment
# This script checks if the contracts are deployed correctly

echo "🔍 Verifying BatchExecutor Deployment"
echo "======================================"
echo ""

# Sepolia
echo "📍 Sepolia Testnet"
echo "Address: 0x8dD08D3369e1c36a03b30587a032b5A8Aaa177F9"
echo "Explorer: https://sepolia.etherscan.io/address/0x8dD08D3369e1c36a03b30587a032b5A8Aaa177F9"
echo ""

# Check if contract has code on Sepolia
echo "Checking contract code on Sepolia..."
SEPOLIA_CODE=$(curl -s "https://api-sepolia.etherscan.io/api?module=proxy&action=eth_getCode&address=0x8dD08D3369e1c36a03b30587a032b5A8Aaa177F9&tag=latest")

if [[ $SEPOLIA_CODE == *"0x"* ]] && [[ $SEPOLIA_CODE != *"0x0"* ]] && [[ ${#SEPOLIA_CODE} -gt 10 ]]; then
  echo "✅ Sepolia: Contract code found!"
else
  echo "❌ Sepolia: No contract code found"
fi
echo ""

# Amoy
echo "📍 Amoy Testnet (Polygon)"
echo "Address: 0x8153FA09Be1689D44C343f119C829F6702A8720b"
echo "Explorer: https://amoy.polygonscan.com/address/0x8153FA09Be1689D44C343f119C829F6702A8720b"
echo ""

# Check if contract has code on Amoy
echo "Checking contract code on Amoy..."
AMOY_CODE=$(curl -s "https://api-amoy.polygonscan.com/api?module=proxy&action=eth_getCode&address=0x8153FA09Be1689D44C343f119C829F6702A8720b&tag=latest")

if [[ $AMOY_CODE == *"0x"* ]] && [[ $AMOY_CODE != *"0x0"* ]] && [[ ${#AMOY_CODE} -gt 10 ]]; then
  echo "✅ Amoy: Contract code found!"
else
  echo "❌ Amoy: No contract code found"
fi
echo ""

echo "======================================"
echo "✅ Verification Complete!"
echo ""
echo "Next Steps:"
echo "1. Update frontend: cp frontend/src/hooks/useEIP7702Swap.FIXED.js frontend/src/hooks/useEIP7702Swap.js"
echo "2. Test in frontend UI"
echo "3. Execute swap and verify USDC deduction"
echo ""
echo "Addresses to use:"
echo "  Sepolia: 0x8dD08D3369e1c36a03b30587a032b5A8Aaa177F9"
echo "  Amoy: 0x8153FA09Be1689D44C343f119C829F6702A8720b"
