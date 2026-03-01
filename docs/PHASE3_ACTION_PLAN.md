# Phase 3 Implementation: Action Plan

## Overview

This document outlines the step-by-step implementation of Phase 3: EIP-7702 Integration and Decentralized Relayer Network.

**Timeline**: 4-6 months
**Current Status**: Ready to begin
**Priority**: High (addresses judge concerns about trust)

---

## Part A: EIP-7702 Integration (Weeks 1-4)

### Benefits
- 50% gas savings vs ERC-4337
- Relayer cannot frontrun (intent executed atomically)
- Fee calculated on-chain (trustless)
- Native token output built-in

### Week 1: Deploy Delegate Contract

#### ✅ Prerequisites Complete
- [x] ZeroTollDelegate.sol contract written
- [x] Deployment script ready
- [x] RouterV3 addresses configured
- [x] EIP-7702 relayer code written

#### Tasks

**1.1 Deploy to Polygon Amoy**
```bash
cd packages/contracts
npx hardhat run scripts/deploy-zerotoll-delegate.js --network amoy
```

Expected output:
- ZeroTollDelegate address
- Domain separator
- Verification on PolygonScan

**1.2 Deploy to Ethereum Sepolia**
```bash
npx hardhat run scripts/deploy-zerotoll-delegate.js --network sepolia
```

**1.3 Update Configuration Files**

Update `backend/eip7702-relayer.mjs`:
```javascript
const DELEGATE_ADDRESS = {
  80002: '0x...', // From Amoy deployment
  11155111: '0x...' // From Sepolia deployment
};
```

Update `frontend/src/config/contracts.json`:
```json
{
  "80002": {
    "zeroTollDelegate": "0x...",
    ...
  },
  "11155111": {
    "zeroTollDelegate": "0x...",
    ...
  }
}
```

**1.4 Test Deployment**
```bash
# Test health check
node backend/eip7702-relayer.mjs health 80002
node backend/eip7702-relayer.mjs health 11155111

# Test nonce retrieval
node backend/eip7702-relayer.mjs nonce 80002 0xYOUR_ADDRESS
```

---

### Week 2: Integrate EIP-7702 Endpoint

#### Tasks

**2.1 Add EIP-7702 Route to Backend**

Create `backend/routes/eip7702.mjs`:
```javascript
import express from 'express';
import { executeSwap7702, getUserNonce, calculateFee } from '../eip7702-relayer.mjs';

const router = express.Router();

// Get quote for EIP-7702 swap
router.post('/quote', async (req, res) => {
  try {
    const { chainId, tokenIn, tokenOut, amountIn } = req.body;
    
    // Calculate fee
    const fee = await calculateFee(chainId, tokenIn, amountIn);
    
    // Get expected output (from DEX)
    const quote = await getQuote(chainId, tokenIn, tokenOut, amountIn - fee);
    
    res.json({
      success: true,
      quote: {
        amountIn,
        amountOut: quote.amountOut,
        fee,
        feePercent: (fee / amountIn * 100).toFixed(2),
        path: quote.path,
        gasEstimate: '150000' // EIP-7702 is ~50% cheaper
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute EIP-7702 swap
router.post('/execute', async (req, res) => {
  try {
    const { chainId, authorization, permit, intent, intentSignature, fee } = req.body;
    
    // Execute swap
    const result = await executeSwap7702({
      chainId,
      authorization,
      permit,
      intent,
      intentSignature,
      fee
    });
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user nonce
router.get('/nonce/:chainId/:address', async (req, res) => {
  try {
    const { chainId, address } = req.params;
    const nonce = await getUserNonce(parseInt(chainId), address);
    
    res.json({
      success: true,
      nonce
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
```

**2.2 Update `backend/server.py`**

Add EIP-7702 route:
```python
# Import EIP-7702 router
from routes.eip7702 import eip7702_bp

# Register blueprint
app.register_blueprint(eip7702_bp, url_prefix='/api/eip7702')
```

**2.3 Test Endpoints**
```bash
# Start backend
cd backend
python server.py

# Test quote
curl -X POST http://localhost:3002/api/eip7702/quote \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 80002,
    "tokenIn": "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    "tokenOut": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
    "amountIn": "100000000"
  }'

# Test nonce
curl http://localhost:3002/api/eip7702/nonce/80002/0xYOUR_ADDRESS
```

---

### Week 3: Frontend Integration

#### Tasks

**3.1 Create EIP-7702 Hook**

