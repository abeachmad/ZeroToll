# 🌉 ZeroToll Cross-Chain Strategy & Implementation Plan
**Date:** November 8, 2025  
**Status:** Planning → Implementation  
**Goal:** Enable real cross-chain swaps (Sepolia ↔ Amoy, future L2s)

---

## 🎯 Current Status

### What Works ✅
- **Same-chain swaps:** Sepolia USDC → WETH ✅
- **Same-chain swaps:** Amoy USDC → WMATIC ✅
- **Smart contracts:** RouterHub, MockDEXAdapter deployed ✅
- **Backend:** Intent-based routing working ✅
- **Frontend:** Multi-chain UI ready ✅

### What's Missing ❌
- **Cross-chain bridging:** MockBridgeAdapter is simulation-only
- **Message passing:** No L1 ↔ L2 communication
- **Liquidity on destination:** No way to deliver tokens cross-chain

---

## 🏗️ Architecture Options

### Option 1: Polygon PoS Bridge (Native, Recommended for PoC)
**Best for:** Ethereum ↔ Polygon communication

**How it works:**
```
Ethereum (Sepolia)          →         Polygon (Amoy)
─────────────────────────────────────────────────────
1. User deposits USDC
2. RootChainManager locks tokens
3. State sync to Polygon
4. ChildChainManager mints wrapped tokens
5. User receives on Polygon

Reverse for Polygon → Ethereum (burn & unlock)
```

**Pros:**
- ✅ Official Polygon bridge (secure)
- ✅ Native to Polygon ecosystem
- ✅ Well-documented, battle-tested
- ✅ No third-party risk

**Cons:**
- ⏰ Slow (7-day challenge period for withdrawals)
- 🔗 Only Ethereum ↔ Polygon (not multi-chain)
- 💰 High gas on Ethereum mainnet (less on Sepolia)

**Implementation Complexity:** ⭐⭐⭐ (Medium)

---

### Option 2: LayerZero (Omnichain, Production-Ready)
**Best for:** Multi-chain (Ethereum, Polygon, Arbitrum, Optimism, etc.)

**How it works:**
```
Source Chain                →         Destination Chain
──────────────────────────────────────────────────────
1. User calls OFT.send() 
2. LayerZero Endpoint emits event
3. Oracle + Relayer verify
4. Endpoint on dest chain receives
5. OFT mints/unlocks tokens

Ultra Light Node (ULN) for security
```

**Pros:**
- ✅ Omnichain (works on 50+ chains)
- ✅ Fast (minutes, not days)
- ✅ Composable (can call functions on destination)
- ✅ Active ecosystem, good docs

**Cons:**
- 💰 Costs: Oracle + Relayer fees (~$1-5 per TX)
- 🎓 Learning curve for OFT (Omnichain Fungible Token)
- 🔐 Trust assumptions (Oracle + Relayer)

**Implementation Complexity:** ⭐⭐⭐⭐ (Medium-High)

---

### Option 3: Axelar (Interoperability Protocol)
**Best for:** Full cross-chain dApp (messages + tokens)

**How it works:**
```
Source Chain                →         Destination Chain
──────────────────────────────────────────────────────
1. User calls AxelarGateway
2. Validators sign message
3. Relayer broadcasts to dest
4. Gateway on dest executes
5. Contract receives tokens/message

Delegated Proof-of-Stake validator set
```

**Pros:**
- ✅ Full interoperability (tokens + data)
- ✅ SDK for EVM + Cosmos chains
- ✅ GMP (General Message Passing)
- ✅ Cosmos ecosystem integration

**Cons:**
- 💰 Fees (gas + relayer)
- 🎓 Complex setup (Satellite, GMP)
- 🔐 Validator trust model

**Implementation Complexity:** ⭐⭐⭐⭐⭐ (High)

---

### Option 4: Wormhole (Guardian Network)
**Best for:** Multi-chain with focus on Solana/EVM

**How it works:**
```
Source Chain                →         Destination Chain
──────────────────────────────────────────────────────
1. User locks tokens
2. Guardians observe & sign
3. VAA (Verified Action Approval)
4. Relayer submits to dest
5. Tokens minted/unlocked

Guardian network (19 validators)
```

**Pros:**
- ✅ Strong Solana <> EVM bridge
- ✅ Fast (< 1 minute finality)
- ✅ Connect SDK for developers
- ✅ Token bridge + Generic messaging

