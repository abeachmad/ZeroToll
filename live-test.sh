#!/bin/bash

# ========================================
# ZeroToll Live Test - Quick Start Guide
# ========================================

echo "🎯 ZeroToll Live Test Environment"
echo "=================================="
echo ""
echo "✅ RouterHub Working on:"
echo "   • Amoy:   0x63db4Ac855DD552947238498Ab5da561cce4Ac0b"
echo "   • Sepolia: 0x1449279761a3e6642B02E82A7be9E5234be00159"
echo ""
echo "🔗 Successful Transactions:"
echo "   • Amoy:   https://amoy.polygonscan.com/tx/0xb21ac51945734534ad8aec3c80e86ce6c69b2bb5ede3025b38d05ad3ac076c73"
echo "   • Sepolia: https://sepolia.etherscan.io/tx/0xe3767cb49376bb8a4b58d5617bb2a162ed3c5e8cf996ee970797346a409e88f7"
echo ""
echo "=================================="
echo ""

# Check if script is run from project root
if [ ! -f "package.json" ]; then
    echo "❌ Please run from project root: /home/abeachmad/ZeroToll"
    exit 1
fi

echo "📋 Available Commands:"
echo ""
echo "1. Full Stack (Backend + Frontend)"
echo "   ./start-zerotoll.sh"
echo "   → Backend: http://localhost:8000"
echo "   → Frontend: http://localhost:3000"
echo ""
echo "2. Development Mode (with logs)"
echo "   ./start-dev.sh"
echo "   → Live reload enabled"
echo "   → Visible logs for debugging"
echo ""
echo "3. Frontend Only (UI testing)"
echo "   ./start-frontend-only.sh"
echo "   → Only UI, no swap functionality"
echo ""
echo "=================================="
echo ""

PS3="Choose option (1-3) or 'q' to quit: "
options=("Full Stack" "Development Mode" "Frontend Only" "Quit")

select opt in "${options[@]}"
do
    case $opt in
        "Full Stack")
            echo "🚀 Starting Full Stack..."
            chmod +x start-zerotoll.sh
            ./start-zerotoll.sh
            break
            ;;
        "Development Mode")
            echo "🔧 Starting Development Mode..."
            chmod +x start-dev.sh
            ./start-dev.sh
            break
            ;;
        "Frontend Only")
            echo "🎨 Starting Frontend Only..."
            chmod +x start-frontend-only.sh
            ./start-frontend-only.sh
            break
            ;;
        "Quit")
            echo "👋 Goodbye!"
            exit 0
            ;;
        *) 
            echo "❌ Invalid option $REPLY"
            ;;
    esac
done
