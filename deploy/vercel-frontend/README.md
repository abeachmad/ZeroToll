# ZeroToll Frontend Vercel Deployment

## Quick Deploy

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/abeachmad/ZeroToll&root-directory=frontend)

### Option 2: Manual Deploy

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository: `abeachmad/ZeroToll`
4. Configure:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

## Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `REACT_APP_BACKEND_URL` | `https://api.zerotoll.xyz` or `http://YOUR_EC2_IP` | ✅ Yes |
| `REACT_APP_WALLETCONNECT_PROJECT_ID` | Your WalletConnect Project ID | ✅ Yes |
| `REACT_APP_RPC_AMOY` | `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY` | Optional |
| `REACT_APP_RPC_SEPOLIA` | `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` | Optional |
| `REACT_APP_PYTH_HERMES_URL` | `https://hermes.pyth.network` | Optional |

## Get WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy the Project ID

## After Deployment

1. Your frontend will be at: `https://your-project.vercel.app`
2. Update your backend CORS to allow this domain
3. Test the swap functionality

## Custom Domain (Optional)

1. Go to Vercel → Project → Settings → Domains
2. Add your domain: `zerotoll.xyz`
3. Update DNS records as instructed

## Troubleshooting

### "Failed to fetch quote"
- Check that `REACT_APP_BACKEND_URL` is set correctly
- Verify backend is running and accessible
- Check browser console for CORS errors

### Wallet won't connect
- Verify `REACT_APP_WALLETCONNECT_PROJECT_ID` is set
- Make sure you're on a supported network (Amoy/Sepolia)

### Build fails
- Check Node.js version (should be 18+)
- Run `npm install` locally to check for errors
