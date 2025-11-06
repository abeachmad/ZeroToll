# 💡 STRATEGI PAYMASTER & GASLESS APPROVAL - Rencana Implementasi

**Date:** November 7, 2025  
**Topic:** ERC-4337 Account Abstraction + Paymaster untuk ZeroToll  
**Goal:** User bisa swap tanpa perlu native token untuk gas fee

---

## 📋 RINGKASAN DISKUSI DENGAN GPT-5

### Temuan Kunci Anda (BENAR 100%):

1. ✅ **"Approve tetap butuh gas native"** - CORRECT!
   - Setiap kali user klik "Approve" di MetaMask → butuh POL/ETH untuk gas
   - Ini barrier besar untuk onboarding user baru

2. ✅ **"Relayer + Paymaster seharusnya cover gas"** - CORRECT!
   - Itulah tujuan ERC-4337 Account Abstraction
   - Paymaster = "dompet sponsor" yang bayar gas untuk user
   - User cukup **signature** (gratis), tidak perlu native token

3. ✅ **"Fee dipotong dari swap lebih masuk akal"** - CORRECT!
   - Paymaster bayar gas dulu → potong fee dari token swap → top-up deposit
   - User experience mulus: input USDC, output WMATIC - fee, DONE!

### Flow Yang Benar (Yang Anda Pahami):

```
SEKARANG (MASIH BUTUH GAS):
User → [Approve USDC] → Butuh POL/ETH ❌
     → [Execute Swap] → Butuh POL/ETH ❌
     
IDEAL (GASLESS):
User → [Sign Permit] → GRATIS (off-chain signature) ✅
     → Relayer submit TX → Paymaster bayar gas ✅
     → Potong fee dari swap → Paymaster di-reimburse ✅
     → User terima output token - fee ✅
```

---

## 🎯 STRATEGI IMPLEMENTASI (3 FASE)

### FASE 1: Quick Win - EIP-2612 Permit (2-3 hari)

**Target:** Token yang support `permit()` function

**Cara Kerja:**
```solidity
// User tanda tangan off-chain (GRATIS):
permit(owner, spender, value, deadline, v, r, s)

// Relayer kirim TX dengan signature user:
token.permit(user, routerHub, amount, deadline, v, r, s)
// ↓ Approval granted TANPA user bayar gas
routerHub.executeRoute(intent, adapter, routeData)
// ↓ Swap executed
// ↓ Fee dipotong dari output
// ↓ Paymaster di-reimburse
```

**Token Support:**
- ✅ WETH (Wrapped ETH) - ada `permit`
- ✅ WPOL (Wrapped MATIC) - ada `permit`  
- ❌ USDC (Amoy/Sepolia) - **TIDAK ADA** `permit` di testnet
- ❌ LINK - tergantung deployment

**Implementation Steps:**

1. **Check Token Support**
```python
# backend/token_permit_checker.py
from web3 import Web3

def has_permit(token_address, w3):
    """Check if token supports EIP-2612 permit"""
    abi = [{
        "name": "permit",
        "type": "function",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
            {"name": "v", "type": "uint8"},
            {"name": "r", "type": "bytes32"},
            {"name": "s", "type": "bytes32"}
        ]
    }]
    
    token = w3.eth.contract(address=token_address, abi=abi)
    try:
        # Check if function exists
        token.functions.permit
        return True
    except:
        return False
```

2. **Frontend: Generate Permit Signature**
```javascript
// frontend/src/utils/permitSignature.js
import { signTypedData } from '@wagmi/core'

export async function signPermit(token, owner, spender, value, deadline) {
  const domain = {
    name: await token.name(),
    version: '1',
    chainId: await token.chainId(),
    verifyingContract: token.address
  }
  
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  }
  
  const nonce = await token.nonces(owner)
  
  const message = {
    owner,
    spender,
    value,
    nonce,
    deadline
  }
  
  const signature = await signTypedData({ domain, types, message })
  return signature // { v, r, s }
}
```

3. **Backend: Execute with Permit**
```python
# backend/permit_executor.py

def execute_swap_with_permit(intent, permit_data):
    """Execute swap using permit (gasless for user)"""
    
    # Build permit call
    permit_tx = token.functions.permit(
        owner=intent['user'],
        spender=ROUTER_HUB,
        value=intent['amtIn'],
        deadline=permit_data['deadline'],
        v=permit_data['v'],
        r=permit_data['r'],
        s=permit_data['s']
    )
    
    # Build executeRoute call
    execute_tx = router.functions.executeRoute(
        intent, adapter, route_data
    )
    
    # Multicall: permit + execute in ONE transaction
    # Relayer pays gas, user signs for free
    multicall_tx = build_multicall([permit_tx, execute_tx])
    
    # Relayer signs and sends
    signed = relayer_account.sign_transaction(multicall_tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    
    return tx_hash
```

