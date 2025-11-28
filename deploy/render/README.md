# Deploy ZeroToll Backend to Render (FREE)

## One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/abeachmad/ZeroToll)

## Manual Deploy (5 minutes)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (no credit card needed!)

### Step 2: Create New Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub repo: `abeachmad/ZeroToll`
3. Configure:
   - **Name**: `zerotoll-backend`
   - **Region**: Oregon (US West)
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free

### Step 3: Add Environment Variables
Click **Environment** and add:

| Key | Value |
|-----|-------|
| `AMOY_RPC_URL` | `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY` |
| `SEPOLIA_RPC_URL` | `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` |
| `PIMLICO_API_KEY` | Your Pimlico API key |
| `RELAYER_PRIVATE_KEY` | Your relayer wallet private key |
| `MONGODB_URI` | `mongodb+srv://...` (use MongoDB Atlas free tier) |

### Step 4: Deploy
Click **Create Web Service** and wait ~3-5 minutes.

Your backend URL will be: `https://zerotoll-backend.onrender.com`

### Step 5: Update Vercel Frontend
In Vercel, set:
```
REACT_APP_BACKEND_URL=https://zerotoll-backend.onrender.com
```

---

## Free MongoDB Atlas Setup

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create free account
3. Create free M0 cluster
4. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/zerotoll`
5. **Important**: In Network Access, add `0.0.0.0/0` to allow Render

---

## Limitations of Free Tier

- **Sleeps after 15 minutes of inactivity** (first request takes ~30s to wake up)
- 750 hours/month (enough for demo)
- Shared CPU/RAM

For a hackathon demo, this is perfectly fine!

---

## Troubleshooting

### "Service unavailable" after deploy
- Check logs in Render dashboard
- Make sure all env vars are set
- MongoDB Atlas IP whitelist must include `0.0.0.0/0`

### Slow first request
- Normal! Free tier sleeps after 15min
- First request wakes it up (~30s)
- Subsequent requests are fast

### CORS errors
- Backend already has CORS configured
- Make sure frontend uses correct URL
