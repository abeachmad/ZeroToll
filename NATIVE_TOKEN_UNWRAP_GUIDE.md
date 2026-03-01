# Native Token Unwrap - User Guide

**ZeroToll's Killer Feature**: Buy native tokens without having native tokens for gas!

---

## The Problem ZeroToll Solves

### Scenario
You're new to Polygon and want to buy POL to use dApps. But there's a catch:
- You need POL to pay gas fees
- But you don't have POL yet!
- You only have USDC from another chain

**This is the classic "chicken and egg" problem in crypto.**

### Traditional Solutions (All Bad)
1. **Centralized Exchange**: Withdraw POL → High fees, KYC required
2. **Faucet**: Get tiny amount → Not enough for real usage
3. **Friend**: Ask someone → Awkward, not scalable
4. **Bridge**: Bridge POL from another chain → Expensive, slow

### ZeroToll Solution ✅
**Swap USDC → POL with ZERO gas fees!**
- No POL needed upfront
- Receive actual native POL
- Fee deducted from output
- One transaction, fully gasless

---

## How It Works

### Step-by-Step Flow

#### 1. User Has USDC, Wants POL
```
User wallet:
  ✅ 100 USDC
  ❌ 0 POL (can't pay gas!)
```

#### 2. User Initiates Gasless Swap
```
Swap: 100 USDC → POL
Mode: EIP-7702 Gasless
Gas: $0 (relayer pays!)
```

#### 3. User Signs (No Gas!)
```
Sign 1: EIP-7702 authorization (delegate to ZeroTollDelegate)
Sign 2: EIP-2612 permit (approve USDC)
Sign 3: Swap intent (confirm swap details)
All signatures are FREE - no gas needed!
```

#### 4. ZeroToll Executes On-Chain
```
a) Transfer 100 USDC from user
b) Deduct 2 USDC fee → treasury
c) Swap 98 USDC → 49 WPOL (via DEX)
d) Unwrap 49 WPOL → 49 POL (native!)
e) Native POL stays in user's wallet
```

#### 5. User Receives Native POL
```
User wallet:
  ✅ 0 USDC (spent)
  ✅ 49 POL (native!) ← Can now use dApps!
```

---

## Technical Implementation

### Special NATIVE Address
ZeroToll uses a special address to indicate native token output:
```
0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
```

This is a standard convention used by:
- Uniswap
- 1inch
- Paraswap
- Many other DeFi protocols

### Smart Contract Logic
```solidity
// ZeroTollDelegate.sol
address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

function execute(...) external returns (uint256 amountOut) {
    // Detect native output request
    bool isNativeOut = intent.tokenOut == NATIVE;
    
    // Swap to wrapped token first
    address actualTokenOut = isNativeOut ? weth : intent.tokenOut;
    amountOut = IZeroTollRouter(router).swap(...);
    
    // Unwrap if native requested
    if (isNativeOut) {
        IWETH(weth).withdraw(amountOut);
        // Native token now in user's EOA (via EIP-7702 delegation)
    }
}
```

### Frontend Logic
```javascript
// Swap.jsx
const NATIVE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const getTokenAddress = (token) => {
  if (token.isNative || token.address === 'NATIVE') {
    return NATIVE_ADDRESS; // Contract will unwrap!
  }
  return token.address;
};
```

---

## Fee Model

### Fee Structure
```
Total Output = Swap Output - Gas Fee - Service Fee
```

### Example Calculation
```
Input: 100 USDC
Swap rate: 1 USDC = 0.5 POL
Swap output: 50 POL

Gas fee: 0.5 POL (1%)
Service fee: 0.5 POL (1%)

User receives: 49 POL (native!)
```

### Why Fees Are Fair
1. **Gas fee**: Covers relayer's actual gas cost
2. **Service fee**: Sustains ZeroToll development
3. **Total ~2%**: Cheaper than CEX withdrawal fees
4. **Transparent**: All fees shown upfront

---

## Comparison: ZeroToll vs Alternatives

### ZeroToll (EIP-7702)
```
✅ Truly gasless (user pays $0 gas)
✅ Native token output (real POL/ETH)
✅ One transaction (atomic)
✅ 50% cheaper than ERC-4337
✅ Works with any wallet
✅ No smart contract wallet needed
✅ Fee deducted from output
```

### ERC-4337 (Account Abstraction)
```
❌ Requires smart contract wallet
❌ 2x gas cost vs EIP-7702
❌ Complex setup
❌ Not all wallets supported
✅ Gasless possible
✅ Native output possible
```

### Traditional DEX
```
❌ Requires gas upfront
❌ User must have native tokens
❌ Can't solve cold start problem
✅ Decentralized
✅ Permissionless
```

### Centralized Exchange
```
❌ High withdrawal fees
❌ KYC required
❌ Custody risk
❌ Slow (hours/days)
✅ Easy to use
✅ Fiat on-ramp
```

---

## Use Cases

### 1. New User Onboarding
**Problem**: New user has USDC from CEX, needs POL to start using Polygon dApps

**Solution**: Swap USDC → POL gaslessly, receive native POL, start using dApps immediately