**Pros:**
- ✅ User TIDAK bayar gas untuk approve
- ✅ Implementasi relatif cepat (2-3 hari)
- ✅ Compatible dengan EOA (tidak butuh smart account)

**Cons:**
- ❌ Hanya untuk token yang support `permit`
- ❌ USDC di testnet TIDAK support (harus fallback)

---

### FASE 2: ERC-4337 Account Abstraction + Paymaster (2-3 minggu)

**Target:** SEMUA token, termasuk USDC

**Arsitektur:**

```
User (Smart Account) 
  ↓ sign UserOperation (GRATIS)
  
Bundler
  ↓ submit to EntryPoint
  
EntryPoint
  ↓ validatePaymasterUserOp
  
Paymaster
  ✅ sponsor = true
  ↓ depositTo(EntryPoint) sudah ada balance
  
RouterHub.executeRoute(intent, adapter, routeData)
  ↓ swap executed
  ↓ fee dipotong dari output
  
Paymaster
  ← refund dari fee yang dipotong
```

**Components:**

1. **EntryPoint Contract** (already deployed by ERC-4337)
   - Amoy: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
   - Sepolia: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`

2. **Paymaster Contract** (kita deploy)
```solidity
// contracts/ZeroTollPaymaster.sol
contract ZeroTollPaymaster is BasePaymaster {
    
    struct FeeConfig {
        address feeToken;      // Token untuk bayar fee (USDC/WETH/etc)
        uint256 feeAmount;     // Jumlah fee (dari quote)
        uint256 gasPriceCap;   // Max gas price
        uint256 deadline;      // Expiry
        bytes signature;       // Owner signature
    }
    
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        
        // Decode feeConfig from paymasterAndData
        FeeConfig memory fee = abi.decode(userOp.paymasterAndData[20:], (FeeConfig));
        
        // Validate:
        require(block.timestamp <= fee.deadline, "Expired");
        require(tx.gasprice <= fee.gasPriceCap, "Gas too high");
        require(verifySignature(userOpHash, fee), "Invalid sig");
        
        // Check if we have enough deposit
        require(getDeposit() >= maxCost, "Insufficient deposit");
        
        // Approve sponsor
        return (abi.encode(fee), 0);
    }
    
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override {
        
        FeeConfig memory fee = abi.decode(context, (FeeConfig));
        
        // Pull fee from RouterHub fee collector
        // (RouterHub already deducted fee from swap output)
        IERC20(fee.feeToken).transferFrom(
            FEE_COLLECTOR,
            address(this),
            fee.feeAmount
        );
        
        // Swap fee token → native for EntryPoint deposit
        uint256 nativeAmount = swapToNative(fee.feeToken, fee.feeAmount);
        
        // Top-up EntryPoint deposit
        entryPoint.depositTo{value: nativeAmount}(address(this));
        
        // Log for monitoring
        emit FeeCollected(fee.feeToken, fee.feeAmount, nativeAmount);
    }
}
```

3. **RouterHub Integration**
```solidity
// contracts/RouterHub.sol (add fee collection)

address public feeCollector;  // Paymaster's fee collector address

function executeRoute(
    Intent calldata intent,
    address adapter,
    bytes calldata routeData
) external nonReentrant returns (uint256 amountOut) {
    
    // ... existing swap logic ...
    
    // NEW: Deduct fee based on feeMode
    if (intent.feeMode == FeeMode.TOKEN_INPUT) {
        // Pull tokenIn from user
        uint256 feeAmount = (intent.amtIn * intent.feeCapToken) / 10000;
        IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amtIn);
        
        // Transfer fee to collector
        IERC20(intent.tokenIn).safeTransfer(feeCollector, feeAmount);
        
        // Swap the rest
        uint256 swapAmount = intent.amtIn - feeAmount;
        // ... swap logic ...
        
    } else if (intent.feeMode == FeeMode.TOKEN_OUTPUT) {
        // Swap full amount
        // ... swap logic ...
        
        // Deduct fee from output
        uint256 feeAmount = (grossOut * intent.feeCapToken) / 10000;
        require(grossOut >= intent.minOut + feeAmount, "Slippage + fee");
        
        // Transfer fee to collector
        IERC20(intent.tokenOut).safeTransfer(feeCollector, feeAmount);
        
        // Transfer net to user
        uint256 netOut = grossOut - feeAmount;
        IERC20(intent.tokenOut).safeTransfer(intent.user, netOut);
    }
}
```

4. **Paymaster Service** (off-chain)
```python
# backend/paymaster_service.py

