# Quick Start: Menjalankan Test

## 🚀 Cara Tercepat (Copy-Paste)

### Buka WSL Terminal dan jalankan:

```bash
# 1. Masuk ke WSL
wsl

# 2. Navigate ke project
cd ~/ZeroToll/packages/contracts

# 3. Install dependencies (jika belum)
npm install

# 4. Compile contracts
npx hardhat compile

# 5. Run tests
npx hardhat test test/RelayerRegistry.test.js
```

---

## 📊 Expected Output

```
RelayerRegistry
  Deployment
    ✓ Should set the correct owner
    ✓ Should set the correct executor
    ✓ Should have correct constants
    ✓ Should start with zero relayers
  
  Registration
    ✓ Should allow registration with sufficient stake
    ✓ Should reject registration with insufficient stake
    ... (46 more tests)

  50 passing (45s)
```

---

## ⚠️ Jika Ada Error

**Error: "UNC paths are not supported"**
→ Pastikan Anda menggunakan WSL terminal, bukan Windows CMD

**Error: "No Hardhat config file found"**
→ Pastikan Anda di directory `packages/contracts`

**Error: "Cannot find module"**
→ Jalankan `npm install` dulu

---

## 📚 Dokumentasi Lengkap

Lihat `CARA_MENJALANKAN_TEST.md` untuk:
- Troubleshooting lengkap
- Test coverage
- Multiple testing methods
- Next steps after tests pass

---

**Status**: Ready to test  
**Duration**: ~1 menit  
**Result**: 50 passing tests ✅
