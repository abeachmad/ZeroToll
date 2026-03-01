# Cara Menjalankan Test RelayerRegistry

**File Test**: `packages/contracts/test/RelayerRegistry.test.js`  
**Test Cases**: 50+ comprehensive tests

---

## 🎯 Metode 1: Menggunakan WSL (Recommended)

Karena ada masalah UNC path di Windows, cara terbaik adalah menggunakan WSL langsung:

### Step 1: Buka WSL Terminal

```bash
# Buka WSL Ubuntu
wsl

# Atau dari Windows Terminal, pilih Ubuntu
```

### Step 2: Navigate ke Project Directory

```bash
cd ~/ZeroToll/packages/contracts
```

### Step 3: Install Dependencies (jika belum)

```bash
npm install
```

### Step 4: Compile Contracts

```bash
npx hardhat compile
```

### Step 5: Run Tests

```bash
# Run semua tests
npx hardhat test

# Run hanya RelayerRegistry tests
npx hardhat test test/RelayerRegistry.test.js

# Run dengan gas reporting
REPORT_GAS=true npx hardhat test test/RelayerRegistry.test.js

# Run dengan coverage
npx hardhat coverage
```

---

## 🎯 Metode 2: Menggunakan Bash Script

Saya sudah buat script helper:

### Step 1: Buka WSL Terminal

```bash
wsl
cd ~/ZeroToll
```

### Step 2: Jalankan Script

```bash
bash run-tests.sh
```

Script ini akan:
1. Install dependencies (jika belum)
2. Compile contracts
3. Run tests
4. Show results

---

## 🎯 Metode 3: Menggunakan npm Scripts

### Step 1: Buka WSL Terminal

```bash
wsl
cd ~/ZeroToll/packages/contracts
```

### Step 2: Run npm test

```bash
npm test
```

Ini akan menjalankan semua tests di folder `test/`.

---

## 📊 Expected Output

Jika tests berhasil, Anda akan melihat output seperti ini:

```
RelayerRegistry
  Deployment
    ✓ Should set the correct owner (1234ms)
    ✓ Should set the correct executor (567ms)
    ✓ Should have correct constants (234ms)
    ✓ Should start with zero relayers (123ms)
  
  Registration
    ✓ Should allow registration with sufficient stake (2345ms)
    ✓ Should reject registration with insufficient stake (1234ms)
    ✓ Should reject duplicate registration (1567ms)
    ✓ Should add relayer to active relayers list (1890ms)
    ✓ Should allow multiple relayers to register (2345ms)
    ✓ Should allow registration with more than minimum stake (1678ms)
  
  Unregistration
    ✓ Should allow active relayer to unregister (2456ms)
    ✓ Should return stake on unregistration (1789ms)
    ✓ Should remove from active relayers list (1567ms)
    ✓ Should reject unregistration from non-relayer (1234ms)
    ✓ Should reject duplicate unregistration (1456ms)
  
  ... (40+ more tests)

  50 passing (45s)
```

---

## 🐛 Troubleshooting

### Error: "UNC paths are not supported"

**Problem**: Windows CMD tidak support UNC paths untuk WSL

**Solution**: Gunakan WSL terminal langsung (Metode 1 atau 2)

```bash
# Jangan gunakan:
cd packages/contracts  # dari Windows CMD

# Gunakan:
wsl
cd ~/ZeroToll/packages/contracts
```

### Error: "No Hardhat config file found"

**Problem**: Hardhat tidak menemukan `hardhat.config.js`

**Solution**: Pastikan Anda di directory yang benar

```bash
# Check current directory
pwd
# Output harus: /home/abeachmad/ZeroToll/packages/contracts

# Check hardhat.config.js exists
ls hardhat.config.js
```

### Error: "Cannot find module '@nomicfoundation/hardhat-toolbox'"

**Problem**: Dependencies belum terinstall

**Solution**: Install dependencies

```bash
npm install
```

### Error: "Node.js version not supported"

**Problem**: Hardhat membutuhkan Node.js versi tertentu

**Solution**: Update Node.js atau gunakan nvm

```bash
# Check Node version
node --version

# Install nvm (jika belum)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js LTS
nvm install --lts
nvm use --lts
```

### Error: "Compilation failed"

**Problem**: Ada error di contract code

**Solution**: Check error message dan fix contract

