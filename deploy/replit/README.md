# Deploy ZeroToll Backend to Replit (FREE - No Credit Card)

## Quick Start (5 minutes)

### Step 1: Create Replit Account
1. Go to [replit.com](https://replit.com)
2. Sign up with GitHub or Google (NO credit card needed!)

### Step 2: Import from GitHub
1. Click **+ Create Repl**
2. Click **Import from GitHub**
3. Paste: `https://github.com/abeachmad/ZeroToll`
4. Click **Import from GitHub**

### Step 3: Configure Replit
After import, create a file called `.replit` with:
```toml
run = "cd backend && pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8080"
entrypoint = "backend/server.py"

[nix]
channel = "stable-23_11"

[deployment]
run = ["sh", "-c", "cd backend && uvicorn server:app --host 0.0.0.0 --port 8080"]
```

### Step 4: Add Environment Variables (Secrets)
1. Click **Tools** → **Secrets** (or the 🔒 icon)
2. Add these secrets:

| Key | Value |
|-----|-------|
| `MONGO_URL` | `mongodb+srv://user:pass@cluster.mongodb.net/zerotoll` |
| `DB_NAME` | `zerotoll` |
| `CORS_ORIGINS` | `*` |
| `AMOY_ROUTERHUB` | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` |
| `SEPOLIA_ROUTERHUB` | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` |
| `AMOY_MOCKDEX_ADAPTER` | `0xc8A7e30E3Ea68A2eaBA3428aCbf535F3320715d1` |
| `SEPOLIA_MOCKDEX_ADAPTER` | `0x23e2B44bC22F9940F9eb00C6C674039ed291821F` |

### Step 5: Run
1. Click the green **Run** button
2. Wait for dependencies to install (~2-3 minutes)
3. Your URL will appear: `https://zerotoll.YOUR_USERNAME.repl.co`

### Step 6: Update Vercel Frontend
In Vercel, set environment variable:
```
REACT_APP_BACKEND_URL=https://zerotoll.YOUR_USERNAME.repl.co
```

---

## Alternative: Fork and Run

1. Go to: https://replit.com/@templates/Python
2. Create new Python repl
3. In Shell, run:
```bash
git clone https://github.com/abeachmad/ZeroToll.git
cd ZeroToll/backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8080
```

---

## Limitations

- **Sleeps after inactivity** (wakes up on request, ~10-30s delay)
- **Limited resources** on free tier
- **Good for demos** with ~10 users

---

## Keep Alive (Optional)

To prevent sleeping, use a free cron service like [cron-job.org](https://cron-job.org):
- URL: `https://your-repl-url.repl.co/api/`
- Schedule: Every 5 minutes