Create `frontend/src/hooks/useEIP7702Swap.js`:
```javascript
import { useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { signAuthorization } from 'viem/experimental';

export function useEIP7702Swap() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);
  
  const executeSwap = async ({ tokenIn, tokenOut, amountIn, minAmountOut, chainId }) => {
    setLoading(true);
    
    try {
      // 1. Get nonce
      const nonceRes = await fetch(`/api/eip7702/nonce/${chainId}/${address}`);
      const { nonce } = await nonceRes.json();
      
      // 2. Get quote
      const quoteRes = await fetch('/api/eip7702/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId, tokenIn, tokenOut, amountIn })
      });
      const { quote } = await quoteRes.json();
      
      // 3. Sign EIP-7702 authorization
      const authorization = await signAuthorization({
        account: address,
        contractAddress: DELEGATE_ADDRESS[chainId],
        chainId,
        nonce: 0 // First time delegation
      });
      
      // 4. Sign permit (ERC-2612)
      const permit = await signPermit(tokenIn, amountIn);
      
      // 5. Sign intent (EIP-712)
      const intent = {
        user: address,
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        nonce,
        chainId
      };
      
      const intentSignature = await signTypedDataAsync({
        domain: {
          name: 'ZeroTollDelegate',
          version: '1',
          chainId,
          verifyingContract: DELEGATE_ADDRESS[chainId]
        },
        types: {
          SwapIntent: [
            { name: 'user', type: 'address' },
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'minAmountOut', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'chainId', type: 'uint256' }
          ]
        },
        primaryType: 'SwapIntent',
        message: intent
      });
      
      // 6. Execute swap via relayer
      const executeRes = await fetch('/api/eip7702/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainId,
          authorization,
          permit,
          intent,
          intentSignature,
          fee: quote.fee
        })
      });
      
      const result = await executeRes.json();
      return result;
      
    } finally {
      setLoading(false);
    }
  };
  
  return { executeSwap, loading };
}
```

**3.2 Add EIP-7702 Toggle to UI**

Update `frontend/src/components/SwapInterface.jsx`:
```jsx
const [useEIP7702, setUseEIP7702] = useState(true);

// Add toggle
<div className="flex items-center gap-2 mb-4">
  <input
    type="checkbox"
    checked={useEIP7702}
    onChange={(e) => setUseEIP7702(e.target.checked)}
  />
  <label>Use EIP-7702 (50% cheaper gas)</label>
</div>
```

**3.3 Test Frontend**
```bash
cd frontend
npm start

# Test swap with EIP-7702
# Compare gas costs with ERC-4337
```

---

### Week 4: Testing & Optimization

#### Tasks

**4.1 End-to-End Testing**
- [ ] Test USDC → POL swap on Amoy
- [ ] Test USDC → ETH swap on Sepolia
- [ ] Test native token output (unwrap)
- [ ] Test error cases (expired deadline, invalid signature)
- [ ] Test nonce increment

**4.2 Gas Comparison**
- [ ] Measure ERC-4337 gas cost
- [ ] Measure EIP-7702 gas cost
- [ ] Document savings (target: 50%)

**4.3 Security Review**
- [ ] Review signature verification
- [ ] Test replay attack prevention
- [ ] Test fee cap enforcement
- [ ] Test slippage protection

**4.4 Documentation**
- [ ] Update README with EIP-7702 instructions
- [ ] Create user guide
- [ ] Document gas savings
- [ ] Update JUDGE_RESPONSE.md

---

## Part B: Decentralized Relayer Network (Weeks 5-16)

### Week 5-8: Relayer Registry

#### Tasks

**5.1 Deploy RelayerRegistry Contract**
```solidity
// Already designed in PHASE3_DECENTRALIZATION.md
// Deploy to Amoy and Sepolia
```

**5.2 Onboard Initial Relayers**
- Recruit 5-10 relayers
- Each stakes 10 ETH/POL
- Distribute relayer software

**5.3 Test Multi-Relayer Execution**
- Multiple relayers compete
- First to execute wins
- Monitor performance

---

### Week 9-12: Threshold Encryption

#### Tasks

**6.1 Implement Encryption Library**
- Use BLS threshold signatures
- 3-of-5 threshold
- Test encryption/decryption

**6.2 Deploy IntentMempool Contract**
- Store encrypted intents
- Relayers decrypt collaboratively
- Execute and claim rewards

**6.3 Security Audit**
- Audit encryption scheme
- Audit smart contracts
- Fix vulnerabilities

---

### Week 13-16: Full Decentralization

#### Tasks

**7.1 Enable Reputation System**
- Track successful executions
- Slash bad actors
- Reward good relayers

**7.2 Launch RelayerDAO**
- Relayers vote on parameters
- Governance proposals
- Parameter updates

**7.3 Remove Centralized Relayer**
- Gradual migration
- Monitor uptime
- Emergency fallback

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| EIP-7702 deployed | 2 networks | 🔄 In Progress |
| Gas savings | >50% | ⏳ Pending |
| Active relayers | 10+ | ⏳ Pending |
| Decentralization | >80% | ⏳ Pending |
| Uptime | >99.9% | ⏳ Pending |

---

## Next Steps

1. **Deploy ZeroTollDelegate** to Amoy and Sepolia
2. **Update configuration** files with addresses
3. **Test EIP-7702** swaps end-to-end
4. **Measure gas savings** and document
5. **Update documentation** for judges

---

## Resources

- [EIP-7702 Spec](https://eips.ethereum.org/EIPS/eip-7702)
- [Viem EIP-7702 Docs](https://viem.sh/experimental/eip7702)
- [Polygon Amoy EIP-7702 Support](https://polygon.technology/blog/eip-7702-support)
- [Phase 3 Decentralization Plan](./PHASE3_DECENTRALIZATION.md)
- [Implementation Guide](./PHASE3_IMPLEMENTATION_GUIDE.md)

---

**Status**: Ready to deploy
**Next Action**: Deploy ZeroTollDelegate to Amoy
**Owner**: Development Team
**Timeline**: Week 1 starts now
