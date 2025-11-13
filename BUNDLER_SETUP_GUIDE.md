# Phase 2: Self-Hosted Bundler Setup Guide

**Date:** November 10, 2025  
**Bundler:** Infinitism Reference Implementation (eth-infinitism/bundler)  
**Status:** Ready for deployment

---

## Executive Summary

This guide walks through setting up a self-hosted ERC-4337 bundler using the Infinitism reference implementation. This bundler will submit UserOperations to the EntryPoint on behalf of users, with gas costs sponsored by our Paymaster.

**Why Infinitism over Stackup:**
- ✅ **Actively maintained** (Stackup archived Oct 2024)
- ✅ **Reference implementation** by ERC-4337 creators
- ✅ **Full spec compliance** (passes bundler-spec-tests)
- ✅ **Battle-tested** (373 stars, 30 contributors)
- ✅ **TypeScript/Node.js** (easier integration with our stack)

---

## 1. Architecture Overview

```
User Wallet (MetaMask)
    ↓ (signs UserOperation)
Frontend (ZeroToll)
    ↓ (sends UserOp to bundler)
Bundler (Infinitism - localhost:3000/rpc)
    ↓ (validates, bundles, submits)
EntryPoint (0x0000000071727De22E5E9d8BAf0edAc6f37da032)
    ↓ (calls Paymaster for gas sponsorship)
Paymaster (TestPaymasterAcceptAll)
    ↓ (approves, sponsors gas)
EntryPoint → RouterHub.executeRoute()
    ↓ (executes swap, deducts 0.5% fee)
Paymaster (receives fee in output token)
```

---

## 2. System Requirements

### Hardware (VPS or Local)

**Minimum:**
- 2 CPU cores
- 4 GB RAM
- 50 GB SSD
- 10 Mbps network

**Recommended:**
- 4 CPU cores
- 8 GB RAM
- 100 GB SSD
- 100 Mbps network

### Software

- **OS:** Ubuntu 22.04 LTS (or macOS, Windows with WSL2)
- **Node.js:** v18.0.0+ (LTS recommended)
- **Yarn:** v1.22.0+
- **RPC Node:** Archive node with `debug_traceCall` support
- **Optional:** Docker (if running Geth locally)

---

## 3. RPC Node Requirements

**Critical:** The bundler requires a node with `debug_traceCall` JavaScript tracer support for opcode banning and storage access validation.

### Option A: Use Public RPC (Testnet Only)

**Amoy (Polygon):**
- Public RPC: `https://rpc-amoy.polygon.technology`
- ⚠️ **Problem:** Public nodes don't support `debug_traceCall`
- ✅ **Solution:** Run with `--unsafe` flag (testnet acceptable)

**Sepolia (Ethereum):**
- Public RPC: `https://sepolia.infura.io/v3/YOUR_KEY`
- ⚠️ **Problem:** Infura doesn't support `debug_traceCall`
- ✅ **Solution:** Run with `--unsafe` flag (testnet acceptable)

### Option B: Run Local Geth (Production Recommended)

```bash
docker run --rm -ti --name geth -p 8545:8545 ethereum/client-go:v1.13.5 \
  --miner.gaslimit 12000000 \
  --http --http.api personal,eth,net,web3,debug \
  --http.vhosts '*,localhost,host.docker.internal' --http.addr "0.0.0.0" \
  --allow-insecure-unlock --rpc.allow-unprotected-txs \
  --dev \
  --verbosity 2 \
  --nodiscover --maxpeers 0 --mine \
  --networkid 1337
```

### Option C: Use Archive Node Provider (Production)

**Alchemy:**
- Supports `debug_traceCall` on paid plans
- Configure: `https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY`

**QuickNode:**
- Supports debug APIs on add-on packages
- Configure: `https://your-endpoint.quiknode.pro/YOUR_KEY`

---

## 4. Installation Steps

### Step 1: Clone Repository

```bash
cd /home/abeachmad
git clone https://github.com/eth-infinitism/bundler.git
cd bundler
```

### Step 2: Install Dependencies

```bash
# Install Node.js dependencies
yarn install

# Preprocess (builds packages)
yarn preprocess
```

