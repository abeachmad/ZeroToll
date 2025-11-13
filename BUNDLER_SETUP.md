# Bundler Setup Complete

**Date:** November 10, 2025  
**Bundler:** Infinitism (eth-infinitism/bundler) - Reference implementation  
**Status:** ✅ INSTALLED & CONFIGURED

---

## Installation Summary

### Repository
- **Source:** https://github.com/eth-infinitism/bundler
- **Type:** Reference ERC-4337 bundler (TypeScript/Node.js)
- **Location:** `/home/abeachmad/ZeroToll/bundler-infinitism`

### Installation Steps Completed
1. ✅ Cloned Infinitism bundler repository
2. ✅ Installed dependencies (`yarn install`)
3. ✅ Preprocessed contracts (`yarn preprocess`)
4. ✅ Generated bundler wallet mnemonic
5. ✅ Created startup scripts

---

## Bundler Wallet

⚠️ **IMPORTANT: Fund this address before starting the bundler**

**Mnemonic:** 
```
story object decorate advance fitness wrestle delay entire next crater test toddler
```

**Derived Address:** `0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e`  
**Private Key:** `0x2dbb884d4769fc4870e28a9d21f4a424943a08f62064356618e6db34c877aaea`

**Current Balance:** 0 MATIC (NEEDS FUNDING)

### Funding Instructions

**Amoy Testnet:**
1. Get testnet MATIC from faucet: https://faucet.polygon.technology/
2. Send to: `0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e`
3. Recommended amount: **1-2 MATIC** (for gas fees)

**Why fund?** The bundler needs MATIC to:
- Submit bundled UserOperations to the network
- Pay gas fees for on-chain transactions
- Receive beneficiary fees

---

## Configuration

### Amoy Testnet Setup

| Parameter | Value |
|-----------|-------|
| **Network RPC** | https://rpc-amoy.polygon.technology |
| **Chain ID** | 80002 |
| **EntryPoint** | 0x0000000071727De22E5E9d8BAf0edAc6f37da032 |
| **Bundler Address** | 0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e |
| **Beneficiary** | 0x330A86eE67bA0Da0043EaD201866A32d362C394c (deployer) |
| **Port** | 3000 |
| **Mode** | Unsafe (testnet - no storage/opcode checks) |
| **Auto-bundling** | Enabled (3s interval) |

### Files Created

1. **`bundler-infinitism/packages/bundler/bundler-new.mnemonic`**  
   Contains the mnemonic phrase for the bundler wallet

2. **`bundler-infinitism/start-bundler.sh`**  
   Startup script with all configuration parameters

3. **`bundler-infinitism/bundler.config.json`**  
   JSON configuration file (reference, not used by startup script)

---

## Starting the Bundler

### Prerequisites
1. ✅ Bundler wallet funded with testnet MATIC
2. ✅ Port 3000 available
3. ✅ Network connectivity to Amoy RPC

### Option 1: Using Startup Script (Recommended)

```bash
cd /home/abeachmad/ZeroToll/bundler-infinitism
./start-bundler.sh
```

### Option 2: Direct Command

```bash
cd /home/abeachmad/ZeroToll/bundler-infinitism
yarn run bundler \
  --network https://rpc-amoy.polygon.technology \
  --mnemonic bundler-new.mnemonic \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --beneficiary 0x330A86eE67bA0Da0043EaD201866A32d362C394c \
  --minBalance 0.1 \
  --unsafe \
  --port 3000 \
  --auto \
  --autoBundleInterval 3000
```

### Expected Output

```
command-line arguments: {
  network: 'https://rpc-amoy.polygon.technology',
  mnemonic: 'bundler-new.mnemonic',
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  beneficiary: '0x330A86eE67bA0Da0043EaD201866A32d362C394c',
  unsafe: true,
  port: '3000',
  auto: true
}
Merged configuration: {...}
Signer address: 0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e
Listening on http://localhost:3000
```

---

## Testing the Bundler

### Health Check

```bash
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "eth_chainId",
    "params": []
  }'
```

