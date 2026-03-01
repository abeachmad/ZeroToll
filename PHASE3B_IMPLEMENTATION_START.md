# Phase 3B Implementation: Decentralized Relayer Network

**Start Date**: 2026-03-01  
**Target Completion**: 2026-05-24 (12 weeks)  
**Status**: 🚀 Starting Now

---

## 📋 Overview

Building a decentralized relayer network to eliminate single point of trust and prevent frontrunning.

### Key Components:
1. **RelayerRegistry** - Staking, registration, reputation
2. **Threshold Encryption** - Prevent intent frontrunning
3. **Economic Security** - Slashing for bad behavior
4. **Multi-Relayer Competition** - Best execution wins

---

## 🗓️ Week-by-Week Plan

### Week 5 (Mar 1-7): RelayerRegistry Design & Core Logic

**Goal**: Design and implement core RelayerRegistry contract

**Tasks**:
- [x] Strategic decision documented
- [ ] Design contract architecture
- [ ] Define staking requirements
- [ ] Define slashing conditions
- [ ] Implement registration logic
- [ ] Write initial tests

**Deliverables**:
- `RelayerRegistry.sol` contract
- Architecture documentation
- Test suite (>80% coverage)

---

### Week 6 (Mar 8-14): Reputation & Reward System

**Goal**: Implement reputation tracking and reward distribution

**Tasks**:
- [ ] Design reputation algorithm
- [ ] Implement execution tracking
- [ ] Implement reward calculation
- [ ] Add reputation decay mechanism
- [ ] Test reward distribution

**Deliverables**:
- Reputation system working
- Reward distribution automated
- Performance metrics tracked

---

### Week 7 (Mar 15-21): Slashing & Security

**Goal**: Implement slashing mechanism and security features

**Tasks**:
- [ ] Define slashing conditions (failed execution, timeout, etc.)
- [ ] Implement slashing logic
- [ ] Add dispute resolution
- [ ] Security audit preparation
- [ ] Test edge cases

**Deliverables**:
- Slashing mechanism complete
- Security documentation
- Edge case tests

---

### Week 8 (Mar 22-28): Deployment & Integration

**Goal**: Deploy RelayerRegistry and integrate with existing system

**Tasks**:
- [ ] Deploy to Amoy testnet
- [ ] Deploy to Sepolia testnet
- [ ] Update relayer to register on-chain
- [ ] Update backend to check registry
- [ ] Integration testing

**Deliverables**:
- RelayerRegistry deployed on 2 networks
- Relayer integrated with registry
- Integration tests passing

---

### Week 9 (Mar 29 - Apr 4): Threshold Encryption Research

**Goal**: Research and select threshold encryption scheme

**Tasks**:
- [ ] Research Shamir's Secret Sharing
- [ ] Research BLS threshold signatures
- [ ] Compare schemes (security, performance, complexity)
- [ ] Select best approach for our use case
- [ ] Design key management system

**Deliverables**:
- Encryption scheme selected
- Technical specification document
- Key management design

---

### Week 10 (Apr 5-11): Encryption Implementation

**Goal**: Implement threshold encryption library

**Tasks**:
- [ ] Implement encryption library
- [ ] Implement decryption library
- [ ] Add key generation
- [ ] Add key distribution
- [ ] Write comprehensive tests

**Deliverables**:
- Encryption library working
- Test suite (>90% coverage)
- Performance benchmarks

---

### Week 11 (Apr 12-18): Frontend Integration

**Goal**: Integrate encryption into frontend

**Tasks**:
- [ ] Add encryption to intent signing flow
- [ ] Encrypt before broadcasting
- [ ] Update UI to show encryption status
- [ ] Test encrypted intent flow
- [ ] Add error handling

**Deliverables**:
- Frontend encrypts all intents
- User sees encryption confirmation
- Encrypted intents in mempool

---

### Week 12 (Apr 19-25): Relayer Decryption

**Goal**: Integrate decryption into relayer

**Tasks**:
- [ ] Add decryption to relayer
- [ ] Implement key management
- [ ] Test decryption flow
- [ ] Add monitoring
- [ ] Performance optimization

**Deliverables**:
- Relayer decrypts intents
- End-to-end encrypted flow working
- Monitoring dashboard

