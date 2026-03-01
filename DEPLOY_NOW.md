# DEPLOY NOW - Copy Paste Commands

## 🚀 Deploy dalam 5 Menit

### Step 1: Deploy ke Amoy (2 menit)

```bash
cd ~/ZeroToll/packages/contracts
npx hardhat run scripts/deploy-relayer-registry.js --network amoy
```

**Save the contract address yang muncul!**

---

### Step 2: Deploy ke Sepolia (2 menit)

```bash
npx hardhat run scripts/deploy-relayer-registry.js --network sepolia
```

**Save the contract address yang muncul!**

---

### Step 3: Commit Deployment Info (1 menit)

```bash
cd ~/ZeroToll
git add deployments/
git commit -m "deploy: RelayerRegistry to Amoy and Sepolia testnets"
git push origin main
```

---

## 📝 Deployment Addresses

Setelah deploy, catat addresses di sini:

**Amoy**: 0x_________________
**Sepolia**: 0x_________________

---

## ✅ Checklist

- [ ] Deploy to Amoy
- [ ] Deploy to Sepolia
- [ ] Save addresses
- [ ] Commit to git
- [ ] Submit to judges

---

**Time**: ~5 minutes total
**Status**: Ready to deploy NOW!

🚀 **GO!**