### Step 3: Configure Environment

Create `.env` file in bundler root:

```bash
# Bundler configuration
MNEMONIC="your twelve word mnemonic here for bundler wallet"
BUNDLER_PORT=3000

# Network RPCs (Amoy)
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
AMOY_ENTRYPOINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Network RPCs (Sepolia)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
SEPOLIA_ENTRYPOINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032

# Bundler wallet (needs gas for submitting bundles)
# Generate with: yarn run bundler --show-stack-traces --createMnemonic
```

**Security Note:** The bundler wallet needs native tokens (MATIC/ETH) to submit bundles. Fund with ~0.5 ETH/MATIC for testing.

### Step 4: Generate Bundler Wallet

```bash
# This will create a new mnemonic and show the address
cd packages/bundler
yarn run bundler --createMnemonic

# Copy the mnemonic to .env file
# Fund the address with 0.5 MATIC (Amoy) or 0.5 ETH (Sepolia)
```

### Step 5: Verify Configuration

```bash
# Check bundler wallet address
yarn run bundler --show-stack-traces --mnemonic "your mnemonic"

# Should output:
# Bundler address: 0x...
# Balance: ... ETH/MATIC
```

---

## 5. Running the Bundler

### Amoy Testnet (Unsafe Mode)

```bash
cd /home/abeachmad/bundler/packages/bundler

yarn run bundler \
  --network https://rpc-amoy.polygon.technology \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --mnemonic "your twelve word mnemonic" \
  --port 3000 \
  --unsafe
```

**Flags:**
- `--network`: RPC endpoint
- `--entryPoint`: EntryPoint v0.7 address
- `--mnemonic`: Bundler wallet mnemonic
- `--port`: HTTP server port (default 3000)
- `--unsafe`: Skip `debug_traceCall` checks (testnet only!)

### Sepolia Testnet (Unsafe Mode)

```bash
yarn run bundler \
  --network https://sepolia.infura.io/v3/YOUR_KEY \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --mnemonic "your twelve word mnemonic" \
  --port 3001 \
  --unsafe
```

### Production Mode (with Geth)

```bash
# Run Geth in another terminal first (see Option B above)

yarn run bundler \
  --network http://localhost:8545 \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --mnemonic "your twelve word mnemonic" \
  --port 3000
  # No --unsafe flag! Full validation enabled
```

---

## 6. Testing the Bundler

### Test 1: Health Check

```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "eth_chainId",
    "params": []
  }'

# Expected: {"jsonrpc":"2.0","id":1,"result":"0x13882"} (Amoy = 80002)
```

### Test 2: Get Supported EntryPoints

```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "eth_supportedEntryPoints",
    "params": []
  }'

# Expected: {"jsonrpc":"2.0","id":1,"result":["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]}
```

### Test 3: Submit UserOperation (Advanced)

This requires constructing a valid UserOperation. We'll use the `runop` script from Infinitism:

```bash
cd /home/abeachmad/bundler/packages/bundler

yarn run runop \
  --deployFactory \
  --network http://localhost:3000/rpc \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032

# This will:
# 1. Deploy a SimpleAccountFactory (if needed)
# 2. Create a random signer
# 3. Fund the counterfactual wallet address
# 4. Submit a UserOp to create the wallet
# 5. Submit another UserOp on the existing wallet
```

---

## 7. Integration with ZeroToll

### Frontend Configuration

Update `frontend/src/config/bundler.js`:

```javascript
export const BUNDLER_CONFIG = {
  amoy: {
    url: process.env.REACT_APP_BUNDLER_URL || 'http://localhost:3000/rpc',
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  },
  sepolia: {
    url: process.env.REACT_APP_BUNDLER_URL || 'http://localhost:3001/rpc',
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  }
};
```

### Backend Configuration (Optional)

If building a policy server, configure bundler endpoint:

```python
# backend/.env
BUNDLER_AMOY_URL=http://localhost:3000/rpc
BUNDLER_SEPOLIA_URL=http://localhost:3001/rpc
ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

---

## 8. UserOperation Flow

### 1. User Initiates Swap (Frontend)

```javascript
// User clicks "Swap" button
const intent = {
  user: userAddress,
  tokenIn: WMATIC_ADDRESS,
  amtIn: parseUnits("1", 18),
  tokenOut: USDC_ADDRESS,
  minOut: parseUnits("0.9", 6),
  dstChainId: 0,
  deadline: Math.floor(Date.now() / 1000) + 3600,
  feeToken: ZERO_ADDRESS,
  feeMode: 0,
  feeCapToken: 0,
  routeHint: "0x",
  nonce: await getUserNonce(userAddress)
};

// Get Odos quote
const odosQuote = await fetch("https://api.odos.xyz/sor/quote/v2", {
  method: "POST",
  body: JSON.stringify({
    chainId: 80002,
    inputTokens: [{ tokenAddress: WMATIC_ADDRESS, amount: "1000000000000000000" }],
    outputTokens: [{ tokenAddress: USDC_ADDRESS, proportion: 1 }],
    userAddr: userAddress,
    slippageLimitPercent: 0.5,
  })
});

const routeData = odosQuote.pathId; // Odos route identifier
```

### 2. Build UserOperation

```javascript
const userOp = {
  sender: userAddress, // User's smart account (not EOA!)
  nonce: await getNonce(userAddress, entryPoint),
  initCode: "0x", // Empty if account already deployed
  callData: routerHub.interface.encodeFunctionData("executeRoute", [
    intent,
    ODOS_ADAPTER_ADDRESS,
    routeData
  ]),
  callGasLimit: 200000,
  verificationGasLimit: 100000,
  preVerificationGas: 50000,
  maxFeePerGas: await provider.getGasPrice(),
  maxPriorityFeePerGas: parseUnits("1", "gwei"),
  paymasterAndData: PAYMASTER_ADDRESS, // Paymaster sponsors gas!
  signature: "0x" // Will be filled after user signs
};
```

### 3. User Signs UserOperation

```javascript
const userOpHash = await entryPoint.getUserOpHash(userOp);
const signature = await signer.signMessage(arrayify(userOpHash));
userOp.signature = signature;
```

### 4. Submit to Bundler

```javascript
const response = await fetch("http://localhost:3000/rpc", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_sendUserOperation",
    params: [userOp, ENTRYPOINT_ADDRESS]
  })
});

const { result: userOpHash } = await response.json();
console.log("UserOp submitted:", userOpHash);
```

### 5. Bundler Processes

1. **Validation:** Bundler validates UserOp (signature, gas limits, nonce)
2. **Paymaster Check:** Calls `Paymaster.validatePaymasterUserOp()`
   - TestPaymasterAcceptAll returns `(0, "")` → approved!
3. **Bundling:** Bundler batches multiple UserOps together
4. **Submission:** Bundler calls `EntryPoint.handleOps([userOp], bundlerAddress)`
5. **Execution:**
   - EntryPoint validates UserOp
   - Calls Paymaster for gas sponsorship
   - Executes `userOp.callData` (RouterHub.executeRoute)
   - Calls `Paymaster.postOp()` (no-op in Phase 2)
6. **Fee Collection:** RouterHub deducts 0.5% from swap output, sends to Paymaster

### 6. Frontend Polls for Receipt

```javascript
// Poll for UserOp receipt
const pollReceipt = async (userOpHash) => {
  for (let i = 0; i < 30; i++) {
    const response = await fetch("http://localhost:3000/rpc", {
      method: "POST",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getUserOperationReceipt",
        params: [userOpHash]
      })
    });
    
    const { result } = await response.json();
    if (result) {
      console.log("UserOp executed:", result.transactionHash);
      return result;
    }
    
    await new Promise(r => setTimeout(r, 2000)); // Wait 2s
  }
  throw new Error("UserOp timeout");
};
```

---

## 9. Monitoring & Maintenance

### Logs

Bundler logs are output to console. Redirect to file:

```bash
yarn run bundler --network ... 2>&1 | tee bundler-amoy.log
```

### Key Metrics to Monitor

1. **Bundler Wallet Balance**
   - Check: `eth_getBalance` on bundler address
   - Alert if < 0.1 ETH/MATIC
   - Refill periodically

2. **Paymaster Balance**
   - Check: `Paymaster.getDeposit()`
   - Alert if < 0.2 ETH/MATIC
   - Refill from fee revenue

3. **UserOp Submission Rate**
   - Monitor: Bundler logs
   - Track: UserOps/minute
   - Alert: If rate drops to 0 (bundler down)

4. **Failed UserOps**
   - Monitor: `eth_getUserOperationReceipt` with `success: false`
   - Alert: If failure rate > 5%
   - Investigate: Gas estimation, Paymaster validation

### Restart Script

Create `/home/abeachmad/restart-bundler.sh`:

```bash
#!/bin/bash
cd /home/abeachmad/bundler/packages/bundler