### 2. Cross-Chain User
**Problem**: User bridges USDC from Ethereum, needs POL for gas on Polygon

**Solution**: Swap bridged USDC → POL gaslessly, no need to bridge POL separately

### 3. Airdrop Recipient
**Problem**: User receives USDC airdrop but has no POL for gas

**Solution**: Swap airdrop USDC → POL gaslessly, can now use the tokens

### 4. Gas Tank Refill
**Problem**: User ran out of POL, has other tokens but can't pay gas

**Solution**: Swap any token → POL gaslessly, refill gas tank

---

## Security Guarantees

### Trustless Fee Calculation
```solidity
// Fee calculated on-chain, not by relayer
uint256 swapAmount = intent.amountIn - fee;
require(fee < intent.amountIn, "Fee too high");
```

### Replay Protection
```solidity
// Nonce prevents replay attacks
require(nonces[intent.user] == intent.nonce, "Invalid nonce");
nonces[intent.user]++;
```

### Signature Verification
```solidity
// User must sign intent with EIP-712
bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
address signer = digest.recover(intentSignature);
require(signer == intent.user, "Invalid signature");
```

### Atomic Execution
```solidity
// Everything happens in one transaction
// Either all succeeds or all reverts
// No partial execution possible
```

---

## Testing Guide

### Prerequisites
1. Wallet with USDC on Amoy testnet
2. No POL needed (that's the point!)
3. ZeroToll frontend running

### Test Steps

#### 1. Open Swap Page
```
http://localhost:3000/swap
```

#### 2. Connect Wallet
- Click "Connect Wallet"
- Select MetaMask (or any wallet)
- Approve connection

#### 3. Enable EIP-7702 Mode
- Find "EIP-7702 Gasless" toggle
- Enable it (⚡ icon appears)

#### 4. Configure Swap
```
From: USDC
Amount: 1.0

To: POL (native) ← Select native token!
Network: Polygon Amoy
```

#### 5. Execute Swap
1. Click "Get Quote"
2. Review quote (shows fee breakdown)
3. Click "⚡ Execute EIP-7702 (50% Cheaper!)"
4. Sign 3 messages in MetaMask (all free!)
5. Wait for confirmation

#### 6. Verify Result
```
Check wallet:
  ✅ USDC decreased
  ✅ POL increased (native!)
  ✅ Can now pay gas fees!
```

### Expected Console Output
```javascript
🔍 Token addresses: {
  tokenIn: { 
    symbol: 'USDC', 
    original: '0x...', 
    actual: '0x...' 
  },
  tokenOut: { 
    symbol: 'POL', 
    original: 'NATIVE',
    actual: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    willUnwrap: '✅ Yes - you will receive native POL'
  }
}

💰 You will receive native POL in your wallet!
🚀 Starting EIP-7702 gasless swap (50% cheaper!)
✅ Swap complete - check explorer
```

---

## Troubleshooting

### "EIP-7702 not supported on this chain"
**Solution**: Switch to Amoy (80002) or Sepolia (11155111)

### "Insufficient USDC balance"
**Solution**: Get testnet USDC from faucet or bridge

### "User rejected signature"
**Solution**: You cancelled in MetaMask, try again

### "Swap failed on-chain"
**Possible causes**:
- Slippage too low (price moved)
- Insufficient liquidity
- Contract paused

**Solution**: Try again with higher slippage tolerance

### "Still showing wrapped token"
**Check**:
- Is EIP-7702 mode enabled?
- Did you select native token (not wrapped)?
- Check console logs for NATIVE address

---

## FAQ

### Q: Do I really receive native tokens?
**A**: Yes! The contract unwraps WPOL/WETH to native POL/ETH automatically.

### Q: How much does it cost?
**A**: ~2% total (1% gas fee + 1% service fee). Cheaper than CEX withdrawals.

### Q: Is it safe?
**A**: Yes! All logic is on-chain, trustless, and auditable. No custody of funds.

### Q: What if the relayer goes down?
**A**: You can always use traditional swap (with gas). ZeroToll is an optional convenience.

### Q: Can I swap any token to native?
**A**: Yes! Any ERC-20 → native token swap is supported.

### Q: Does this work on mainnet?
**A**: Currently testnet only (Amoy, Sepolia). Mainnet coming soon!

### Q: What's the minimum swap amount?
**A**: No minimum, but small swaps have higher fee percentage due to fixed gas costs.

---

## Summary

ZeroToll's native token unwrap feature solves the cold start problem:
- ✅ Buy native tokens without having native tokens
- ✅ Truly gasless (user pays $0 gas)
- ✅ Receive actual native tokens (not wrapped)
- ✅ Fee deducted from output (transparent)
- ✅ 50% cheaper than ERC-4337
- ✅ Works with any wallet

**This is the killer feature that makes ZeroToll unique!**

---

## Next Steps

1. **Try it**: Test on Amoy testnet
2. **Share it**: Tell others about gasless native swaps
3. **Build on it**: Integrate ZeroToll into your dApp
4. **Improve it**: Contribute to the codebase

**Welcome to truly gasless DeFi!** 🚀
