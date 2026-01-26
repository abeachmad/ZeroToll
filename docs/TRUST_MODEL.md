# ZeroToll Trust Model & Security

## Overview

ZeroToll uses a **hybrid trust model** where users trust the relayer for liveness but **not for security**. The smart contracts enforce all critical security properties on-chain.

---

## What the Relayer CAN Do

| Action | Impact | Mitigation |
|--------|--------|------------|
| **Not execute swap** | User's swap doesn't happen (DoS) | User can retry with different relayer |
| **Delay execution** | Swap executes later | Deadline in intent expires after 1 hour |
| **See intent before execution** | Potential MEV | Phase 3: Commit-reveal or encrypted intents |

---

## What the Relayer CANNOT Do

| Attack | Why It Fails |
|--------|--------------|
| **Steal user funds** | User signs exact `amountIn` and `minAmountOut` - verified on-chain |
| **Charge excessive fees** | Fee capped at 1% of `amountIn` in RouterV3 contract |
| **Execute at worse price** | `minAmountOut` enforced on-chain - tx reverts if not met |
| **Replay intent** | Nonce prevents replay attacks |
| **Modify intent** | EIP-712 signature verification fails if intent is changed |
| **Frontrun user** | User's `minAmountOut` protects against slippage |

---

## On-Chain Security Guarantees

### 1. Fee Cap (RouterV3)

```solidity
// In ZeroTollRouterV3.sol
uint256 public maxGaslessFeePercent = 100; // 1% max (100 basis points)

function _validateGaslessFee(uint256 amountIn, uint256 fee) internal view {
    uint256 maxFee = (amountIn * maxGaslessFeePercent) / 10000;
    require(fee <= maxFee, "Fee exceeds cap");
}
```

**Protection**: Relayer cannot charge more than 1% of swap amount, even if they claim gas cost is higher.

### 2. Slippage Protection

```solidity
struct SwapIntent {
    uint256 amountIn;      // Exact amount user approves
    uint256 minAmountOut;  // Minimum output user accepts
    uint256 deadline;      // Intent expires after this
    uint256 nonce;         // Prevents replay
}
```

**Protection**: User specifies minimum output. If swap gets less, transaction reverts.

### 3. Signature Verification

```solidity
function _validateIntent(SwapIntent calldata intent, bytes calldata sig) internal view {
    bytes32 structHash = keccak256(abi.encode(SWAP_INTENT_TYPEHASH, intent));
    bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    address signer = ECDSA.recover(digest, sig);
    require(signer == intent.user, "Invalid signature");
}
```

**Protection**: Relayer cannot modify any field of the intent without invalidating the signature.

### 4. Nonce & Deadline

```solidity
require(block.timestamp <= intent.deadline, "Intent expired");
require(nonces[intent.user] == intent.nonce, "Invalid nonce");
nonces[intent.user]++;
```

**Protection**: 
- Prevents replay attacks
- Limits time window for execution
- User controls nonce progression

---

## Trust Assumptions

### Current (Phase 2)

| Component | Trust Level | Reason |
|-----------|-------------|--------|
| **Smart Contracts** | Trustless | Verified on-chain, immutable |
| **Relayer (liveness)** | Trusted | Can choose not to execute |
| **Relayer (security)** | Trustless | Cannot steal or overcharge |
| **Pyth Oracle** | Trusted | For fee calculation only |

### Phase 3 (EIP-7702)

| Component | Trust Level | Improvement |
|-----------|-------------|-------------|
| **Relayer** | Reduced | User's EOA executes directly |
| **Fee calculation** | On-chain | Oracle integrated into contract |

### Phase 4 (Decentralized)

| Component | Trust Level | Improvement |
|-----------|-------------|-------------|
| **Relayer network** | Trustless | Multiple relayers compete |
| **Fee calculation** | On-chain | Automated gas oracle |

---

## Attack Scenarios & Defenses

### Scenario 1: Relayer Tries to Overcharge

**Attack**: Relayer claims gas cost is $10 and charges $20 fee (2x)