**Cons:**
- 💰 Relayer costs
- 🔐 Guardian trust (had $325M hack in 2022, now fixed)
- 🎓 VAA complexity

**Implementation Complexity:** ⭐⭐⭐⭐ (Medium-High)

---

### Option 5: Hyperlane (Modular Interoperability)
**Best for:** Customizable security models

**How it works:**
```
Source Chain                →         Destination Chain
──────────────────────────────────────────────────────
1. User calls Mailbox.dispatch()
2. Validators sign (configurable)
3. Relayer delivers message
4. Mailbox.process() on dest
5. Recipient contract receives

Modular security (choose your validators)
```

**Pros:**
- ✅ Permissionless (deploy to any chain)
- ✅ Sovereign security (choose validators)
- ✅ Interchain Accounts (call contracts remotely)
- ✅ Warp Routes (token bridge)

**Cons:**
- 🎓 Need to configure ISM (Interchain Security Module)
- 💰 Run own relayer or pay for service
- 📚 Newer, less battle-tested

**Implementation Complexity:** ⭐⭐⭐⭐ (Medium-High)

---

## 🏆 RECOMMENDED APPROACH: LayerZero V2

### Why LayerZero?
1. ✅ **Production-ready:** Used by Stargate, PancakeSwap, Trader Joe
2. ✅ **Multi-chain:** Supports Sepolia, Amoy, Arb Sepolia, OP Sepolia
3. ✅ **Composable:** Can call RouterHub.executeIntent() on dest chain
4. ✅ **Fast:** Sub-minute confirmation
5. ✅ **Good docs:** https://docs.layerzero.network

---

## 📐 Implementation Plan

### Phase 1: Foundation (Week 1)
**Goal:** Understand LayerZero OFT & Endpoint

**Tasks:**
1. ✅ Study LayerZero V2 docs
2. ✅ Deploy OFT (Omnichain Fungible Token) testnet
3. ✅ Test simple cross-chain token transfer
4. ✅ Integrate with existing RouterHub

**Deliverable:** Working USDC bridge Sepolia ↔ Amoy

---

### Phase 2: ZeroToll Integration (Week 2)
**Goal:** Intent-based cross-chain swaps

**Architecture:**
```
┌─────────────────┐                    ┌─────────────────┐
│  Sepolia        │                    │  Amoy           │
│                 │                    │                 │
│  User           │  1. Intent         │                 │
│    ↓            │ ──────────────────→│                 │
│  RouterHub      │  2. LZ Message     │  RouterHub      │
│    ↓            │                    │    ↓            │
│  LZ Endpoint    │  3. Bridge USDC    │  LZ Endpoint    │
│    ↓            │ ──────────────────→│    ↓            │
│  (lock tokens)  │                    │  (mint tokens)  │
│                 │                    │    ↓            │
│                 │  4. Execute swap   │  MockDEXAdapter │
│                 │                    │    ↓            │
│                 │                    │  Deliver WMATIC │
│                 │ ←──────────────────│  (to user!)     │
│                 │  5. Confirmation   │                 │
└─────────────────┘                    └─────────────────┘
```

**Smart Contract Changes:**

**New Contract: `CrossChainRouterHub.sol`**
```solidity
contract CrossChainRouterHub is RouterHub, OApp {
    // Inherit from LayerZero OApp
    
    function executeCrossChainIntent(
        Intent calldata intent,
        uint32 dstEid // LayerZero endpoint ID
    ) external payable {
        // 1. Validate intent
        require(intent.dstChainId != block.chainid, "Use executeIntent for same-chain");
        
        // 2. Pull tokens from user
        IERC20(intent.tokenIn).safeTransferFrom(
            intent.user,
            address(this),
            intent.amtIn
        );
        
        // 3. Encode intent for destination
        bytes memory payload = abi.encode(intent);
        
        // 4. Send via LayerZero
        _lzSend(
            dstEid,
            payload,
            _getOptions(), // Gas options for dest
            MessagingFee(msg.value, 0), // Pay with native token
            payable(msg.sender)
        );
        
        emit CrossChainIntentSent(intent, dstEid);
    }
    
    function _lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata payload,
        address executor,
        bytes calldata extraData
    ) internal override {
        // 1. Decode intent
        Intent memory intent = abi.decode(payload, (Intent));
        
        // 2. Execute swap on destination chain
        _executeIntentLocal(intent);
        
        // 3. Transfer output tokens to user
        IERC20(intent.tokenOut).safeTransfer(intent.user, outputAmount);
        
        emit CrossChainIntentExecuted(intent, guid);
    }
}
```