---

### Week 13 (Apr 26 - May 2): Relayer Onboarding

**Goal**: Onboard first batch of independent relayers

**Tasks**:
- [ ] Create relayer operator guide
- [ ] Set up relayer infrastructure template
- [ ] Onboard 5 initial relayers
- [ ] Test multi-relayer execution
- [ ] Monitor performance

**Deliverables**:
- 5+ registered relayers
- Operator documentation
- Infrastructure templates

---

### Week 14 (May 3-9): Competition & Rewards

**Goal**: Implement and test relayer competition

**Tasks**:
- [ ] Test multiple relayers competing
- [ ] Optimize reward distribution
- [ ] Add performance monitoring
- [ ] Test failover scenarios
- [ ] Optimize gas costs

**Deliverables**:
- Multi-relayer competition working
- Rewards distributed correctly
- Failover tested

---

### Week 15 (May 10-16): Scaling & Optimization

**Goal**: Scale to 10+ relayers and optimize

**Tasks**:
- [ ] Onboard 5 more relayers (total 10+)
- [ ] Optimize execution speed
- [ ] Reduce gas costs
- [ ] Improve monitoring
- [ ] Load testing

**Deliverables**:
- 10+ active relayers
- Performance optimized
- Load tests passing

---

### Week 16 (May 17-23): Launch & Documentation

**Goal**: Launch decentralized network and finalize documentation

**Tasks**:
- [ ] Final security review
- [ ] Update all documentation
- [ ] Create demo video
- [ ] Write launch announcement
- [ ] Monitor launch

**Deliverables**:
- Decentralized network live
- Complete documentation
- Demo video
- Launch announcement

---

## 🎯 Success Metrics

| Metric | Target | Current | Week 16 Goal |
|--------|--------|---------|--------------|
| Registered Relayers | 10+ | 1 | ✅ 10+ |
| Decentralization Ratio | >80% | 0% | ✅ >80% |
| Encrypted Intents | 100% | 0% | ✅ 100% |
| Uptime | >99.9% | 99% | ✅ >99.9% |
| Avg Execution Time | <30s | 25s | ✅ <30s |
| Slashing Events | 0 | 0 | ✅ 0 |
| Failed Executions | <1% | <1% | ✅ <1% |

---

## 🏗️ Technical Architecture

### Current (Centralized)
```
User → Frontend → Single Relayer → Blockchain
                      ↓
                  (Trust Required)
```

### Target (Decentralized)
```
User → Frontend → Encrypted Intent → Mempool
                                        ↓
                    ┌──────────────────┴──────────────────┐
                    ↓                  ↓                   ↓
                Relayer 1          Relayer 2           Relayer 3
                (Stake: 10 ETH)    (Stake: 10 ETH)     (Stake: 10 ETH)
                    ↓                  ↓                   ↓
                    └──────────────────┬──────────────────┘
                                       ↓
                            First to Execute Wins
                                       ↓
                            RelayerRegistry (On-Chain)
                                       ↓
                        ┌──────────────┴──────────────┐
                        ↓                             ↓
                  Record Execution              Distribute Reward
                  Update Reputation             Slash if Failed
```

---

## 📝 Contract Design: RelayerRegistry