# Kill existing bundler
pkill -f "yarn run bundler"

# Wait for process to die
sleep 2

# Start bundler (Amoy)
nohup yarn run bundler \
  --network https://rpc-amoy.polygon.technology \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --mnemonic "$(cat /home/abeachmad/.bundler-mnemonic)" \
  --port 3000 \
  --unsafe \
  > /home/abeachmad/logs/bundler-amoy.log 2>&1 &

echo "Bundler restarted on port 3000"
```

Make executable: `chmod +x restart-bundler.sh`

### Systemd Service (Production)

Create `/etc/systemd/system/bundler-amoy.service`:

```ini
[Unit]
Description=ERC-4337 Bundler (Amoy)
After=network.target

[Service]
Type=simple
User=abeachmad
WorkingDirectory=/home/abeachmad/bundler/packages/bundler
ExecStart=/usr/bin/yarn run bundler --network https://rpc-amoy.polygon.technology --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 --mnemonic "your mnemonic" --port 3000 --unsafe
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable bundler-amoy
sudo systemctl start bundler-amoy
sudo systemctl status bundler-amoy
```

View logs:
```bash
sudo journalctl -u bundler-amoy -f
```

---

## 10. Security Considerations

### Testnet (Current Phase 2)

**Acceptable Risks:**
- ✅ `--unsafe` mode (no `debug_traceCall` validation)
- ✅ Public RPC endpoints (no SLA)
- ✅ TestPaymasterAcceptAll (accepts all UserOps)
- ✅ Single bundler instance (no redundancy)

**Why Acceptable:**
- Testnet tokens have no value
- Limited attack surface (only test transactions)
- Quick iteration needed for development

### Production (Phase 4+)

**Required Changes:**
- ❌ Remove `--unsafe` flag
- ✅ Use archive node with `debug_traceCall`
- ✅ Deploy VerifyingPaymaster (signature validation)
- ✅ Multi-region bundler deployment (redundancy)
- ✅ Rate limiting per IP/wallet
- ✅ DDoS protection (Cloudflare, etc.)
- ✅ Monitoring + alerting (Grafana, PagerDuty)
- ✅ Bundler wallet with hardware security module (HSM)

---

## 11. Cost Analysis

### VPS Hosting (Monthly)

| Provider | Specs | Price | Notes |
|----------|-------|-------|-------|
| **Hetzner** | 4 vCPU, 8GB RAM, 160GB | ~$10/mo | Best value |
| **DigitalOcean** | 4 vCPU, 8GB RAM, 160GB | ~$48/mo | Easy setup |
| **AWS t3.large** | 2 vCPU, 8GB RAM | ~$60/mo | Reliable, expensive |
| **Contabo** | 4 vCPU, 8GB RAM, 200GB | ~$7/mo | Cheapest, mixed reviews |

**Recommendation:** Hetzner CPX31 (4 vCPU, 8GB RAM) - excellent performance/price ratio

### Gas Costs (Bundler Wallet)

**Testnet:**
- Cost per bundle submission: ~$0.001
- Expected volume: 100 UserOps/day
- Monthly gas cost: ~$3 (negligible)

**Mainnet (Future):**
- Cost per bundle submission: $0.10 - $1.00 (depending on gas prices)
- Expected volume: 1000 UserOps/day
- Monthly gas cost: $3,000 - $30,000
- **Revenue from fees:** Must exceed gas costs for sustainability

### Total Monthly Cost (Testnet)

| Item | Cost |
|------|------|
| VPS (Hetzner) | $10 |
| Gas (bundler wallet) | ~$3 |
| RPC (public, free) | $0 |
| **TOTAL** | **$13/mo** |

**Phase 3 additions:**
- Policy server backend (same VPS) | $0
- **TOTAL Phase 3** | **$13/mo**

---

## 12. Troubleshooting

### Issue 1: "Error: nonce too low"

**Cause:** Bundler wallet already submitted a transaction with this nonce

**Solution:**
```bash
# Check current nonce
cast nonce 0xYourBundlerAddress --rpc-url https://rpc-amoy.polygon.technology

