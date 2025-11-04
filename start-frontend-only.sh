#!/bin/bash

echo "🚀 Starting ZeroToll Frontend (UI Testing Mode)"
echo "================================================"
echo ""
echo "ℹ️  Frontend-only mode: Backend features disabled"
echo "   You can test: Modal, Dropdown, Token Picker, UI"
echo "   Cannot test: Get Quote, Execute Swap, History"
echo ""

cd frontend

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    yarn install
fi

echo "🎨 Starting frontend..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Frontend will open at: http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Test Checklist (Frontend Only):"
echo "  ✅ Connect Wallet modal"
echo "  ✅ Account dropdown"
echo "  ✅ Token picker (POL/ETH/USDT)"
echo "  ✅ Native token badges"
echo "  ✅ Fee mode selector"
echo "  ✅ UI responsiveness"
echo ""
echo "Press Ctrl+C to stop"
echo ""

yarn start