### Core Functions

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RelayerRegistry {
    // Minimum stake required to become a relayer
    uint256 public constant MIN_STAKE = 10 ether;
    
    // Maximum number of active relayers
    uint256 public constant MAX_RELAYERS = 100;
    
    // Slashing percentage for failed execution
    uint256 public constant SLASH_PERCENTAGE = 10; // 10%
    
    struct Relayer {
        address relayerAddress;
        uint256 stake;
        uint256 reputation; // 0-1000 (1000 = perfect)
        uint256 successfulExecutions;
        uint256 failedExecutions;
        uint256 totalRewards;
        uint256 registeredAt;
        bool active;
    }
    
    // Relayer address => Relayer info
    mapping(address => Relayer) public relayers;
    
    // Array of active relayer addresses
    address[] public activeRelayers;
    
    // Intent hash => Relayer who executed
    mapping(bytes32 => address) public intentExecutor;
    
    // Events
    event RelayerRegistered(address indexed relayer, uint256 stake);
    event RelayerUnregistered(address indexed relayer, uint256 returnedStake);
    event ExecutionRecorded(address indexed relayer, bytes32 indexed intentHash, bool success);
    event RewardDistributed(address indexed relayer, uint256 amount);
    event RelayerSlashed(address indexed relayer, uint256 amount, string reason);
    event ReputationUpdated(address indexed relayer, uint256 newReputation);
    
    // Registration
    function registerRelayer() external payable {
        require(msg.value >= MIN_STAKE, "Insufficient stake");
        require(!relayers[msg.sender].active, "Already registered");
        require(activeRelayers.length < MAX_RELAYERS, "Max relayers reached");
        
        relayers[msg.sender] = Relayer({
            relayerAddress: msg.sender,
            stake: msg.value,
            reputation: 1000, // Start with perfect reputation
            successfulExecutions: 0,
            failedExecutions: 0,
            totalRewards: 0,
            registeredAt: block.timestamp,
            active: true
        });
        
        activeRelayers.push(msg.sender);
        
        emit RelayerRegistered(msg.sender, msg.value);
    }
    
    function unregisterRelayer() external {
        require(relayers[msg.sender].active, "Not registered");
        
        Relayer storage relayer = relayers[msg.sender];
        uint256 returnAmount = relayer.stake;
        
        // Remove from active relayers
        _removeFromActiveRelayers(msg.sender);
        
        // Mark as inactive
        relayer.active = false;
        
        // Return stake
        (bool success, ) = msg.sender.call{value: returnAmount}("");
        require(success, "Transfer failed");
        
        emit RelayerUnregistered(msg.sender, returnAmount);
    }
    
    // Execution tracking
    function recordExecution(
        address relayer,
        bytes32 intentHash,
        bool success,
        uint256 reward
    ) external {
        require(relayers[relayer].active, "Relayer not active");
        
        Relayer storage r = relayers[relayer];
        
        if (success) {
            r.successfulExecutions++;
            r.totalRewards += reward;
            
            // Distribute reward
            (bool sent, ) = relayer.call{value: reward}("");
            require(sent, "Reward transfer failed");
            
            emit RewardDistributed(relayer, reward);
        } else {
            r.failedExecutions++;
            
            // Slash stake
            uint256 slashAmount = (r.stake * SLASH_PERCENTAGE) / 100;
            r.stake -= slashAmount;
            
            emit RelayerSlashed(relayer, slashAmount, "Failed execution");
            
            // If stake too low, deactivate
            if (r.stake < MIN_STAKE) {
                _removeFromActiveRelayers(relayer);
                r.active = false;
            }
        }
        
        // Update reputation
        _updateReputation(relayer);
        
        // Record executor
        intentExecutor[intentHash] = relayer;
        
        emit ExecutionRecorded(relayer, intentHash, success);
    }
    
    // Reputation calculation
    function _updateReputation(address relayer) internal {
        Relayer storage r = relayers[relayer];
        
        uint256 totalExecutions = r.successfulExecutions + r.failedExecutions;
        if (totalExecutions == 0) {
            r.reputation = 1000;
            return;
        }
        
        // Reputation = (successful / total) * 1000
        r.reputation = (r.successfulExecutions * 1000) / totalExecutions;
        
        emit ReputationUpdated(relayer, r.reputation);
    }
    
    // Helper functions
    function _removeFromActiveRelayers(address relayer) internal {
        for (uint256 i = 0; i < activeRelayers.length; i++) {
            if (activeRelayers[i] == relayer) {
                activeRelayers[i] = activeRelayers[activeRelayers.length - 1];
                activeRelayers.pop();
                break;
            }
        }
    }
    
    // View functions
    function getActiveRelayers() external view returns (address[] memory) {
        return activeRelayers;
    }
    
    function getRelayerInfo(address relayer) external view returns (Relayer memory) {
        return relayers[relayer];
    }
    
    function getRelayerCount() external view returns (uint256) {
        return activeRelayers.length;
    }
    
    function isRelayerActive(address relayer) external view returns (bool) {
        return relayers[relayer].active;
    }
}
```

---

## 🔐 Threshold Encryption Design

### Option 1: Shamir's Secret Sharing (Recommended for MVP)

**Pros**:
- Simple to implement
- Well-tested libraries available
- Good for 3-of-5 or 5-of-10 schemes

**Cons**:
- Requires trusted dealer for key generation
- Not as efficient as BLS

**Implementation**:
```javascript
// Frontend: Encrypt intent
const intent = { tokenIn, tokenOut, amountIn, minAmountOut, deadline };
const intentJson = JSON.stringify(intent);

