# Troubleshooting 500 Error

**Error**: `POST http://localhost:8000/api/eip7702/execute 500 (Internal Server Error)`
**Status**: ⚠️ INVESTIGATING

---

## Added Debug Logging

Saya sudah menambahkan logging di `backend/routes/eip7702.py` untuk melihat error detail.

### Next Steps

**1. Restart Backend**:
```bash
./stop-zerotoll.sh
./start-zerotoll.sh
```

**2. Test Swap Lagi**

**3. Check Backend Logs**:
```bash
# Windows PowerShell
Get-Content .pids/backend.log | Select-Object -Last 50
```

Look for:
```
🚀 Executing EIP-7702 swap on chain 80002
📤 Relayer return code: ...
📤 Relayer stdout: ...
📤 Relayer stderr: ...
```

---

## Possible Causes

### 1. Relayer Wallet Has No Gas ⚠️

**Check Balance**:
- Amoy: https://amoy.polygonscan.com/address/0xf304eed846d82a91d688d1bc1a4fa692051d1d7a
- Sepolia: https://sepolia.etherscan.io/address/0xf304eed846d82a91d688d1bc1a4fa692051d1d7a

**Solution**: Fund wallet from faucet
- Amoy: https://faucet.polygon.technology/ (need 0.1 POL)
- Sepolia: https://sepoliafaucet.com/ (need 0.01 ETH)

### 2. RPC Connection Issue

**Test RPC**:
```bash
curl https://rpc-amoy.polygon.technology \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Expected**: Should return block number

**Solution**: Try alternative RPC:
```bash
# In .env
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/demo
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/demo
```

### 3. Relayer Script Error

**Test Relayer Directly**:
```bash
cd backend
node eip7702-relayer.mjs health 80002
```

**Expected Output**:
```json
{
  "healthy": true,
  "chainId": 80002,
  "relayer": "0xf304eed846d82a91d688d1bc1a4fa692051d1d7a",
  "balance": "0.1",
  "delegate": "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C"
}
```

**If No Output**: Relayer script has error

### 4. EIP-7702 Not Supported Yet

EIP-7702 is a **future Ethereum upgrade** (not live yet on testnets).

**Current Status**:
- ❌ Not live on Amoy
- ❌ Not live on Sepolia
- ⏳ Expected in future Ethereum upgrade

**Workaround**: Use mock mode for testing UI

---

## Mock Mode (For Testing UI Only)

Jika EIP-7702 belum live, gunakan mock mode:

### Update backend/routes/eip7702.py

```python
@router.post('/execute')
async def execute_swap(request: ExecuteRequest):
    """Mock execution for testing"""
    import hashlib
    import time
    
    chain_id = request.chainId
    
    # Generate mock txHash
    mock_hash = hashlib.sha256(str(time.time()).encode()).hexdigest()
    
    # Build explorer URL
    if chain_id == 80002:
        explorer_url = f"https://amoy.polygonscan.com/tx/0x{mock_hash}"
    else:
        explorer_url = f"https://sepolia.etherscan.io/tx/0x{mock_hash}"
    
    # Simulate delay
    await asyncio.sleep(2)
    
    return {
        'success': True,
        'txHash': f'0x{mock_hash}',
        'blockNumber': '12345',
        'gasUsed': '150000',
        'amountOut': request.intent['minAmountOut'],
        'explorerUrl': explorer_url,
        'message': '✅ Mock swap (UI testing only)',
        'note': 'EIP-7702 not live yet - this is a mock transaction'
    }
```

**Note**: Mock mode tidak execute on-chain, hanya untuk test UI!

---

## Check Relayer Balance

### PowerShell Script
```powershell
# Check Amoy balance
$response = Invoke-RestMethod -Uri "https://rpc-amoy.polygon.technology" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf304eed846d82a91d688d1bc1a4fa692051d1d7a","latest"],"id":1}'

$balanceWei = [Convert]::ToInt64($response.result, 16)
$balancePOL = $balanceWei / 1e18
Write-Host "Relayer Balance: $balancePOL POL"
```

### Expected
- Minimum: 0.1 POL for testing
- If 0: Fund from faucet

---

## Summary

**Immediate Actions**:
1. ✅ Restart backend (logging added)
2. ⏳ Test swap and check logs
3. ⏳ Check relayer balance
4. ⏳ Verify RPC connection

**Likely Causes**:
1. Relayer has no gas (most common)
2. RPC connection issue
3. EIP-7702 not live yet (use mock mode)

**Next**: Restart backend, test swap, dan share backend logs untuk diagnosis lebih lanjut.

---

**Status**: ⚠️ Waiting for logs after restart