**Expected Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x13882"
}
```

### Supported RPC Methods

**Standard ERC-4337 Methods:**
- `eth_sendUserOperation` - Submit UserOperation
- `eth_estimateUserOperationGas` - Estimate gas for UserOp
- `eth_getUserOperationByHash` - Get UserOp details
- `eth_getUserOperationReceipt` - Get UserOp receipt
- `eth_supportedEntryPoints` - List supported EntryPoints

**Debug Methods (if `--debugRpc` enabled):**
- `debug_bundler_clearState`
- `debug_bundler_dumpMempool`
- `debug_bundler_sendBundleNow`
- `debug_bundler_setBundlingMode`
- `debug_bundler_setReputation`
- `debug_bundler_dumpReputation`

---

## Integration with ZeroToll

### Frontend Integration

To submit gasless swaps via the bundler, the frontend needs to:

1. **Create UserOperation**
   ```javascript
   const userOp = {
     sender: walletAddress,
     nonce: await getNonce(),
     callData: routerHub.interface.encodeFunctionData('executeRoute', [intent, adapter, routeData]),
     callGasLimit: 300000,
     verificationGasLimit: 150000,
     preVerificationGas: 21000,
     maxFeePerGas: await getMaxFeePerGas(),
     maxPriorityFeePerGas: await getMaxPriorityFeePerGas(),
     paymasterAndData: paymasterAddress,
     signature: '0x'
   };
   ```

2. **Sign UserOperation**
   ```javascript
   const userOpHash = await entryPoint.getUserOpHash(userOp);
   const signature = await signer.signMessage(arrayify(userOpHash));
   userOp.signature = signature;
   ```

3. **Submit to Bundler**
   ```javascript
   const response = await fetch('http://localhost:3000/rpc', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       jsonrpc: '2.0',
       id: 1,
       method: 'eth_sendUserOperation',
       params: [userOp, entryPointAddress]
     })
   });
   const { result } = await response.json();
   console.log('UserOp hash:', result);
   ```

4. **Wait for Confirmation**
   ```javascript
   const receipt = await waitForUserOpReceipt(result);
   console.log('Swap executed:', receipt.transactionHash);
   ```

### Backend Policy Server Integration (Phase 3)

The policy server will:
1. Receive UserOperation from frontend
2. Validate:
   - Target = RouterHub.executeRoute only
   - Token whitelist (WMATIC, USDC, LINK)
   - Rate limiting (10 swaps/day/wallet)
   - Gas cost vs fee check
3. Sign UserOperation with VerifyingPaymaster
4. Return signed UserOp to frontend
5. Frontend submits to bundler

---

## Monitoring

### Check Bundler Logs

```bash
# If running in foreground
# Logs appear in terminal

# If running in background
tail -f /tmp/bundler.log  # (if redirected to file)
```

### Check Bundler Balance

```bash
# Check MATIC balance
curl https://rpc-amoy.polygon.technology \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": ["0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e", "latest"],
    "id": 1
  }'
```

### Monitor UserOperations

```bash
# Get mempool status (if debug RPC enabled)
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "debug_bundler_dumpMempool",
    "params": ["0x0000000071727De22E5E9d8BAf0edAc6f37da032"]
  }'
```

---

## Troubleshooting

### Issue: "Unable to read --mnemonic"

**Cause:** Mnemonic file not found or invalid format

**Solution:**
```bash
cd /home/abeachmad/ZeroToll/bundler-infinitism/packages/bundler
cat bundler-new.mnemonic  # Should show 12-word phrase
```

### Issue: "Insufficient funds"

**Cause:** Bundler wallet has no MATIC

**Solution:**
1. Check balance: https://www.oklink.com/amoy/address/0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e
2. Fund from faucet: https://faucet.polygon.technology/
3. Send 1-2 MATIC to bundler address

### Issue: "Port 3000 already in use"

**Cause:** Another service using port 3000

**Solution:**
```bash
# Find process
lsof -i :3000

# Kill if needed
kill -9 <PID>

