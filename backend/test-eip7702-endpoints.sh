#!/bin/bash

# Test EIP-7702 Endpoints
# Run this after starting the backend server

BASE_URL="http://localhost:3002/api/eip7702"

echo "========================================="
echo "Testing EIP-7702 Endpoints"
echo "========================================="
echo ""

# Test 1: Info endpoint
echo "1. Testing /info endpoint..."
curl -s "$BASE_URL/info" | python3 -m json.tool
echo ""
echo ""

# Test 2: Health check - Amoy
echo "2. Testing /health/80002 (Amoy)..."
curl -s "$BASE_URL/health/80002" | python3 -m json.tool
echo ""
echo ""

# Test 3: Health check - Sepolia
echo "3. Testing /health/11155111 (Sepolia)..."
curl -s "$BASE_URL/health/11155111" | python3 -m json.tool
echo ""
echo ""

# Test 4: Get nonce - Amoy
echo "4. Testing /nonce/80002/0x330A86eE67bA0Da0043EaD201866A32d362C394c..."
curl -s "$BASE_URL/nonce/80002/0x330A86eE67bA0Da0043EaD201866A32d362C394c" | python3 -m json.tool
echo ""
echo ""

# Test 5: Get nonce - Sepolia
echo "5. Testing /nonce/11155111/0x330A86eE67bA0Da0043EaD201866A32d362C394c..."
curl -s "$BASE_URL/nonce/11155111/0x330A86eE67bA0Da0043EaD201866A32d362C394c" | python3 -m json.tool
echo ""
echo ""

# Test 6: Get quote - Amoy (USDC -> POL)
echo "6. Testing /quote (Amoy USDC -> POL)..."
curl -s -X POST "$BASE_URL/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 80002,
    "tokenIn": "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    "tokenOut": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
    "amountIn": "1000000"
  }' | python3 -m json.tool
echo ""
echo ""

# Test 7: Get quote - Sepolia (USDC -> ETH)
echo "7. Testing /quote (Sepolia USDC -> ETH)..."
curl -s -X POST "$BASE_URL/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 11155111,
    "tokenIn": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    "tokenOut": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    "amountIn": "1000000"
  }' | python3 -m json.tool
echo ""
echo ""

echo "========================================="
echo "All tests complete!"
echo "========================================="
