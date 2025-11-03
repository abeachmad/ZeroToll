# ZeroToll Development Guide

## 🚀 Quick Start

### Prerequisites
- ✅ Node.js 18+ installed
- ✅ Python 3.9+ installed
- ✅ MongoDB installed and running

### Start Development Environment

**Option 1: Automated (Recommended)**
```bash
cd /home/abeachmad/ZeroToll
./start-dev.sh
```

**Option 2: Manual**

**Terminal 1 - Backend:**
```bash
cd /home/abeachmad/ZeroToll/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
cd /home/abeachmad/ZeroToll/frontend
yarn start
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api
- **API Docs**: http://localhost:8000/docs (Swagger UI)

## 📱 Testing the Frontend

### 1. Home Page
- Navigate to: http://localhost:3000
- Check: Logo, navigation, hero section
- Test: "Launch App" button → should go to /swap

### 2. Swap Page
- Navigate to: http://localhost:3000/swap
- Features to test:
  - ✅ Chain selector (Amoy ↔ Sepolia)
  - ✅ Token selector (8 tokens)
  - ✅ Amount input
  - ✅ Fee mode selector (4 modes)
  - ✅ Fee cap input
  - ✅ "Get Quote" button
  - ✅ "Execute Swap" button

### 3. History Page
- Navigate to: http://localhost:3000/history
- Check: Transaction history table
- Check: Stats dashboard

## 🔧 Configuration

### Backend (.env)
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="zerotoll_db"
CORS_ORIGINS="http://localhost:3000,http://localhost:3001"
RELAYER_URL="http://localhost:3001"
```

### Frontend (.env)
```bash
REACT_APP_BACKEND_URL=http://localhost:8000
WDS_SOCKET_PORT=3000
```

## 🐛 Troubleshooting

### MongoDB Not Running
```bash
# Start MongoDB
sudo systemctl start mongod

# Check status
sudo systemctl status mongod
```

### Port Already in Use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Backend Dependencies Error
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend Dependencies Error
```bash
cd frontend
rm -rf node_modules yarn.lock
yarn install
```

## 📦 Project Structure

```
ZeroToll/
├── frontend/          # React app
│   ├── src/
│   │   ├── pages/    # Home, Swap, History
│   │   └── components/
│   └── package.json
├── backend/           # FastAPI server
│   ├── server.py
│   └── requirements.txt
├── packages/
│   ├── contracts/    # Smart contracts
│   ├── relayer/      # Relayer service
│   └── ai/           # AI scoring
└── start-dev.sh      # Development script
```

## 🎨 Frontend Features

### Pages
1. **Home** (`/`)
   - Landing page
   - Features showcase
   - Call-to-action

2. **Swap** (`/swap`)
   - Gasless swap interface
   - Multi-token support
   - Fee mode selection
   - Quote and execute

3. **History** (`/history`)
   - Transaction history
   - Stats dashboard
   - Filter and search

### UI Components
- Radix UI components (48 components)
- Tailwind CSS styling
- Glass morphism effects
- Responsive design

## 🔌 API Endpoints

### Backend API

**GET** `/api/`
- Health check

**POST** `/api/quote`
- Get swap quote
- Body: `{ intent: {...} }`

**POST** `/api/execute`
- Execute swap
- Body: `{ intentId, userOp }`

**GET** `/api/history?user=0x...`
- Get transaction history

**GET** `/api/stats`
- Get platform statistics

## 🧪 Testing

### Manual Testing Checklist

**Swap Flow:**
1. ✅ Select chains (Amoy → Sepolia)
2. ✅ Select tokens (USDC → USDC)
3. ✅ Enter amount (e.g., 100)
4. ✅ Select fee mode (INPUT/OUTPUT/STABLE)
5. ✅ Set fee cap (e.g., 3)
6. ✅ Click "Get Quote"
7. ✅ Verify quote appears
8. ✅ Click "Execute Swap"
9. ✅ Verify success message
10. ✅ Check history page

**UI Testing:**
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Dark theme
- ✅ Animations and transitions
- ✅ Error messages
- ✅ Loading states

## 🚀 Production Build

### Frontend
```bash
cd frontend
yarn build
# Output: build/ folder
```

### Backend
```bash
cd backend
# Use gunicorn for production
gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker
```

## 📊 Monitoring

### Backend Logs
```bash
# Development
tail -f backend/logs/app.log

# Production
journalctl -u zerotoll-backend -f
```

### Frontend Logs
- Browser console (F12)
- Network tab for API calls

## 🔐 Security Notes

- ✅ CORS configured for localhost
- ✅ Input validation on backend
- ✅ No hardcoded credentials
- ✅ Environment variables for secrets

## 📚 Additional Resources

- **Smart Contracts**: See `packages/contracts/`
- **API Documentation**: http://localhost:8000/docs
- **Security Audit**: See `SECURITY_AUDIT_REPORT.md`
- **Pyth Integration**: See `PYTH_INTEGRATION.md`

## 🆘 Support

If you encounter issues:
1. Check logs (backend and browser console)
2. Verify MongoDB is running
3. Check port availability
4. Verify environment variables
5. Restart development servers

---

**Happy Coding!** 🎉