**Key Features:**
- ✅ Inherits from existing RouterHub (reuse logic)
- ✅ Uses LayerZero OApp for messaging
- ✅ User pays LZ fees in native token (ETH/MATIC)
- ✅ Atomic cross-chain swap + deliver

---

### Phase 3: Production Hardening (Week 3)
**Goal:** Security, monitoring, error handling

**Tasks:**
1. ✅ Add replay protection (nonce, deadline)
2. ✅ Implement retry logic for failed messages
3. ✅ Add event monitoring & alerts
4. ✅ Gas estimation for cross-chain fees
5. ✅ Slippage protection across chains
6. ✅ Emergency pause mechanism

**Security Checklist:**
- [ ] Reentrancy guards
- [ ] Access control (onlyOwner, onlyEndpoint)
- [ ] Input validation (amounts, addresses, chainIds)
- [ ] Safe math (Solidity 0.8+ has built-in)
- [ ] Emergency withdraw (for stuck funds)

---

### Phase 4: UI/UX (Week 4)
**Goal:** Seamless user experience

**Frontend Updates:**
```jsx
// Cross-chain quote
const quoteCrossChain = async (fromChain, toChain, tokenIn, tokenOut, amount) => {
  // 1. Get same-chain quote on destination
  const destQuote = await getQuote(toChain, tokenIn, tokenOut, amount);
  
  // 2. Get LayerZero fee estimate
  const lzFee = await estimateLzFee(fromChain.lzEid, toChain.lzEid, payload);
  
  // 3. Total cost = swap fee + bridge fee
  return {
    outputAmount: destQuote.netOut,
    lzFee: lzFee.nativeFee, // in ETH/MATIC
    totalCost: destQuote.feeUSD + lzFee.usdValue,
    estimatedTime: "~2 minutes"
  };
};

// Cross-chain execute
const executeCrossChain = async () => {
  // 1. Approve tokens on source chain
  await approveToken(tokenIn, amount);
  
  // 2. Get LZ fee quote
  const lzFee = await quoteLzFee();
  
  // 3. Call CrossChainRouterHub.executeCrossChainIntent()
  const tx = await crossChainRouterHub.executeCrossChainIntent(
    intent,
    destChain.lzEid,
    { value: lzFee.nativeFee } // Pay LZ fee
  );
  
  // 4. Show status: "Bridging..." → "Swapping..." → "Complete!"
  monitorCrossChainTx(tx.hash);
};
```

**UX Flow:**
```
┌────────────────────────────────────────────┐
│  1. Select: Sepolia USDC → Amoy WMATIC    │
│                                            │
│  ↓                                         │
│  2. Get Quote:                             │
│     Output: 10 WMATIC                      │
│     Bridge Fee: 0.002 ETH (~$7)            │
│     Est. Time: ~2 min                      │
│                                            │
│  ↓                                         │
│  3. Approve USDC (if needed)               │
│     ✅ Approved                            │
│                                            │
│  ↓                                         │
│  4. Execute Cross-Chain Swap               │
│     [Button: Pay 0.002 ETH + Execute]      │
│                                            │
│  ↓                                         │
│  5. Status Tracker:                        │
│     ✅ Tokens locked on Sepolia            │
│     🔄 Bridging via LayerZero...           │
│     ✅ Received on Amoy                    │
│     🔄 Executing swap...                   │
│     ✅ WMATIC delivered!                   │
│                                            │
│  ✓ Transaction Complete                   │
│    View on Sepolia: 0xabc...               │
│    View on Amoy: 0xdef...                  │
└────────────────────────────────────────────┘
```

---

## 💰 Cost Analysis

### LayerZero Fees (Testnet estimates):
- **Oracle fee:** ~$0.10 per message
- **Relayer fee:** ~$0.50 per message
- **Gas on dest:** ~$0.20 (for swap execution)
- **Total:** ~$0.80 per cross-chain swap

### Comparison:
| Bridge | Speed | Cost | Chains | Security |
|--------|-------|------|--------|----------|
| Polygon PoS | 7 days | Free* | 2 | Native |
| LayerZero | 2 min | $0.80 | 50+ | Oracles |
| Axelar | 5 min | $1.50 | 50+ | PoS |
| Wormhole | 1 min | $1.00 | 30+ | Guardians |