**Defense**: 
```solidity
// Fee capped at 1% of amountIn
// If user swaps $100 USDC, max fee = $1
// Even if relayer claims $10 gas, contract rejects
require(fee <= (amountIn * 100) / 10000, "Fee exceeds cap");
```

**Result**: Transaction reverts, user keeps funds

---

### Scenario 2: Relayer Tries to Frontrun

**Attack**: 
1. User signs intent to swap 100 USDC → ETH at 0.03 ETH minimum
2. Relayer sees this and buys ETH first
3. Price moves, user gets less

**Defense**:
```solidity
// User's minAmountOut protects them
require(amountOut >= intent.minAmountOut, "Slippage");
```

**Result**: If user doesn't get 0.03 ETH, transaction reverts

---

### Scenario 3: Relayer Modifies Intent

**Attack**: Relayer changes `tokenOut` to a worthless token

**Defense**:
```solidity
// EIP-712 signature verification
bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
address signer = ECDSA.recover(digest, signature);
require(signer == intent.user, "Invalid signature");
```

**Result**: Signature verification fails, transaction reverts

---

### Scenario 4: Relayer Delays Execution

**Attack**: Relayer waits for price to move against user

**Defense**:
```solidity
require(block.timestamp <= intent.deadline, "Intent expired");
```

**Result**: Intent expires after 1 hour, user can submit new one

---

## Comparison with Other Protocols

| Protocol | Trust Model | Fee Control | Frontrun Protection |
|----------|-------------|-------------|---------------------|
| **ZeroToll** | Hybrid (liveness only) | On-chain cap (1%) | minAmountOut + deadline |
| **Uniswap** | Trustless | No fees | Slippage tolerance |
| **1inch** | Trusted aggregator | Off-chain | Slippage tolerance |
| **CoW Swap** | Trusted solver | Off-chain | Batch auction |

---

## Roadmap to Full Decentralization

### Phase 3: EIP-7702 (Q1 2026)

**Goal**: Reduce relayer power

```
User's EOA delegates to ZeroTollDelegate
        ↓
EOA executes swap directly (no relayer in middle)
        ↓
Fee calculated on-chain via Pyth oracle
        ↓
Relayer only pays gas, cannot see intent beforehand
```

**Benefits**:
- Relayer cannot see intent before execution
- Fee calculation happens on-chain
- User maintains full control

### Phase 4: Decentralized Relayer Network (Q2 2026)

**Goal**: Remove single point of failure

```
User broadcasts encrypted intent
        ↓
Multiple relayers compete to execute
        ↓
First to execute gets fee
        ↓
Slashing for misbehavior
```

**Components**:
1. **Relayer Registry** - Stake required to join
2. **Reputation System** - Track execution quality
3. **Slashing** - Penalize bad actors
4. **Fee Market** - Relayers compete on fees

---

## For Auditors & Judges

### Key Security Properties

1. ✅ **User funds are safe** - Cannot be stolen by relayer
2. ✅ **Fee is capped** - Maximum 1% of swap amount
3. ✅ **Slippage protected** - minAmountOut enforced on-chain
4. ✅ **No replay attacks** - Nonce + deadline protection
5. ✅ **Intent integrity** - EIP-712 signature verification

### Trust Minimization Progress

| Phase | Trust Level | Timeline |
|-------|-------------|----------|
| Phase 1-2 | Hybrid (current) | ✅ Complete |
| Phase 3 | Reduced (EIP-7702) | Q1 2026 |
| Phase 4 | Trustless (decentralized) | Q2 2026 |

### Code Metrics (Actual)

| Component | Lines of Code |
|-----------|---------------|
| Smart Contracts | ~2,000 LOC |
| Backend | ~3,000 LOC |
| Frontend | ~5,000 LOC |
| **Total Core Code** | **~10,000 LOC** |

*Note: 1.3M LOC reported includes node_modules (being removed)*

---

## Conclusion

ZeroToll's trust model is **pragmatic**:
- Users trust relayer for **liveness** (will execute)
- Users **don't trust** relayer for **security** (cannot steal)
- All critical security enforced **on-chain**
- Clear path to **full decentralization**

This is similar to how Ethereum L2s work: trust sequencer for liveness, not security.