// Split into 5 shares, require 3 to decrypt
const shares = shamirSecretSharing.split(intentJson, 5, 3);

// Distribute shares to 5 relayers
const encryptedIntent = {
  shares: shares.map((share, i) => ({
    relayerId: activeRelayers[i],
    encryptedShare: encrypt(share, relayers[i].publicKey)
  })),
  threshold: 3
};

// Broadcast encrypted intent
await broadcastIntent(encryptedIntent);
```

```javascript
// Relayer: Decrypt intent
const myShare = encryptedIntent.shares.find(s => s.relayerId === myAddress);
const decryptedShare = decrypt(myShare.encryptedShare, myPrivateKey);

// Collect 3 shares from other relayers
const shares = await collectShares(encryptedIntent, 3);

// Reconstruct intent
const intentJson = shamirSecretSharing.combine(shares);
const intent = JSON.parse(intentJson);

// Execute swap
await executeSwap(intent);
```

### Option 2: BLS Threshold Signatures (Future)

**Pros**:
- More efficient
- No trusted dealer needed
- Better for large networks

**Cons**:
- More complex to implement
- Requires BLS curve support

**Decision**: Start with Shamir's Secret Sharing for MVP, migrate to BLS in Phase 4.

---

## 📊 Monitoring Dashboard

### Metrics to Track

**Relayer Health**:
- Active relayers count
- Average stake amount
- Average reputation score
- Execution success rate

**Network Performance**:
- Average execution time
- Failed execution rate
- Slashing events
- Reward distribution

**Decentralization**:
- Decentralization ratio (1 - largest_relayer_share)
- Geographic distribution
- Uptime per relayer

**User Experience**:
- Intent encryption time
- Intent decryption time
- End-to-end execution time
- User satisfaction score

---

## 🚨 Risk Mitigation

### Risk 1: Not enough relayers
**Mitigation**: 
- Incentivize early relayers with bonus rewards
- Lower initial stake requirement (5 ETH instead of 10 ETH)
- Provide infrastructure templates and documentation

### Risk 2: Threshold encryption too slow
**Mitigation**:
- Optimize encryption library
- Use faster encryption scheme (AES + RSA hybrid)
- Implement caching

### Risk 3: Relayer collusion
**Mitigation**:
- Implement reputation decay
- Add randomness to relayer selection
- Monitor for suspicious patterns

### Risk 4: Timeline too aggressive
**Mitigation**:
- Focus on MVP features first
- Extend timeline by 2-4 weeks if needed
- Parallelize development where possible

---

## 📚 Documentation Plan

### For Relayer Operators
- [ ] Relayer setup guide
- [ ] Infrastructure requirements
- [ ] Staking guide
- [ ] Monitoring guide
- [ ] Troubleshooting guide

### For Developers
- [ ] RelayerRegistry API documentation
- [ ] Threshold encryption specification
- [ ] Integration guide
- [ ] Testing guide

### For Users
- [ ] How decentralization works
- [ ] Security guarantees
- [ ] FAQ

### For Judges
- [ ] Architecture overview
- [ ] Security analysis
- [ ] Decentralization metrics
- [ ] Comparison with competitors

---

## ✅ Next Immediate Steps (This Week)

1. **Create RelayerRegistry.sol contract** (Today)
2. **Write initial tests** (Tomorrow)
3. **Design reputation algorithm** (Day 3)
4. **Implement registration logic** (Day 4-5)
5. **Test on local network** (Day 6)
6. **Document architecture** (Day 7)

---

**Status**: 🚀 Phase 3B Started  
**Current Week**: Week 5 (RelayerRegistry Design)  
**Next Milestone**: RelayerRegistry deployed (Week 8)  
**Final Goal**: 10+ relayers, fully decentralized (Week 16)

Let's build a trustless, decentralized gasless swap network! 🚀