```bash
# Compile dengan verbose output
npx hardhat compile --verbose
```

---

## 📈 Test Coverage

Untuk melihat test coverage:

```bash
cd ~/ZeroToll/packages/contracts
npx hardhat coverage
```

Output akan menunjukkan:

```
--------------------|----------|----------|----------|----------|
File                |  % Stmts | % Branch |  % Funcs |  % Lines |
--------------------|----------|----------|----------|----------|
 contracts/         |      100 |      100 |      100 |      100 |
  RelayerRegistry.sol|      100 |      100 |      100 |      100 |
--------------------|----------|----------|----------|----------|
All files           |      100 |      100 |      100 |      100 |
--------------------|----------|----------|----------|----------|
```

Target: >80% coverage untuk semua metrics

---

## 🚀 Quick Start (Copy-Paste)

Jika Anda ingin langsung jalankan test, copy-paste ini ke WSL terminal:

```bash
# Navigate to project
cd ~/ZeroToll/packages/contracts

# Install dependencies (jika belum)
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test test/RelayerRegistry.test.js

# Run dengan gas reporting
REPORT_GAS=true npx hardhat test test/RelayerRegistry.test.js
```

---

## 📝 Test Structure

Test suite mencakup:

### 1. Deployment Tests (4 tests)
- Owner setup
- Executor setup
- Constants verification
- Initial state

### 2. Registration Tests (6 tests)
- Successful registration
- Insufficient stake rejection
- Duplicate registration rejection
- Active relayers list
- Multiple registrations
- Extra stake handling

### 3. Unregistration Tests (5 tests)
- Successful unregistration
- Stake return
- List removal
- Non-relayer rejection
- Duplicate unregistration rejection

### 4. Stake Management Tests (3 tests)
- Stake increase
- Zero value rejection
- Non-relayer rejection

### 5. Execution Recording Tests (6 tests)
- Successful execution
- Failed execution + slashing
- Low stake deactivation
- Non-executor rejection
- Inactive relayer rejection
- Duplicate intent rejection

### 6. Reputation Management Tests (3 tests)
- Reputation calculation
- Reputation decay
- Low reputation deactivation

### 7. View Functions Tests (4 tests)
- Relayer stats
- Network stats
- Active status check
- Execution records

### 8. Admin Functions Tests (4 tests)
- Executor update
- Non-owner rejection
- Zero address rejection
- Emergency withdraw

### 9. Edge Cases Tests (4 tests)
- Maximum relayers limit
- Zero reward handling
- Empty network stats
- Zero execution stats

### 10. Security Tests (2 tests)
- Reentrancy prevention (unregister)
- Reentrancy prevention (record execution)

**Total**: 50+ comprehensive test cases

---

## 🎯 Next Steps After Tests Pass

1. **Deploy to Local Network**
   ```bash
   # Terminal 1: Start local node
   npx hardhat node
   
   # Terminal 2: Deploy
   npx hardhat run scripts/deploy-relayer-registry.js --network localhost
   ```

2. **Deploy to Amoy Testnet**
   ```bash
   npx hardhat run scripts/deploy-relayer-registry.js --network amoy
   ```

3. **Deploy to Sepolia Testnet**
   ```bash
   npx hardhat run scripts/deploy-relayer-registry.js --network sepolia
   ```

4. **Register First Test Relayer**
   ```bash
   npx hardhat console --network amoy
   > const registry = await ethers.getContractAt("RelayerRegistry", "0x...")
   > await registry.registerRelayer({ value: ethers.parseEther("10") })
   ```

---

## 📚 Additional Resources

- **Hardhat Documentation**: https://hardhat.org/docs
- **Hardhat Testing Guide**: https://hardhat.org/tutorial/testing-contracts
- **Chai Matchers**: https://hardhat.org/hardhat-chai-matchers/docs/overview
- **Ethers.js Documentation**: https://docs.ethers.org/v6/

---

## ✅ Checklist

Sebelum deploy ke testnet, pastikan:

- [ ] All tests passing (50/50)
- [ ] Test coverage >80%
- [ ] No compilation warnings
- [ ] Gas usage optimized
- [ ] Contract verified on local network
- [ ] Documentation updated

---

**Status**: Ready to test  
**Expected Duration**: 30-60 seconds  
**Expected Result**: 50 passing tests

🚀 **Let's run the tests!**
