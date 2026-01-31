# Relayer Setup Required

**Error**: Backend execution failing with 500 error
**Root Cause**: `RELAYER_PRIVATE_KEY` not configured in `.env`
**Status**: ⚠️ SETUP REQUIRED

---

## Problem

Backend execute endpoint returns 500 error karena relayer tidak punya private key untuk sign dan send transactions.

### Error Flow
```
Frontend → Backend → Relayer → ❌ No RELAYER_PRIVATE_KEY
```

### Console Error
```
POST http://localhost:8000/api/eip7702/execute 500 (Internal Server Error)
Error: Swap execution failed
```

---

## Solution: Add RELAYER_PRIVATE_KEY

### Step 1: Generate atau Use Existing Private Key

**Option A: Generate New Key (Recommended for Testing)**
```bash
# Generate new wallet
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

**Option B: Use Existing Testnet Wallet**
- Export private key dari MetaMask
- Pastikan wallet punya testnet POL/ETH untuk gas

### Step 2: Add to .env

Edit `.env` file dan tambahkan:
```bash
# Relayer private key (signs UserOps, pays gas in relayer mode)
RELAYER_PRIVATE_KEY=your_private_key_here_without_0x
```

**IMPORTANT**: 
- Remove `0x` prefix!
- Example: `abc123def456...` NOT `0xabc123def456...`

### Step 3: Fund Relayer Wallet

Relayer perlu native tokens untuk pay gas:

**Polygon Amoy (POL)**:
- Faucet: https://faucet.polygon.technology/
- Minimum: 0.1 POL untuk testing

**Ethereum Sepolia (ETH)**:
- Faucet: https://sepoliafaucet.com/
- Minimum: 0.01 ETH untuk testing

### Step 4: Restart Backend

```bash
./stop-zerotoll.sh
./start-zerotoll.sh
```

---

## Verification

### Check Relayer Health
```bash
cd backend
node eip7702-relayer.mjs health 80002
```

**Expected Output**:
```json
{
  "healthy": true,
  "chainId": 80002,
  "relayer": "0x...",
  "balance": "0.1",
  "delegate": "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
}
```

### Check Relayer Balance
```bash
# Amoy
node eip7702-relayer.mjs health 80002

# Sepolia
node eip7702-relayer.mjs health 11155111
```

---

## Security Notes

### ⚠️ NEVER Commit Private Keys!

**DO**:
- Use `.env` file (already in `.gitignore`)
- Use separate wallet for relayer (not your main wallet)
- Use testnet wallets only
- Keep minimum balance needed

**DON'T**:
- Commit `.env` to git
- Use mainnet private keys
- Share private keys
- Use wallet with large balances

### Relayer Wallet Best Practices

1. **Separate Wallet**: Create dedicated wallet for relayer
2. **Minimum Balance**: Keep only what's needed for testing
3. **Monitor Balance**: Check balance regularly
4. **Rotate Keys**: Change keys periodically
5. **Testnet Only**: Never use mainnet keys for testing

---

## Alternative: Mock Mode (For Frontend Testing Only)

Jika Anda hanya ingin test frontend tanpa execute on-chain, bisa gunakan mock mode:

### Update backend/routes/eip7702.py

```python
@router.post('/execute')
async def execute_swap(request: ExecuteRequest):
    """Mock execution for frontend testing"""
    
    # Generate mock txHash
    import hashlib
    import time
    mock_hash = hashlib.sha256(str(time.time()).encode()).hexdigest()
    
    # Build explorer URL
    chain_id = request.chainId
    if chain_id == 80002:
        explorer_url = f"https://amoy.polygonscan.com/tx/0x{mock_hash}"
    else:
        explorer_url = f"https://sepolia.etherscan.io/tx/0x{mock_hash}"
    
    return {
        'success': True,
        'txHash': f'0x{mock_hash}',
        'blockNumber': '12345',
        'gasUsed': '150000',
        'amountOut': '9900',
        'explorerUrl': explorer_url,
        'message': 'Mock swap (not on-chain)',
        'note': 'Add RELAYER_PRIVATE_KEY to .env for real execution'
    }
```

**Note**: Mock mode hanya untuk test UI, tidak ada transaction on-chain!

---

## Troubleshooting

### Error: "Cannot read private key"
**Solution**: Check `.env` format, remove `0x` prefix

### Error: "Insufficient funds"
**Solution**: Fund relayer wallet from faucet

### Error: "Invalid private key"
**Solution**: Verify private key is correct (64 hex characters)

### Error: "Network not supported"
**Solution**: Check RPC URLs in `.env`

---

## Summary

Untuk execute swap on-chain, Anda perlu:

1. ✅ Add `RELAYER_PRIVATE_KEY` to `.env`
2. ✅ Fund relayer wallet dengan testnet tokens
3. ✅ Restart backend
4. ✅ Test dengan `node eip7702-relayer.mjs health 80002`

**Alternative**: Use mock mode untuk test frontend only (no on-chain execution)

---

## Next Steps

### After Setup
1. Add RELAYER_PRIVATE_KEY to .env
2. Fund wallet from faucet
3. Restart backend: `./start-zerotoll.sh`
4. Test swap execution
5. Verify transaction on explorer

### Expected Result
- Swap executes on-chain ✅
- Transaction hash returned ✅
- Explorer link clickable ✅
- Native tokens received ✅

**Status**: ⚠️ Waiting for RELAYER_PRIVATE_KEY configuration
