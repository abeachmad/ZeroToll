# Phase 3: Decentralized Relayer Network

## Vision

Transform ZeroToll from a **single relayer** to a **decentralized network** where multiple relayers compete to execute swaps, eliminating the single point of trust.

---

## Current Limitations (Phase 2)

| Issue | Impact |
|-------|--------|
| Single relayer | Single point of failure (liveness) |
| Relayer sees intents | Potential MEV extraction |
| Centralized fee calculation | Must trust relayer's gas estimates |
| No competition | No incentive to optimize |

---

## Phase 3 Architecture

### 3A: EIP-7702 Integration (Q1 2026)

**Goal**: Reduce relayer power by having user's EOA execute directly

```
┌─────────────────────────────────────────────────────────┐
│                  User's EOA (EIP-7702)                  │
│  Temporarily delegates to ZeroTollDelegate contract     │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Signs authorization + intent
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Relayer (Simplified)                 │
│  - Receives signed authorization                        │
│  - Builds transaction with authorizationList            │
│  - Submits to blockchain                                │
│  - Pays gas upfront                                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              ZeroTollDelegate (On-Chain)                │
│  - Executes permit                                      │
│  - Calculates fee via Pyth oracle                       │
│  - Executes swap                                        │
│  - Unwraps to native if needed                          │
└─────────────────────────────────────────────────────────┘
```

**Benefits**:
- 50% gas savings (no EntryPoint overhead)
- Relayer cannot see intent before execution
- Fee calculated on-chain (trustless)
- Native token output built-in

**Implementation**: See [EIP7702_IMPLEMENTATION_PLAN.md](./EIP7702_IMPLEMENTATION_PLAN.md)

---

### 3B: Decentralized Relayer Network (Q2 2026)

**Goal**: Multiple relayers compete, no single point of trust

```
┌─────────────────────────────────────────────────────────┐
│                    User's Intent                        │
│  Encrypted with threshold encryption                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Broadcast to mempool
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Relayer Network (3-of-5)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Relayer 1│  │ Relayer 2│  │ Relayer 3│             │
│  │ Stake:   │  │ Stake:   │  │ Stake:   │             │
│  │ 10 ETH   │  │ 10 ETH   │  │ 10 ETH   │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  - Compete to execute                                   │
│  - First to execute gets fee                            │
│  - Slashed if misbehave                                 │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  On-Chain Verification                  │
│  - Verify execution quality                             │
│  - Distribute rewards                                   │
│  - Slash bad actors                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

### 1. RelayerRegistry

```solidity
contract RelayerRegistry {
    struct Relayer {
        address addr;
        uint256 stake;
        uint256 reputation;
        uint256 totalExecuted;
        uint256 slashCount;
        bool active;
    }
    
    mapping(address => Relayer) public relayers;
    uint256 public minStake = 10 ether;
    
    function registerRelayer() external payable {
        require(msg.value >= minStake, "Insufficient stake");
        relayers[msg.sender] = Relayer({
            addr: msg.sender,
            stake: msg.value,
            reputation: 100,
            totalExecuted: 0,
            slashCount: 0,
            active: true
        });
    }
    
    function slashRelayer(address relayer, uint256 amount) external onlyGovernance {
        require(relayers[relayer].stake >= amount, "Insufficient stake");
        relayers[relayer].stake -= amount;
        relayers[relayer].slashCount++;
        
        if (relayers[relayer].stake < minStake) {
            relayers[relayer].active = false;
        }
    }
}
```

### 2. IntentMempool

```solidity
contract IntentMempool {
    struct EncryptedIntent {
        bytes32 intentHash;
        bytes encryptedData;
        uint256 deadline;
        uint256 minReputation;
        address user;
    }
    
    mapping(bytes32 => EncryptedIntent) public intents;
    
    function submitIntent(
        bytes32 intentHash,
        bytes calldata encryptedData,
        uint256 deadline,
        uint256 minReputation
    ) external {
        intents[intentHash] = EncryptedIntent({
            intentHash: intentHash,
            encryptedData: encryptedData,
            deadline: deadline,
            minReputation: minReputation,
            user: msg.sender
        });
        
        emit IntentSubmitted(intentHash, msg.sender, deadline);
    }
    
    function executeIntent(
        bytes32 intentHash,
        bytes calldata decryptedIntent,
        bytes calldata proof
    ) external {
        // Verify relayer is registered and has sufficient reputation
        require(relayerRegistry.isEligible(msg.sender, intents[intentHash].minReputation));
        
        // Verify decryption is correct
        require(keccak256(decryptedIntent) == intentHash, "Invalid decryption");
        
        // Execute swap
        // ...
        
        // Reward relayer
        relayerRegistry.recordExecution(msg.sender);
    }
}
```

### 3. ReputationSystem

```solidity
contract ReputationSystem {
    mapping(address => uint256) public reputation;
    mapping(address => uint256) public successfulExecutions;
    mapping(address => uint256) public failedExecutions;
    
    function recordSuccess(address relayer) external onlyRouter {
        successfulExecutions[relayer]++;
        reputation[relayer] += 1;
    }
    
    function recordFailure(address relayer) external onlyRouter {
        failedExecutions[relayer]++;
        if (reputation[relayer] > 0) {
            reputation[relayer] -= 1;
        }
    }
    
    function getReputation(address relayer) external view returns (uint256) {
        uint256 total = successfulExecutions[relayer] + failedExecutions[relayer];
        if (total == 0) return 100; // Default
        
        return (successfulExecutions[relayer] * 100) / total;
    }
}
```

---

## Encryption Scheme

### Threshold Encryption

User encrypts intent with threshold encryption (3-of-5):

```javascript
// User side
const intent = {
  user: userAddress,
  tokenIn: USDC,
  tokenOut: ETH,
  amountIn: parseUnits('100', 6),
  minAmountOut: parseEther('0.03')
};

