#!/bin/bash
# AWS EC2 Backend Setup Script for ZeroToll
# Run this on a fresh Ubuntu 22.04/24.04 EC2 instance

set -e

echo "🚀 Setting up ZeroToll Backend on AWS EC2"
echo "=========================================="

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt install -y python3 python3-pip python3-venv git nginx certbot python3-certbot-nginx

# Create app directory
echo "📁 Creating app directory..."
sudo mkdir -p /opt/zerotoll
sudo chown $USER:$USER /opt/zerotoll

# Clone repository (or copy files)
echo "📥 Cloning ZeroToll repository..."
cd /opt/zerotoll
if [ -d "ZeroToll" ]; then
    cd ZeroToll && git pull
else
    git clone https://github.com/abeachmad/ZeroToll.git
    cd ZeroToll
fi

# Setup Python virtual environment
echo "🐍 Setting up Python environment..."
cd /opt/zerotoll/ZeroToll/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file (you'll need to fill this in)
if [ ! -f .env ]; then
    echo "📝 Creating .env template..."
    cp .env.example .env
    echo "⚠️  IMPORTANT: Edit /opt/zerotoll/ZeroToll/backend/.env with your credentials!"
fi

# Create systemd service
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/zerotoll-backend.service > /dev/null <<EOF
[Unit]
Description=ZeroToll Backend API
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/zerotoll/ZeroToll/backend
Environment="PATH=/opt/zerotoll/ZeroToll/backend/venv/bin"
ExecStart=/opt/zerotoll/ZeroToll/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "🔧 Enabling service..."
sudo systemctl daemon-reload
sudo systemctl enable zerotoll-backend
sudo systemctl start zerotoll-backend

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/zerotoll-api > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;  # Replace with your domain: api.zerotoll.xyz

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
        
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/zerotoll-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo ""
echo "✅ Setup Complete!"
echo "=================="
echo ""
echo "📊 Service Status:"
sudo systemctl status zerotoll-backend --no-pager | head -10
echo ""
echo "🔗 API URL: http://$(curl -s ifconfig.me):80/api/"
echo ""
echo "📝 Next Steps:"
echo "   1. Edit /opt/zerotoll/ZeroToll/backend/.env with your credentials"
echo "   2. Restart: sudo systemctl restart zerotoll-backend"
echo "   3. For HTTPS, run: sudo certbot --nginx -d api.yourdomain.com"
echo ""
echo "📄 Useful Commands:"
echo "   View logs:    sudo journalctl -u zerotoll-backend -f"
echo "   Restart:      sudo systemctl restart zerotoll-backend"
echo "   Status:       sudo systemctl status zerotoll-backend"
echo ""