# Or use different port
yarn run bundler --port 3001 ...
```

### Issue: "Network connection failed"

**Cause:** Amoy RPC endpoint down or slow

**Solution:**
```bash
# Test RPC endpoint
curl https://rpc-amoy.polygon.technology \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Try alternative RPC
--network https://polygon-amoy.drpc.org
```

---

## Security Considerations

### Testnet Security

⚠️ **Current setup is for TESTNET ONLY:**
- `--unsafe` mode skips storage/opcode checks
- TestPaymasterAcceptAll accepts all UserOps
- No rate limiting or validation

### Production Requirements (Phase 3)

Before mainnet deployment:

1. **Remove --unsafe flag**
   - Requires GETH node with `debug_traceCall`
   - Enforces ERC-4337 storage access rules
   - Validates opcode usage

2. **Deploy VerifyingPaymaster**
   - Replace TestPaymasterAcceptAll
   - Require backend signature
   - Policy server validation

3. **Add Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alert on low balance
   - Track bundle success rate

4. **Secure Bundler Wallet**
   - Use HSM or multi-sig
   - Separate hot/cold wallets
   - Regular balance audits

---

## Phase 2 Completion Status

### ✅ Completed

1. **Bundler Installation**
   - Infinitism reference bundler installed
   - Dependencies compiled successfully
   - Startup scripts created

2. **Wallet Generation**
   - New mnemonic generated
   - Address derived: 0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e
   - Private key extracted

3. **Configuration**
   - Amoy testnet configured
   - EntryPoint set (v0.7)
   - Auto-bundling enabled
   - Unsafe mode for testnet

### ⏳ Pending

4. **Funding**
   - Bundler wallet needs 1-2 MATIC
   - User action required: Visit faucet

5. **Testing**
   - Submit test UserOperation
   - Verify bundling works
   - Check transaction on block explorer

6. **Sepolia Setup** (Optional)
   - Configure for Sepolia testnet
   - Generate separate wallet or reuse same
   - Test dual-network operation

---

## Next Steps (Phase 3)

1. **Policy Server Backend**
   - Express.js API
   - `/api/paymaster/sponsor` endpoint
   - Rate limiting implementation
   - ECDSA signing service

2. **VerifyingPaymaster Deployment**
   - Deploy to Amoy + Sepolia
   - Configure backend signer
   - Migrate funds from TestPaymaster
   - Test signature validation

3. **Frontend Integration**
   - UserOperation builder
   - Bundler RPC client
   - Transaction status tracking
   - Error handling

4. **End-to-End Testing**
   - Gasless swap flow
   - Fee collection verification
   - Edge case testing
   - Performance benchmarking

---

## Useful Commands

### Bundler Management

```bash
# Start bundler
cd /home/abeachmad/ZeroToll/bundler-infinitism
./start-bundler.sh

# Stop bundler
pkill -f "bundler --network"

# View logs (if redirected)
tail -f bundler.log

# Check if running
ps aux | grep bundler
```

### Wallet Management

```bash
# Show bundler address
cd /home/abeachmad/ZeroToll/bundler-infinitism
node -e "const ethers = require('ethers'); const mnemonic = require('fs').readFileSync('packages/bundler/bundler-new.mnemonic', 'utf8').trim(); console.log(ethers.Wallet.fromMnemonic(mnemonic).address);"

# Check balance
curl https://rpc-amoy.polygon.technology \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e","latest"],"id":1}'
```

### RPC Testing

```bash
# Check supported EntryPoints
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]}'

# Estimate UserOp gas
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"eth_estimateUserOperationGas",
    "params":[<USER_OP>, "0x0000000071727De22E5E9d8BAf0edAc6f37da032"]
  }'
```

---

## References

- **Infinitism Bundler:** https://github.com/eth-infinitism/bundler
- **ERC-4337 Spec:** https://eips.ethereum.org/EIPS/eip-4337
- **Amoy Testnet:** https://polygon.technology/blog/introducing-the-amoy-testnet-for-polygon-pos
- **EntryPoint v0.7:** https://github.com/eth-infinitism/account-abstraction/releases/tag/v0.7.0

---

**STATUS:** ✅ Bundler installed and configured. Fund wallet to proceed with testing.

**Next Action:** Send 1-2 MATIC to `0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e` from Polygon faucet.

