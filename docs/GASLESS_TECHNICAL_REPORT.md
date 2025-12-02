# ZeroToll Gasless Swap System - Technical Report

**Date:** December 2, 2024  
**Version:** 1.0  
**Network:** Ethereum Sepolia Testnet (Chain ID: 11155111)

---

## Executive Summary

This report documents the implementation of a gasless token swap system for ZeroToll. The system enables users to perform token swaps without paying gas fees, with the relayer sponsoring all transaction costs. We analyze the technical architecture, deployed contracts, limitations, and the fundamental constraints of gasless transactions on EVM blockchains.

**Key Finding:** True 100% gasless swaps are only possible for tokens that implement ERC-2612 Permit. For legacy tokens (WETH, USDC), users must pay gas at least once for initial approval.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Deployed Contracts](#2-deployed-contracts)
3. [Gasless Flow Analysis](#3-gasless-flow-analysis)
4. [Token Approval Problem](#4-token-approval-problem)
5. [Solutions Implemented](#5-solutions-implemented)
6. [Solutions Evaluated But Limited](#6-solutions-evaluated-but-limited)
7. [Paymaster Analysis](#7-paymaster-analysis)
8. [Technical Limitations](#8-technical-limitations)
9. [Recommendations](#9-recommendations)
10. [Appendix](#appendix)

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER (MetaMask)                             │
│                                                                          │
│  1. Signs EIP-712 SwapIntent (no gas)                                   │
│  2. Signs ERC-2612 Permit OR Permit2 signature (no gas)                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           RELAYER BACKEND                                │
│                                                                          │
│  - Verifies user signatures                                             │
│  - Constructs transaction calldata                                      │
│  - Submits transaction to blockchain                                    │
│  - PAYS GAS from relayer's ETH balance                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ZEROTOLL ROUTER V2                               │
│                                                                          │
│  - Verifies SwapIntent signature matches user                           │
│  - Executes Permit (if provided) for gasless approval                   │
│  - Pulls tokens from user                                               │
│  - Routes swap through SmartDexAdapter                                  │
│  - Sends output tokens to user                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SMART DEX ADAPTER                                │
│                                                                          │
│  1. Try Uniswap V3 (if pool exists with liquidity)                      │
│  2. Fallback to internal liquidity pool                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility | Gas Payer |
|-----------|---------------|-----------|
| User (MetaMask) | Sign messages only | None |
| Relayer Backend | Submit transactions | Relayer |
| ZeroTollRouterV2 | Verify signatures, execute swaps | N/A (called by relayer) |
| SmartDexAdapter | Route swaps to best venue | N/A (called by router) |

---

## 2. Deployed Contracts

### 2.1 Contract Addresses (Sepolia)

| Contract | Address | Purpose |
|----------|---------|---------|
| ZeroTollRouterV2 | `0xd475255Ae38C92404f9740A19F93B8D2526A684b` | Main swap router with signature verification |
| SmartDexAdapter | `0x5c2d8Ce29Bb6E5ddf14e8df5a62ec78AAeffBffa` | DEX routing (Uniswap + internal) |
| ZTA (ZeroToll Token A) | `0x4cF58E14DbC9614d7F6112f6256dE9062300C6Bf` | Test token with ERC-2612 Permit |
| ZTB (ZeroToll Token B) | `0x8fb844251af76AF090B005643D966FC52852100a` | Test token with ERC-2612 Permit |
| pWETH (Permit WETH) | `0x3af00011Da61751bc58DFfDD0F9F85F69301E180` | Permit-wrapped WETH |
| pUSDC (Permit USDC) | `0xD6a7294445F34d0F7244b2072696106904ea807B` | Permit-wrapped USDC |
| Permit2 (Uniswap) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | Universal permit system |

### 2.2 External Dependencies

| Contract | Address | Purpose |
|----------|---------|---------|
| WETH (Sepolia) | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | Wrapped ETH |
| USDC (Sepolia) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | USD Coin (6 decimals) |
| Uniswap V3 Router | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` | Swap execution |
| Uniswap V3 Factory | `0x0227628f3F023bb0B980b67D528571c95c6DaC1c` | Pool discovery |

### 2.3 Relayer Configuration

| Parameter | Value |
|-----------|-------|
| Relayer Address | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` |
| Relayer Balance | ~0.8 ETH |
| Gas Sponsor | Relayer EOA (direct payment) |
| Pimlico Status | Configured but not active |

---

## 3. Gasless Flow Analysis

### 3.1 Flow A: ERC-2612 Permit Tokens (ZTA/ZTB) - 100% Gasless

```
User Action                          Gas Cost    Who Pays
─────────────────────────────────────────────────────────
1. Get tokens from faucet            ~50,000     User (one-time)
2. Sign ERC-2612 Permit              0           -
3. Sign SwapIntent                   0           -
4. Relayer submits executeSwapWithPermit  ~150,000    Relayer
─────────────────────────────────────────────────────────
Total user gas after setup:          0
```

**EIP-712 Permit Message Structure:**
```solidity
struct Permit {
    address owner;      // Token holder
    address spender;    // Router address
    uint256 value;      // Amount to approve
    uint256 nonce;      // Replay protection
    uint256 deadline;   // Expiration timestamp
}
```

### 3.2 Flow B: Permit2 Tokens (WETH/USDC) - One-Time Gas

```
User Action                          Gas Cost    Who Pays
─────────────────────────────────────────────────────────
1. Approve token to Permit2          ~46,000     User (one-time)
2. Sign Permit2 PermitSingle         0           -
3. Sign SwapIntent                   0           -
4. Relayer submits executeSwapWithPermit2  ~200,000    Relayer
─────────────────────────────────────────────────────────
Total user gas after setup:          0
```

**Permit2 PermitSingle Structure:**
```solidity
struct PermitSingle {
    PermitDetails details;
    address spender;
    uint256 sigDeadline;
}

struct PermitDetails {
    address token;
    uint160 amount;
    uint48 expiration;
    uint48 nonce;
}
```

### 3.3 Flow C: Traditional Approval - One-Time Gas

```
User Action                          Gas Cost    Who Pays
─────────────────────────────────────────────────────────
1. Approve token to Router           ~46,000     User (one-time)
2. Sign SwapIntent                   0           -
3. Relayer submits executeSwap       ~150,000    Relayer
─────────────────────────────────────────────────────────
Total user gas after setup:          0
```

---

## 4. Token Approval Problem

### 4.1 The Fundamental Constraint

ERC-20 tokens require explicit approval before any third party can transfer them. The `approve()` function is defined as:

```solidity
function approve(address spender, uint256 amount) external returns (bool) {
    _allowances[msg.sender][spender] = amount;
    emit Approval(msg.sender, spender, amount);
    return true;
}
```

**Critical Issue:** The approval is tied to `msg.sender`. There is no way for a relayer to call `approve()` on behalf of a user because the relayer's address would become the approver, not the user's.

### 4.2 Why This Matters

| Scenario | Can Relayer Help? | Reason |
|----------|-------------------|--------|
| User approves router | ❌ No | `msg.sender` must be user |
| User approves Permit2 | ❌ No | `msg.sender` must be user |
| User signs ERC-2612 Permit | ✅ Yes | Signature-based, relayer submits |
| User signs Permit2 signature | ✅ Yes | Signature-based, relayer submits |

### 4.3 Token Support Matrix

| Token | ERC-2612 Permit | Permit2 Compatible | Gasless Approval |
|-------|-----------------|-------------------|------------------|
| ZTA | ✅ Yes | ✅ Yes | ✅ 100% Gasless |
| ZTB | ✅ Yes | ✅ Yes | ✅ 100% Gasless |
| DAI (Mainnet) | ✅ Yes | ✅ Yes | ✅ 100% Gasless |
| WETH | ❌ No | ✅ Yes | ❌ One-time gas |
| USDC (Sepolia) | ❌ No | ✅ Yes | ❌ One-time gas |
| Most ERC-20s | ❌ No | ✅ Yes | ❌ One-time gas |

---

## 5. Solutions Implemented

### 5.1 Solution 1: Custom Permit Tokens (ZTA/ZTB)

**Implementation:** Created ERC-20 tokens with OpenZeppelin's ERC20Permit extension.

```solidity
contract GaslessTestToken is ERC20, ERC20Permit {
    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) 
        ERC20Permit(name) 
    {}
    
    function faucet() external {
        _mint(msg.sender, 1000 * 10**18);
    }
}
```

**Result:** 100% gasless swaps after initial faucet claim.

**Limitation:** Only works for new tokens we deploy. Cannot retrofit existing tokens.

### 5.2 Solution 2: Permit2 Integration

**Implementation:** Integrated Uniswap's Permit2 contract for universal permit support.

```solidity
function executeSwapWithPermit2(
    SwapIntent calldata intent,
    bytes calldata userSignature,
    IPermit2.PermitSingle calldata permitSingle,
    bytes calldata permit2Signature
) external nonReentrant returns (uint256 amountOut) {
    // Execute Permit2 permit
    IPermit2(PERMIT2).permit(intent.user, permitSingle, permit2Signature);
    
    // Pull tokens via Permit2
    IPermit2(PERMIT2).transferFrom(
        intent.user,
        address(this),
        uint160(intent.amountIn),
        intent.tokenIn
    );
    
    // Execute swap...
}
```

**Result:** Gasless swaps after one-time Permit2 approval.

**Limitation:** User must still approve Permit2 once (pays gas).

### 5.3 Solution 3: Smart DEX Adapter

**Implementation:** Intelligent routing that tries Uniswap first, falls back to internal liquidity.

```solidity
function swap(...) external returns (uint256 amountOut) {
    // Try Uniswap first
    (bool uniswapSuccess, uint256 uniswapOut) = _tryUniswap(...);
    
    if (uniswapSuccess) {
        return uniswapOut;
    }
    
    // Fallback to internal pool
    return _swapInternal(...);
}
```

**Result:** Swaps work even when Uniswap pools lack liquidity.

---

## 6. Solutions Evaluated But Limited

### 6.1 Permit Wrappers (pWETH/pUSDC)

**Concept:** Wrap legacy tokens in a new contract that supports ERC-2612 Permit.

**Implementation:**
```solidity
contract PermitWrapper is ERC20, ERC20Permit {
    IERC20 public immutable underlying;
    
    function wrap(uint256 amount) external {
        underlying.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
    }
    
    function unwrap(uint256 amount) external {
        _burn(msg.sender, amount);
        underlying.safeTransfer(msg.sender, amount);
    }
}
```

**Problem:** User must:
1. Approve underlying token to wrapper (gas)
2. Call wrap() (gas)

**Result:** 2 gas-paying transactions instead of 1. **Worse than direct approval.**

**When Useful:** Only if user wraps once and does many swaps over extended period.

### 6.2 Relayer-Paid Approvals

**Concept:** Relayer submits approval transaction on behalf of user.

**Problem:** The `approve()` function uses `msg.sender`:
```solidity
_allowances[msg.sender][spender] = amount;
```

If relayer calls `approve()`, the relayer becomes the approver, not the user.

**Result:** **Technically impossible** without token contract modification.

### 6.3 Meta-Transactions (ERC-2771)

**Concept:** Token contract trusts a forwarder to relay the true sender.

**Problem:** Requires token contract to implement ERC-2771:
```solidity
function _msgSender() internal view override returns (address) {
    if (msg.sender == trustedForwarder) {
        return address(bytes20(msg.data[msg.data.length - 20:]));
    }
    return msg.sender;
}
```

**Result:** WETH/USDC don't implement this. **Not applicable to existing tokens.**

---

## 7. Paymaster Analysis

### 7.1 Current Implementation

**Status:** Pimlico is configured but NOT actively used.

**Reason:** The `permissionless` library (v0.3.2) has API mismatches with current Pimlico bundler, causing "UserOperation failed" errors.

**Current Gas Sponsor:** Relayer EOA pays directly from its ETH balance.

### 7.2 Pimlico Integration Attempt

```javascript
// Configuration attempted
const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint: {
        address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // v0.7
        version: '0.7'
    }
});

const smartAccountClient = createSmartAccountClient({
    account: simpleAccount,
    chain: sepolia,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient
});
```

**Error Encountered:** `UserOperation failed` - likely due to library version mismatch.

### 7.3 Paymaster Comparison

| Approach | Who Pays Gas | Complexity | Status |
|----------|--------------|------------|--------|
| Relayer EOA | Relayer | Low | ✅ Active |
| Pimlico Paymaster | Pimlico | High | ❌ Failed |
| Custom Paymaster | Protocol | Very High | Not attempted |

### 7.4 Recommendation

For production, fix Pimlico integration by:
1. Upgrading `permissionless` to latest version
2. Using correct EntryPoint version (v0.6 vs v0.7)
3. Ensuring Pimlico API key has sufficient credits

---

## 8. Technical Limitations

### 8.1 Blockchain Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| ERC-20 Approval Model | `approve()` requires `msg.sender` to be token holder | Use ERC-2612 Permit or Permit2 |
| Immutable Contracts | Cannot add Permit to deployed tokens | Deploy wrapper or use Permit2 |
| Gas Requirement | All state changes require gas | Relayer sponsorship |

### 8.2 Protocol Limitations

| Limitation | Description | Impact |
|------------|-------------|--------|
| Permit2 Approval | User must approve Permit2 once | One-time gas cost |
| Uniswap Liquidity | Sepolia pools may lack liquidity | Fallback to internal pool |
| Signature Replay | Must track nonces | Implemented in router |

### 8.3 Implementation Limitations

| Limitation | Description | Status |
|------------|-------------|--------|
| Pimlico Integration | Library version mismatch | Needs fix |
| Price Oracle | Simple 1:1 or fixed prices | Needs Chainlink integration |
| Multi-hop Swaps | Only direct pairs supported | Future enhancement |

---

## 9. Recommendations

### 9.1 For True Gasless Experience

1. **Use ZTA/ZTB tokens** for demos - 100% gasless
2. **Educate users** that one-time approval is unavoidable for legacy tokens
3. **Batch approvals** - approve max amount once, never again

### 9.2 For Production Deployment

1. **Fix Pimlico integration** - reduces relayer operational costs
2. **Integrate Chainlink** - accurate price feeds for internal swaps
3. **Add more liquidity** - ensure swaps don't fail due to insufficient liquidity
4. **Implement multi-hop routing** - better rates for exotic pairs

### 9.3 For User Experience

1. **Clear messaging** - explain why first approval costs gas
2. **Approval status indicators** - show which tokens are ready for gasless swaps
3. **Gas estimation** - show users expected savings over time

---

## Appendix

### A. EIP-712 Domain Separator

```solidity
DOMAIN_SEPARATOR = keccak256(
    abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256(bytes("ZeroTollRouter")),
        keccak256(bytes("1")),
        11155111, // Sepolia
        0xd475255Ae38C92404f9740A19F93B8D2526A684b
    )
);
```

### B. SwapIntent Type Hash

```solidity
bytes32 public constant SWAP_INTENT_TYPEHASH = keccak256(
    "SwapIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,uint256 chainId)"
);
```

### C. Gas Costs Reference (Sepolia)

| Operation | Approximate Gas | Cost at 1 gwei |
|-----------|-----------------|----------------|
| ERC-20 Approve | 46,000 | 0.000046 ETH |
| ERC-20 Transfer | 65,000 | 0.000065 ETH |
| executeSwap | 150,000 | 0.00015 ETH |
| executeSwapWithPermit | 180,000 | 0.00018 ETH |
| executeSwapWithPermit2 | 200,000 | 0.0002 ETH |
| Uniswap V3 Swap | 150,000 | 0.00015 ETH |

### D. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/intents/swap` | POST | Standard swap (requires prior approval) |
| `/api/intents/swap-with-permit` | POST | Swap with ERC-2612 Permit |
| `/api/intents/swap-with-permit2` | POST | Swap with Permit2 |
| `/api/intents/:id/status` | GET | Check swap status |
| `/api/nonce/:chainId/:address` | GET | Get user's nonce |
| `/api/config/:chainId` | GET | Get router configuration |
| `/health` | GET | Relayer health check |

### E. Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid signature" | Signature doesn't match user | Re-sign with correct account |
| "Intent expired" | Deadline passed | Create new intent |
| "Invalid nonce" | Nonce mismatch | Fetch current nonce |
| "Slippage exceeded" | Output below minimum | Increase slippage tolerance |
| "Insufficient liquidity" | Pool lacks tokens | Try different pair or add liquidity |
| "Adapter swap failed" | DEX routing failed | Check adapter liquidity |
| "transfer amount exceeds balance" | User lacks tokens | Check balance before swap |

---

## Conclusion

The ZeroToll gasless swap system successfully enables zero-gas swaps for users after initial setup. The fundamental limitation of ERC-20 approval cannot be circumvented for legacy tokens, but the system minimizes user gas costs to a single one-time approval.

**Key Metrics:**
- User gas for ZTA/ZTB swaps: **0** (after faucet)
- User gas for WETH/USDC swaps: **~46,000** (one-time approval)
- Relayer gas per swap: **~150,000-200,000**
- Relayer balance: **~0.8 ETH** (sufficient for ~4,000 swaps)

The system is production-ready for demonstration purposes. For mainnet deployment, Pimlico integration should be fixed to reduce relayer operational costs.

---

*Report generated by ZeroToll Development Team*