from eth_account import Account
from eth_account.messages import encode_structured_data

class PaymasterService:
    def __init__(self, private_key):
        self.account = Account.from_key(private_key)
        
    def quote_fee(self, intent, gas_estimate):
        """Calculate fee quote for user operation"""
        
        # Estimate gas cost in native
        gas_price = get_current_gas_price(intent['srcChainId'])
        gas_cost_native = gas_estimate * gas_price
        
        # Convert to fee token (USDC/WETH/etc)
        fee_token_price = get_token_price(intent['feeToken'])
        native_price = get_native_price(intent['srcChainId'])
        
        fee_amount = (gas_cost_native * native_price) / fee_token_price
        
        # Add buffer (10%)
        fee_amount_with_buffer = fee_amount * 1.1
        
        return {
            'feeToken': intent['feeToken'],
            'feeAmount': int(fee_amount_with_buffer),
            'gasPriceCap': int(gas_price * 1.2),  # 20% buffer
            'deadline': int(time.time()) + 300,   # 5 min
        }
    
    def sign_sponsor(self, user_op_hash, fee_config):
        """Sign paymaster sponsorship"""
        
        message = encode_structured_data({
            'types': {
                'EIP712Domain': [
                    {'name': 'name', 'type': 'string'},
                    {'name': 'version', 'type': 'string'},
                    {'name': 'chainId', 'type': 'uint256'},
                    {'name': 'verifyingContract', 'type': 'address'}
                ],
                'FeeConfig': [
                    {'name': 'userOpHash', 'type': 'bytes32'},
                    {'name': 'feeToken', 'type': 'address'},
                    {'name': 'feeAmount', 'type': 'uint256'},
                    {'name': 'gasPriceCap', 'type': 'uint256'},
                    {'name': 'deadline', 'type': 'uint256'}
                ]
            },
            'primaryType': 'FeeConfig',
            'domain': {
                'name': 'ZeroTollPaymaster',
                'version': '1',
                'chainId': fee_config['chainId'],
                'verifyingContract': PAYMASTER_ADDRESS
            },
            'message': {
                'userOpHash': user_op_hash,
                **fee_config
            }
        })
        
        signed = self.account.sign_message(message)
        return signed.signature
```

5. **Frontend Integration**
```javascript
// frontend/src/hooks/useSmartAccount.js
import { useSmartAccount } from '@alchemy/aa-wagmi'

export function useGaslessSwap() {
  const { sendUserOperation } = useSmartAccount()
  
  async function executeGaslessSwap(intent) {
    // 1. Get fee quote from paymaster
    const feeQuote = await fetch('/api/paymaster/quote', {
      method: 'POST',
      body: JSON.stringify(intent)
    }).then(r => r.json())
    
    // 2. Build UserOperation
    const userOp = {
      sender: smartAccountAddress,
      callData: encodeExecuteRoute(intent),
      paymasterAndData: encodePaymasterData(feeQuote)
    }
    
    // 3. Sign (FREE for user!)
    const signature = await signUserOperation(userOp)
    
    // 4. Submit via bundler
    const txHash = await sendUserOperation({
      ...userOp,
      signature
    })
    
    return txHash
  }
  
  return { executeGaslessSwap }
}
```

**Pros:**
- ✅ Works dengan SEMUA token (termasuk USDC)
- ✅ User 100% gasless (no native token needed)
- ✅ Fee dipotong atomik dari swap
- ✅ Paymaster auto top-up dari fee collected

**Cons:**
- ❌ Butuh smart account (not EOA)
- ❌ Implementasi lebih kompleks (2-3 minggu)
- ❌ Butuh infrastruktur bundler

---

### FASE 3: Hybrid Strategy (Production Ready)

**Kombinasi terbaik dari kedua dunia:**

```javascript
// Decision tree
if (token.supportsPermit && userHasEOA) {
  → Use EIP-2612 Permit (Fase 1)
} else if (userHasSmartAccount) {
  → Use ERC-4337 Paymaster (Fase 2)
} else {
  → Offer mini gas top-up (0.005 POL/ETH)
  → Or suggest creating smart account
}
```

---

## 💰 MODEL BISNIS FEE

### Option 1: Potong dari TOKEN_IN

```
User has: 100 USDC
Fee: 0.5 USDC (untuk cover gas)
Swap: 99.5 USDC → WMATIC
User receives: ~17.5 WMATIC (full amount)

Pro: Simple, fee upfront
Con: Kalau swap gagal, harus refund fee
```

### Option 2: Potong dari TOKEN_OUT (RECOMMENDED)

```
User has: 100 USDC
Swap: 100 USDC → 17.82 WMATIC
Fee: 0.32 WMATIC (dari output)
User receives: 17.5 WMATIC (net after fee)