// Encrypt with threshold scheme
const { encryptedIntent, shares } = await thresholdEncrypt(intent, {
  threshold: 3,
  total: 5,
  relayers: [relayer1, relayer2, relayer3, relayer4, relayer5]
});

// Submit to mempool
await intentMempool.submitIntent(
  keccak256(intent),
  encryptedIntent,
  deadline,
  minReputation: 80
);
```

### Decryption

Relayers collaborate to decrypt:

```javascript
// Relayer side
const share1 = await relayer1.getDecryptionShare(intentHash);
const share2 = await relayer2.getDecryptionShare(intentHash);
const share3 = await relayer3.getDecryptionShare(intentHash);

// Combine shares (3-of-5 threshold)
const decryptedIntent = combineShares([share1, share2, share3]);

// Execute
await router.executeIntent(intentHash, decryptedIntent, proof);
```

---

## Economic Model

### Relayer Incentives

| Action | Reward | Penalty |
|--------|--------|---------|
| Successful execution | Fee + reputation | - |
| Failed execution | - | -1 reputation |
| Misbehavior (proven) | - | Slash 10% stake |
| Offline (>24h) | - | -5 reputation |

### Fee Distribution

```
Total Fee (2x gas cost)
        ↓
├─ 70% → Executing relayer
├─ 20% → LP rewards (Phase 4)
├─ 5%  → Protocol treasury
└─ 5%  → Relayer insurance pool
```

### Slashing Conditions

| Offense | Slash Amount | Evidence |
|---------|--------------|----------|
| Frontrunning | 50% stake | On-chain proof |
| Censorship | 20% stake | Timeout proof |
| Invalid execution | 30% stake | Revert proof |
| Collusion | 100% stake | Multi-sig proof |

---

## Governance

### RelayerDAO

- Relayers vote on protocol parameters
- Weighted by stake + reputation
- Proposals:
  - Adjust min stake
  - Change slashing amounts
  - Add/remove relayers
  - Update fee distribution

### Parameters (Initial)

```solidity
uint256 public minStake = 10 ether;
uint256 public minReputation = 80;
uint256 public slashPercentFrontrun = 50;
uint256 public slashPercentCensorship = 20;
uint256 public executionTimeout = 5 minutes;
```

---

## Migration Path

### Week 1-4: EIP-7702 Integration

- Deploy ZeroTollDelegate
- Update relayer for 7702 transactions
- Test on testnet
- Gradual rollout to mainnet

### Week 5-8: Relayer Registry

- Deploy RelayerRegistry contract
- Onboard initial relayers (5-10)
- Test multi-relayer execution
- Monitor performance

### Week 9-12: Threshold Encryption

- Implement encryption library
- Deploy IntentMempool
- Test encrypted intent flow
- Security audit

### Week 13-16: Full Decentralization

- Enable reputation system
- Activate slashing
- Launch RelayerDAO
- Remove centralized relayer

---

## Success Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| Active relayers | 10+ | Month 3 |
| Decentralization ratio | >80% | Month 4 |
| Uptime | >99.9% | Month 6 |
| Average execution time | <30s | Month 3 |
| Slashing events | <1/month | Month 6 |

---

## Security Considerations

### Attack Vectors

1. **Relayer Collusion**
   - Mitigation: Threshold >50%, reputation system
   
2. **Sybil Attack**
   - Mitigation: Stake requirement, reputation decay
   
3. **Censorship**
   - Mitigation: Timeout slashing, multiple relayers
   
4. **MEV Extraction**
   - Mitigation: Encrypted intents, commit-reveal

### Audits Required

- [ ] Smart contract audit (RelayerRegistry, IntentMempool)
- [ ] Cryptography audit (threshold encryption)
- [ ] Economic audit (incentive mechanism)
- [ ] Security audit (slashing conditions)

---

## Open Questions

1. **Encryption scheme**: Use existing (e.g., BLS threshold) or custom?
2. **Relayer selection**: Random, auction, or reputation-based?
3. **Cross-chain**: How to coordinate relayers across chains?
4. **Upgradability**: How to upgrade without centralization?

---

## References

- [Flashbots MEV-Share](https://docs.flashbots.net/flashbots-mev-share/overview) - Encrypted orderflow
- [Anoma Intent Gossip](https://specs.anoma.net/main/architecture/intent-gossip.html) - Decentralized intent matching
- [CoW Protocol](https://docs.cow.fi/) - Batch auction mechanism
- [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) - Set EOA account code

---

## Conclusion

Phase 3 transforms ZeroToll from a **centralized relayer** to a **decentralized network**, eliminating trust assumptions while maintaining the gasless UX.

**Timeline**: 4-6 months
**Investment**: ~$200K (development + audits)
**Impact**: First truly decentralized gasless DEX
