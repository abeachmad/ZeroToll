# 🚀 Deploy ke Testnet - Panduan Lengkap

## Tujuan
Deploy smart contracts ke Polygon Amoy dan Ethereum Sepolia agar aplikasi bisa melakukan **SWAP REAL** dengan transaksi tercatat di blockchain.

## Prasyarat

### 1. Dapatkan Testnet Tokens
```bash
# POL Amoy (untuk gas di Polygon Amoy)
https://faucet.polygon.technology/
→ Pilih "Polygon Amoy"
→ Paste alamat wallet Anda
→ Dapatkan ~0.5 POL

# ETH Sepolia (untuk gas di Ethereum Sepolia)
https://sepoliafaucet.com/
→ Paste alamat wallet Anda
→ Dapatkan ~0.5 ETH Sepolia
```

### 2. Export Private Key dari MetaMask
```bash
# HATI-HATI: Jangan share private key ke siapapun!
# Ini hanya untuk testnet, JANGAN gunakan wallet dengan dana real!

1. Buka MetaMask
2. Klik 3 titik → Account Details
3. Klik "Show Private Key"
4. Masukkan password MetaMask
5. Copy private key (format: 0x...)
```

## Setup Environment

### 1. Setup Contracts .env
```bash
cd /home/abeachmad/ZeroToll/packages/contracts

# Copy .env.example
cp .env.example .env

# Edit .env
nano .env
```

### 2. Isi .env dengan nilai berikut:
```bash
# RPC Endpoints (sudah disediakan)
RPC_AMOY=https://rpc-amoy.polygon.technology/
RPC_SEPOLIA=https://rpc.sepolia.org

# Bundler URLs (sudah disediakan)
BUNDLER_URL_AMOY=https://bundler.biconomy.io/api/v2/80002
BUNDLER_URL_SEPOLIA=https://bundler.biconomy.io/api/v2/11155111

# EntryPoint (ERC-4337 standard)
ENTRYPOINT_AMOY=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
ENTRYPOINT_SEPOLIA=0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789

# PENTING: Isi dengan private key Anda
PRIVATE_KEY_DEPLOYER=0xYOUR_PRIVATE_KEY_HERE
PRIVATE_KEY_RELAYER=0xYOUR_PRIVATE_KEY_HERE

# Treasury (gunakan alamat wallet Anda)
TREASURY_ADDRESS=0xYOUR_WALLET_ADDRESS

# Permit2 (sudah deployed di semua chain)
PERMIT2_AMOY=0x000000000022D473030F116dDEE9F6B43aC78BA3
PERMIT2_SEPOLIA=0x000000000022D473030F116dDEE9F6B43aC78BA3

# Optional: API Keys untuk verify contracts
POLYGONSCAN_API_KEY=
ETHERSCAN_API_KEY=
```

## Deploy Contracts

### 1. Install Dependencies
```bash
cd /home/abeachmad/ZeroToll/packages/contracts
yarn install
```

### 2. Deploy ke Polygon Amoy
```bash
yarn hardhat run scripts/quickDeploy.js --network amoy
```

**Output yang diharapkan:**
```
🚀 ZeroToll Quick Deploy
Network: amoy
Deployer: 0xYourAddress
Balance: 0.5 POL

📦 Deploying RouterHub...
✅ RouterHub: 0x1234...

📦 Deploying FeeSink...
✅ FeeSink: 0x5678...

⚙️  Configuring RouterHub...
✅ FeeSink set in RouterHub
✅ Native wrapped set: 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9

📋 Deployment Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Network: amoy
RouterHub: 0x1234...
FeeSink: 0x5678...
Wrapped Token: 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 Addresses saved to: deployments/amoy-1234567890.json
```

### 3. Deploy ke Ethereum Sepolia
```bash
yarn hardhat run scripts/quickDeploy.js --network sepolia
```

**Output yang diharapkan:**
```
🚀 ZeroToll Quick Deploy
Network: sepolia
Deployer: 0xYourAddress
Balance: 0.5 ETH

📦 Deploying RouterHub...
✅ RouterHub: 0xABCD...

📦 Deploying FeeSink...
✅ FeeSink: 0xEF01...

⚙️  Configuring RouterHub...
✅ FeeSink set in RouterHub
✅ Native wrapped set: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14

📋 Deployment Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Network: sepolia
RouterHub: 0xABCD...
FeeSink: 0xEF01...
Wrapped Token: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 Addresses saved to: deployments/sepolia-1234567890.json
```