Pro: Fee only if swap succeeds, UX natural
Con: Harus ensure minOut + fee < grossOut
```

### Fee Calculation:

```python
def calculate_fee(intent, gas_estimate):
    """Calculate fee in token (IN or OUT)"""
    
    # Base gas cost in native
    gas_price = get_gas_price(intent['chainId'])
    gas_cost_native = gas_estimate * gas_price  # wei
    
    # Get prices
    native_usd = get_price('ETH' if sepolia else 'POL')
    fee_token_usd = get_price(intent['feeToken'])
    
    # Convert to fee token
    gas_cost_usd = (gas_cost_native / 1e18) * native_usd
    fee_amount = gas_cost_usd / fee_token_usd
    
    # Add markup (20% for paymaster profit + buffer)
    final_fee = fee_amount * 1.2
    
    return {
        'feeToken': intent['feeToken'],
        'feeAmount': int(final_fee * 10**decimals),
        'gasEstimate': gas_estimate,
        'breakdown': {
            'gasCost': gas_cost_native,
            'gasCostUSD': gas_cost_usd,
            'feeAmountToken': final_fee,
            'markup': '20%'
        }
    }
```

---

## 🚀 RENCANA EKSEKUSI (Recommended Path)

### Week 1-2: FASE 1 - EIP-2612 Permit
- [ ] Deploy permit checker
- [ ] Implement permit signature flow (frontend)
- [ ] Implement permit executor (backend)
- [ ] Test dengan WETH/WPOL (support permit)
- [ ] Fallback to manual approve untuk USDC

### Week 3-5: FASE 2 - ERC-4337 Setup
- [ ] Deploy ZeroTollPaymaster contract
- [ ] Setup bundler (atau pakai Pimlico/Stackup)
- [ ] Implement paymaster service (quote + sign)
- [ ] Integrate smart account SDK (Alchemy AA / Biconomy)
- [ ] Test gasless flow end-to-end

### Week 6-7: Fee Netting Integration
- [ ] Update RouterHub dengan fee collector
- [ ] Implement TOKEN_IN fee mode
- [ ] Implement TOKEN_OUTPUT fee mode
- [ ] Add auto top-up EntryPoint deposit
- [ ] Monitoring & alerts

### Week 8: Production Hardening
- [ ] Security audit (paymaster logic)
- [ ] Rate limiting & anti-sybil
- [ ] Gas price oracle integration
- [ ] User documentation
- [ ] Mainnet deployment

---

## 📊 PERBANDINGAN SOLUSI

| Feature | Manual Approve | EIP-2612 Permit | ERC-4337 Paymaster |
|---------|---------------|-----------------|-------------------|
| **User bayar gas?** | ❌ Ya | ✅ Tidak | ✅ Tidak |
| **Token support** | ✅ Semua | ⚠️ Hanya yang ada permit | ✅ Semua |
| **Wallet support** | ✅ EOA | ✅ EOA | ⚠️ Perlu Smart Account |
| **Implementasi** | ✅ Mudah | ✅ Sedang | ❌ Kompleks |
| **UX** | ❌ Buruk (2 popup) | ✅ Bagus (1 signature) | ✅ Sempurna (1 signature) |
| **Timeline** | ✅ Sudah ada | ✅ 2-3 hari | ❌ 2-3 minggu |
| **Cost** | User | Paymaster | Paymaster |
| **Risk** | Rendah | Rendah | Medium |

---

## ✅ REKOMENDASI FINAL

### Untuk SEKARANG (Testnet Demo):
1. ✅ **Fix .env** (DONE)
2. ✅ Test swap dengan manual approve
3. ✅ Verify token flow correct

### Untuk MINGGU DEPAN:
4. ⭐ **Implement EIP-2612 Permit** untuk WETH/WPOL
5. ⭐ Frontend tampilkan "Gasless Approve" button

### Untuk BULAN DEPAN:
6. 🚀 **Deploy ERC-4337 Paymaster**
7. 🚀 Integrate fee netting strategy
8. 🚀 Production-ready gasless swap

### Yang Anda Benar:
✅ "Approve butuh gas native" - YA, ini masalah
✅ "Relayer + Paymaster harus cover" - YA, itulah solusinya
✅ "Potong fee dari swap" - YA, paling masuk akal
✅ "User tidak perlu POL/ETH" - YA, dengan Paymaster

---

**Kesimpulan:** Analisis Anda **100% BENAR**. Kita perlu implement Paymaster untuk true gasless experience. Tapi untuk sekarang, mari fix bug .env dulu, test swap berhasil, baru implement gasless di fase berikutnya! 🚀
