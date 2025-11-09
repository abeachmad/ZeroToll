#!/bin/bash

echo "🛑 Stopping ZeroToll..."

# Kill ports
lsof -ti:8000 2>/dev/null | xargs -r kill -9 2>/dev/null && echo "✅ Backend stopped"
lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null && echo "✅ Frontend stopped"

# Stop MongoDB?
if pgrep -x mongod > /dev/null 2>&1; then
    read -p "Stop MongoDB? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo pkill -9 mongod && echo "✅ MongoDB stopped"
    fi
fi

echo "🎉 ZeroToll stopped!"
