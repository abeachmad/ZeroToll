# ZeroToll Backend AWS Deployment Guide

## Quick Start (5 minutes)

### Step 1: Launch EC2 Instance

1. Go to [AWS EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click **Launch Instance**
3. Configure:
   - **Name**: `zerotoll-backend`
   - **AMI**: Ubuntu Server 24.04 LTS (or 22.04)
   - **Instance type**: `t3.micro` (free tier eligible)
   - **Key pair**: Create new or use existing
   - **Security Group**: Create new with these rules:
     - SSH (22) - Your IP
     - HTTP (80) - Anywhere (0.0.0.0/0)
     - HTTPS (443) - Anywhere (0.0.0.0/0)
     - Custom TCP (8000) - Anywhere (for direct API access)

4. Click **Launch Instance**

### Step 2: Connect to Instance

```bash
# Replace with your key file and EC2 public IP
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 3: Run Setup Script

```bash
# Download and run setup script
curl -sSL https://raw.githubusercontent.com/abeachmad/ZeroToll/main/deploy/aws-backend/setup.sh | bash
```

Or manually:
```bash
git clone https://github.com/abeachmad/ZeroToll.git
cd ZeroToll/deploy/aws-backend
chmod +x setup.sh
./setup.sh
```

### Step 4: Configure Environment

```bash
# Edit the .env file with your credentials
nano /opt/zerotoll/ZeroToll/backend/.env
```

Required environment variables:
```env
# RPC URLs
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Pimlico API Key
PIMLICO_API_KEY=your_pimlico_api_key

# Private Keys (for relayer)
RELAYER_PRIVATE_KEY=your_relayer_private_key

# MongoDB (use MongoDB Atlas for production)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/zerotoll
```

### Step 5: Restart Service

```bash
sudo systemctl restart zerotoll-backend
```

### Step 6: Verify

```bash
# Check service status
sudo systemctl status zerotoll-backend

# Test API
curl http://localhost:8000/api/
```

---

## Update Frontend to Use AWS Backend

In your Vercel deployment, set the environment variable:

```
REACT_APP_API_URL=http://YOUR_EC2_PUBLIC_IP
```

Or if you have a domain:
```
REACT_APP_API_URL=https://api.zerotoll.xyz
```

---

## Optional: Setup Custom Domain with HTTPS

### 1. Point Domain to EC2

Add an A record in your DNS:
```
api.zerotoll.xyz -> YOUR_EC2_PUBLIC_IP
```

### 2. Update Nginx Config

```bash
sudo nano /etc/nginx/sites-available/zerotoll-api
# Change server_name _; to server_name api.zerotoll.xyz;
sudo nginx -t && sudo systemctl restart nginx
```

### 3. Get SSL Certificate

```bash
sudo certbot --nginx -d api.zerotoll.xyz
```

---

## Useful Commands

```bash
# View logs
sudo journalctl -u zerotoll-backend -f

# Restart service
sudo systemctl restart zerotoll-backend

# Stop service
sudo systemctl stop zerotoll-backend

# Check status
sudo systemctl status zerotoll-backend

# Update code
cd /opt/zerotoll/ZeroToll && git pull
sudo systemctl restart zerotoll-backend
```

---

## Troubleshooting

### Service won't start
```bash
# Check logs
sudo journalctl -u zerotoll-backend -n 50

# Check if port is in use
sudo lsof -i :8000
```

### MongoDB connection issues
- Use MongoDB Atlas (cloud) instead of local MongoDB
- Whitelist EC2 IP in MongoDB Atlas Network Access

### CORS issues
- Nginx config includes CORS headers
- Make sure frontend is using correct API URL

---

## Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| EC2 t3.micro | $0 (free tier) or ~$8 |
| MongoDB Atlas M0 | $0 (free tier) |
| Domain (optional) | ~$12/year |
| **Total** | **$0 - $10/month** |
