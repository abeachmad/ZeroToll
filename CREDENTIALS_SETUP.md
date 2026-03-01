# 🔐 ZeroToll EIP-7702 Credentials Setup

## ⚠️ Security Notice

**CRITICAL**: The credentials files (`.env.credentials`, `.env.eip7702`) contain private keys and are **NEVER** committed to Git. They are in `.gitignore` for security.

---

## 📁 Credentials Files

### Root Level
- **`.env.credentials`** - Master credentials file with all private keys
  - Deployer account (contract deployment)
  - Relayer account (transaction submission)
  - Bundler account (ERC-4337 bundler)

### Backend
- **`backend/.env.eip7702`** - Backend-specific EIP-7702 configuration
  - Bundler and relayer keys
  - Pimlico API configuration
  - Feature flags

### Frontend
- **`frontend/.env.eip7702`** - Frontend-specific EIP-7702 configuration
  - Pimlico API key (public, safe to expose)
  - Bundler/Paymaster RPC endpoints
  - UI feature flags

---

## 🚀 Quick Setup

### 1. Get Pimlico API Key

1. Visit [Pimlico Dashboard](https://dashboard.pimlico.io/)
2. Sign up for free account
3. Create API key for testnets (Amoy + Sepolia)
4. Copy API key

### 2. Update Configuration Files

**Backend (`backend/.env.eip7702`):**
```bash
PIMLICO_API_KEY=your_actual_api_key_here
```

**Frontend (`frontend/.env.eip7702`):**
```bash
REACT_APP_PIMLICO_API_KEY=your_actual_api_key_here
```

### 3. Load Credentials

**Option A: Manual (Development)**
```bash
# Backend
cd backend
source .env.eip7702

# Frontend
cd frontend
source .env.eip7702
```

**Option B: Automatic (Recommended)**

Add to your shell profile (`~/.bashrc` or `~/.zshrc`):
```bash
# ZeroToll EIP-7702 Credentials
if [ -f ~/ZeroToll/.env.credentials ]; then
    export $(cat ~/ZeroToll/.env.credentials | grep -v '^#' | xargs)
fi
```

---

## 🔑 Account Details

### Deployer Account
- **Address**: `0x330a86ee67ba0da0043ead201866a32d362c394c`
- **Purpose**: Deploy smart contracts
- **Required Balance**: ~0.5 ETH/POL per chain

### Relayer Account
- **Address**: `0xf304eed846d82a91d688d1bc1a4fa692051d1d7a`
- **Purpose**: Submit transactions on behalf of users
- **Required Balance**: ~0.1 ETH/POL per chain

### Bundler Account
- **Address**: `0xd4ab7c32fce0d28882052a83de467b9be2dbfc8e`
- **Purpose**: Bundle and submit ERC-4337 UserOperations
- **Required Balance**: ~0.1 ETH/POL per chain

---

## 🧪 Testing Credentials

All accounts are **TESTNET ONLY** with **NO REAL VALUE**. Safe to use for development.

### Check Balances

```bash
# Amoy (Polygon)
cast balance 0x330a86ee67ba0da0043ead201866a32d362c394c --rpc-url https://rpc-amoy.polygon.technology

# Sepolia (Ethereum)
cast balance 0x330a86ee67ba0da0043ead201866a32d362c394c --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

### Fund Accounts

- **Amoy POL**: https://faucet.polygon.technology/
- **Sepolia ETH**: https://sepoliafaucet.com/

---

## 🛡️ Security Best Practices

### ✅ DO:
- Keep `.env.credentials` in `.gitignore`
- Use environment variables in production
- Rotate keys regularly
- Use hardware wallets for mainnet
- Monitor account balances

### ❌ DON'T:
- Commit private keys to Git
- Share credentials in chat/email
- Use testnet keys on mainnet
- Hardcode keys in source code
- Reuse keys across projects

---

## 🔄 Credential Rotation

If credentials are compromised:

1. **Generate new accounts**:
   ```bash
   cast wallet new
   ```

2. **Update all `.env` files**

3. **Transfer funds** from old to new accounts

4. **Update deployed contracts** (if needed)

5. **Revoke old keys**

---

## 📞 Support

If you need help with credentials:
1. Check this guide first
2. Review `.env.example` files
3. Check Pimlico documentation
4. Contact team lead

---

## 🎯 Next Steps

After setting up credentials:

1. ✅ Verify `.gitignore` excludes credential files
2. ✅ Get Pimlico API key
3. ✅ Update configuration files
4. ✅ Test account balances
5. ✅ Run EIP-7702 implementation

**Ready to proceed with EIP-7702 implementation!** 🚀
