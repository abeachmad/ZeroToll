#!/bin/bash
# Quick Start Script for ZeroToll Policy Server + Bundler

echo "╔════════════════════════════════════════════════════════════╗"
echo "║    ZeroToll - Start Policy Server + Bundler                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if services are already running
if pgrep -f "policy-server/server.js" > /dev/null; then
    echo "✅ Policy server already running"
else
    echo "🚀 Starting policy server..."
    cd /home/abeachmad/ZeroToll/backend/policy-server
    npm start > policy-server.log 2>&1 &
    sleep 2
    if pgrep -f "policy-server/server.js" > /dev/null; then
        echo "✅ Policy server started on http://localhost:3002"
    else
        echo "❌ Failed to start policy server"
        exit 1
    fi
fi

# Check bundler
cd /home/abeachmad/ZeroToll/bundler-infinitism
if pgrep -f "packages/bundler" > /dev/null; then
    echo "✅ Bundler already running"
else
    echo "🚀 Starting bundler..."
    ./start-bundler.sh > bundler.log 2>&1 &
    sleep 5
    if pgrep -f "packages/bundler" > /dev/null; then
        echo "✅ Bundler started on http://localhost:3000"
    else
        echo "❌ Failed to start bundler"
        exit 1
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║    SERVICES RUNNING                                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📡 Policy Server: http://localhost:3002"
echo "   Signer: 0x84d44b412CeA92064B5441fB7CfC354Ec1750eb2"
echo "   Logs: /home/abeachmad/ZeroToll/backend/policy-server/policy-server.log"
echo ""
echo "📡 Bundler: http://localhost:3000/rpc"
echo "   Wallet: 0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e"
echo "   Logs: /home/abeachmad/ZeroToll/bundler-infinitism/bundler.log"
echo ""
echo "🎯 Test endpoints:"
echo "   curl http://localhost:3002/health"
echo "   curl -X POST http://localhost:3000/rpc -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_supportedEntryPoints\",\"params\":[]}'"
echo ""
echo "📝 Next: Fund VerifyingPaymaster at 0xC721582d25895956491436459df34cd817C6AB74"
echo ""