## Update Frontend Config

### 1. Buat file config untuk contract addresses
```bash
cd /home/abeachmad/ZeroToll/frontend/src/config
```

### 2. Buat file `contracts.json`:
```json
{
  "amoy": {
    "chainId": 80002,
    "routerHub": "0x1234...",
    "feeSink": "0x5678...",
    "wrappedToken": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"
  },
  "sepolia": {
    "chainId": 11155111,
    "routerHub": "0xABCD...",
    "feeSink": "0xEF01...",
    "wrappedToken": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
  }
}
```

## Verifikasi Deployment

### 1. Cek di Block Explorer

**Polygon Amoy:**
```
https://amoy.polygonscan.com/address/0xYOUR_ROUTERHUB_ADDRESS
```

**Ethereum Sepolia:**
```
https://sepolia.etherscan.io/address/0xYOUR_ROUTERHUB_ADDRESS
```

### 2. Test Contract Interaction
```bash
# Test RouterHub di Amoy
yarn hardhat console --network amoy

# Di console:
const RouterHub = await ethers.getContractFactory("RouterHub");
const router = await RouterHub.attach("0xYOUR_ROUTERHUB_ADDRESS");
await router.feeSink(); // Should return FeeSink address
```

## Konsekuensi MongoDB Tidak Berjalan

### ✅ Yang TETAP Berjalan (On-Chain):
- Swap transaksi REAL di blockchain
- Transaksi tercatat di Amoy/Sepolia
- Bisa dicek di PolygonScan/Etherscan
- Quote calculation (backend)
- Execute swap (kirim ke blockchain)

### ❌ Yang TIDAK Berjalan (Off-Chain UI):
- History page (riwayat transaksi di UI)
- Stats dashboard (statistik agregat)
- User transaction list

**Solusi:** Transaksi tetap bisa dilakukan dan dicek di explorer. History page bisa dibangun nanti dengan The Graph atau indexer lain.

## Test Swap di Testnet

### 1. Dapatkan Test Tokens
```bash
# LINK Sepolia Faucet
https://faucets.chain.link/sepolia

# LINK Amoy - bisa swap dari POL di DEX testnet
# Atau mint dari contract jika ada mock token
```

### 2. Approve Tokens
Sebelum swap, user perlu approve RouterHub untuk spend tokens:
```javascript
// Di MetaMask atau via ethers.js
await tokenContract.approve(routerHubAddress, amount);
```

### 3. Execute Swap
```bash
1. Buka frontend: http://localhost:3000
2. Connect wallet (MetaMask)
3. Switch ke Polygon Amoy atau Ethereum Sepolia
4. Pilih token: ETH → POL atau LINK → POL
5. Masukkan amount: 0.01
6. Get Quote → lihat harga real dari Pyth
7. Execute Swap → approve di MetaMask
8. Tunggu konfirmasi (~30 detik)
9. Cek transaksi di explorer!
```

## Troubleshooting

### Error: "Insufficient funds for gas"
→ Dapatkan lebih banyak testnet tokens dari faucet

### Error: "Nonce too high"
→ Reset MetaMask account: Settings → Advanced → Reset Account

### Error: "Contract not deployed"
→ Cek apakah deployment berhasil di explorer

### Error: "Execution reverted"
→ Cek apakah token sudah di-approve
→ Cek balance token mencukupi

## Next Steps

Setelah deployment berhasil:
1. ✅ Test swap ETH → POL
2. ✅ Test swap LINK → POL
3. ✅ Verifikasi transaksi di explorer
4. ✅ Test semua fee modes (INPUT, OUTPUT, NATIVE)
5. 📸 Screenshot untuk dokumentasi

## Alamat Penting

### Polygon Amoy
- WPOL: `0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9`
- LINK: `0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904`
- Explorer: https://amoy.polygonscan.com

### Ethereum Sepolia
- WETH: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`
- LINK: `0x779877A7B0D9E8603169DdBD7836e478b4624789`
- Explorer: https://sepolia.etherscan.io

---

**PENTING:** Ini adalah testnet. Jangan gunakan private key dari wallet yang berisi dana real!
