# Vercel Environment Variables Setup

## Required Environment Variables for Vercel Deployment

Add these environment variables in your Vercel project settings:
**Dashboard → Your Project → Settings → Environment Variables**

---

## 🔑 Essential Variables

### Backend URL
```
REACT_APP_BACKEND_URL=https://your-backend-url.com
```
**Note:** Replace with your actual backend URL. If you don't have a backend deployed yet, you can use a placeholder or deploy the backend first.

### Pimlico API Key (for EIP-7702 Gasless Transactions)
```
REACT_APP_PIMLICO_API_KEY=pim_SBVmcVZ3jZgcvmDWUSE6QR
```
**Note:** This is the current API key. Get your own from https://dashboard.pimlico.io/ for production.

---

## 🌐 RPC URLs (Public - No API Key Needed)

```
REACT_APP_RPC_AMOY=https://rpc-amoy.polygon.technology
REACT_APP_RPC_SEPOLIA=https://ethereum-sepolia-rpc.publicnode.com
```

---

## 🔗 WalletConnect (Optional but Recommended)

```
REACT_APP_WALLETCONNECT_PROJECT_ID=demo-project-id
```
**Note:** Get your own project ID from https://cloud.walletconnect.com/ for production.

---

## ⚙️ Build Configuration (Optional)

```
GENERATE_SOURCEMAP=false
IGNORE_WARNINGS=true
```

---

## 📋 Complete List for Copy-Paste

Copy all of these to Vercel:

```
REACT_APP_BACKEND_URL=https://your-backend-url.com
REACT_APP_PIMLICO_API_KEY=pim_SBVmcVZ3jZgcvmDWUSE6QR
REACT_APP_RPC_AMOY=https://rpc-amoy.polygon.technology
REACT_APP_RPC_SEPOLIA=https://ethereum-sepolia-rpc.publicnode.com
REACT_APP_WALLETCONNECT_PROJECT_ID=demo-project-id
GENERATE_SOURCEMAP=false
IGNORE_WARNINGS=true
```

---

## 🚀 How to Add in Vercel

1. Go to https://vercel.com/dashboard
2. Select your ZeroToll project
3. Click **Settings** → **Environment Variables**
4. For each variable:
   - Enter the **Key** (e.g., `REACT_APP_BACKEND_URL`)
   - Enter the **Value** (e.g., `https://your-backend-url.com`)
   - Select environments: **Production**, **Preview**, **Development** (check all)
   - Click **Save**

---

## ⚠️ Important Notes

### Backend URL
- If you haven't deployed the backend yet, you can:
  - Use a placeholder: `https://api.zerotoll.com` (update later)
  - Deploy backend first (recommended)
  - Or use `http://localhost:8000` for testing (won't work in production)

### Pimlico API Key
- Current key: `pim_SBVmcVZ3jZgcvmDWUSE6QR`
- Free tier: 1,000 UserOps/month
- For production, get your own at: https://dashboard.pimlico.io/

### WalletConnect Project ID
- Current: `demo-project-id` (works but limited)
- For production, get your own at: https://cloud.walletconnect.com/

---

## 🔍 Verify Setup

After adding variables, redeploy:
1. Go to **Deployments** tab
2. Click **...** on latest deployment
3. Click **Redeploy**

Check the build logs to ensure no environment variable errors.

---

## 📝 Minimal Setup (Just to Get It Working)

If you just want to get the frontend deployed quickly:

```
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_PIMLICO_API_KEY=pim_SBVmcVZ3jZgcvmDWUSE6QR
REACT_APP_RPC_AMOY=https://rpc-amoy.polygon.technology
REACT_APP_RPC_SEPOLIA=https://ethereum-sepolia-rpc.publicnode.com
GENERATE_SOURCEMAP=false
```

This will deploy successfully, but you'll need to update `REACT_APP_BACKEND_URL` later when you deploy the backend.
