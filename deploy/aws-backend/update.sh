#!/bin/bash
# Quick update script for ZeroToll Backend on AWS EC2

set -e

echo "🔄 Updating ZeroToll Backend..."

cd /opt/zerotoll/ZeroToll

# Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Update dependencies if needed
echo "📦 Updating dependencies..."
cd backend
source venv/bin/activate
pip install -r requirements.txt --quiet

# Restart service
echo "🔄 Restarting service..."
sudo systemctl restart zerotoll-backend

# Wait and check status
sleep 3
echo ""
echo "✅ Update complete!"
echo ""
sudo systemctl status zerotoll-backend --no-pager | head -10
echo ""
echo "🔗 Test: curl http://localhost:8000/api/"