*Polygon PoS: Free bridging but high Ethereum gas

---

## 🚀 Quick Start (Next Steps)

### Step 1: Setup LayerZero Testnet
```bash
# Install dependencies
cd packages/contracts
npm install @layerzerolabs/lz-evm-oapp-v2

# Create CrossChainRouterHub
npx hardhat create-contract CrossChainRouterHub
```

### Step 2: Deploy to Testnets
```bash
# Deploy to Sepolia
npx hardhat deploy --network sepolia --tags CrossChainRouterHub

# Deploy to Amoy  
npx hardhat deploy --network amoy --tags CrossChainRouterHub

# Set peers (connect the contracts)
npx hardhat lz:set-peer --network sepolia --remote-network amoy
```

### Step 3: Test Cross-Chain Transfer
```bash
# Send test message
npx hardhat lz:send \
  --from sepolia \
  --to amoy \
  --amount 1000000 \ # 1 USDC
  --token USDC

# Monitor status
npx hardhat lz:track --tx-hash 0x...
```

### Step 4: Integrate with Backend
```python
# backend/layerzero_service.py
class LayerZeroService:
    def estimate_fee(self, src_chain, dst_chain, payload):
        """Get LZ fee quote"""
        endpoint = get_lz_endpoint(src_chain)
        return endpoint.quote(dst_chain, payload, options)
    
    def execute_cross_chain(self, intent):
        """Send cross-chain intent via LZ"""
        tx = cross_chain_router.executeCrossChainIntent(
            intent,
            dst_eid,
            value=lz_fee
        )
        return tx.hash
```

---

## ⏱️ Timeline

**Week 1 (Foundation):**
- Days 1-2: LayerZero V2 tutorial & docs
- Days 3-4: Deploy OFT testnet, test transfers
- Days 5-7: Write CrossChainRouterHub contract

**Week 2 (Integration):**
- Days 1-3: Deploy to Sepolia + Amoy, set peers
- Days 4-5: Backend LayerZero service
- Days 6-7: End-to-end testing

**Week 3 (Hardening):**
- Days 1-3: Security audit (self-review)
- Days 4-5: Error handling & monitoring
- Days 6-7: Gas optimization

**Week 4 (UI/UX):**
- Days 1-3: Frontend cross-chain UI
- Days 4-5: User testing & feedback
- Days 6-7: Documentation & demo

**Total:** ~4 weeks to production-ready cross-chain swaps

---

## 🎓 Learning Resources

### LayerZero V2:
- **Docs:** https://docs.layerzero.network/v2
- **OApp Template:** https://github.com/LayerZero-Labs/devtools
- **OFT Standard:** https://docs.layerzero.network/v2/developers/evm/oft/quickstart
- **Endpoint IDs:** https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts

### Polygon PoS Bridge:
- **Docs:** https://docs.polygon.technology/pos/how-to/bridging/ethereum-polygon/
- **SDK:** https://github.com/maticnetwork/matic.js

### Axelar:
- **Docs:** https://docs.axelar.dev/
- **GMP:** https://docs.axelar.dev/dev/general-message-passing/overview

---

## 📊 Success Metrics

**After implementation:**
- ✅ Cross-chain swaps working (Sepolia ↔ Amoy)
- ✅ Success rate > 95%
- ✅ Average time < 3 minutes
- ✅ User can track status in UI
- ✅ Costs transparent & predictable

**Then we can move to:**
- 🚀 **Gasless transactions** (ERC-4337 Paymaster)
- 🚀 **Account Abstraction** (Social login, no seed phrase)
- 🚀 **Automated routing** (Best price across all bridges)

---

## 🔑 Key Decision: Start with LayerZero

**Reasoning:**
1. ✅ **Fastest time-to-market:** Good docs, active support
2. ✅ **Best for testnets:** Supports Sepolia, Amoy out-of-box
3. ✅ **Production-proven:** Billions in TVL secured
4. ✅ **Extensible:** Can add other bridges later (Axelar, Wormhole)

**Next Action:** Deploy LayerZero OFT on Sepolia + Amoy this week!

---

**Status:** 📋 **READY TO IMPLEMENT**  
**Owner:** Development Team  
**Timeline:** 4 weeks  
**Priority:** HIGH (blocker for Paymaster strategy)