# Reset bundler (kills process, clears mempool)
pkill -f "yarn run bundler"
./restart-bundler.sh
```

### Issue 2: "Error: insufficient funds"

**Cause:** Bundler wallet has insufficient MATIC/ETH for gas

**Solution:**
```bash
# Check balance
cast balance 0xYourBundlerAddress --rpc-url https://rpc-amoy.polygon.technology

# Fund bundler wallet with 0.5 MATIC/ETH
```

### Issue 3: "Error: AA21 didn't pay prefund"

**Cause:** Paymaster has insufficient deposit in EntryPoint

**Solution:**
```bash
cd /home/abeachmad/ZeroToll/packages/contracts

# Check Paymaster deposit
npx hardhat console --network amoy
> const Paymaster = await ethers.getContractAt("TestPaymasterAcceptAll", "0x620138B987C5EE4fb2476a2D409d67979D0AE50F")
> await Paymaster.getDeposit()

# Deposit more funds
> await Paymaster.deposit({ value: ethers.parseEther("0.5") })
```

### Issue 4: "Error: AA23 reverted (or OOG)"

**Cause:** UserOp execution failed (out of gas or revert in RouterHub.executeRoute)

**Solution:**
- Increase `callGasLimit` in UserOp
- Check RouterHub adapter is whitelisted
- Verify intent.minOut is achievable (not too high)
- Check Odos routeData is valid

---

## 13. Next Steps (After Bundler Running)

### Immediate (Next Session)

1. ✅ **Clone Infinitism bundler** → `/home/abeachmad/bundler`
2. ✅ **Install dependencies** → `yarn install && yarn preprocess`
3. ✅ **Generate bundler wallet** → `yarn run bundler --createMnemonic`
4. ✅ **Fund bundler wallet** → Send 0.5 MATIC to bundler address
5. ✅ **Start bundler (Amoy)** → `yarn run bundler --network ... --unsafe`
6. ✅ **Test health check** → `curl http://localhost:3000/rpc`

### Short-term (Same Session)

7. ⏳ **Test UserOp submission** → `yarn run runop --network http://localhost:3000/rpc`
8. ⏳ **Integrate with frontend** → Update bundler config
9. ⏳ **Test gasless swap flow** → Submit swap UserOp via bundler

### Medium-term (Phase 3)

10. ⏳ **Build policy server** → Express.js API for Paymaster validation
11. ⏳ **Deploy VerifyingPaymaster** → Replace TestPaymasterAcceptAll
12. ⏳ **Remove --unsafe flag** → Use archive node with debug_traceCall

---

## 14. Quick Reference Commands

### Start Bundler (Amoy)
```bash
cd /home/abeachmad/bundler/packages/bundler
yarn run bundler \
  --network https://rpc-amoy.polygon.technology \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --mnemonic "your mnemonic" \
  --port 3000 \
  --unsafe
```

### Check Bundler Health
```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```

### Submit Test UserOp
```bash
cd /home/abeachmad/bundler/packages/bundler
yarn run runop \
  --network http://localhost:3000/rpc \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### Check Bundler Wallet Balance
```bash
cast balance 0xYourBundlerAddress --rpc-url https://rpc-amoy.polygon.technology
```

### View Bundler Logs (if running as service)
```bash
sudo journalctl -u bundler-amoy -f
```

---

**END OF BUNDLER SETUP GUIDE**
