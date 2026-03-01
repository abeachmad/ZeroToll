# Phase 2B: ZeroToll Fee Implementation Plan

## Overview

Implement a **dynamic fee mechanism** where ZeroToll charges **2x the gas cost** from the user's input token for gasless swaps. This creates sustainable revenue while keeping swaps attractive for users.

---

## Current State (Phase 2A) ✅

```
User: 2 zUSDC → Router → 1.99 zPOL (0.5% swap fee)
Paymaster: Pays gas from EntryPoint deposit
ZeroToll Revenue: $0 ❌
```

**Problem**: We sponsor gas but earn nothing. Unsustainable.

---

## Target State (Phase 2B)

```
User: 2 zUSDC
  ↓
ZeroToll Fee: 0.02 zUSDC (2x gas cost ~$0.01)
  ↓
Swap: 1.98 zUSDC → 1.97 zPOL
  ↓
User receives: 1.97 zPOL
Treasury receives: 0.02 zUSDC

ZeroToll Revenue: $0.01 per swap ✅
```

---

## Architecture

### Fee Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER SWAP FLOW                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User signs Permit + SwapIntent                               │
│         ↓                                                        │
│  2. Relayer calculates gas cost (from Pimlico gas price API)     │
│         ↓                                                        │
│  3. Relayer calculates fee = 2x gas cost in USD                  │
│         ↓                                                        │
│  4. Relayer converts fee to input token amount (via Pyth oracle) │
│         ↓                                                        │
│  5. Router.executeSwapWithPermit() called with fee parameter     │
│         ↓                                                        │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  ZeroTollRouterV2 (on-chain)                             │    │
│  │                                                          │    │
│  │  a. Transfer full amountIn from user (via permit)        │    │
│  │  b. Transfer feeAmount to Treasury                       │    │
│  │  c. Swap (amountIn - feeAmount) for output token         │    │
│  │  d. Transfer output to user                              │    │
│  └──────────────────────────────────────────────────────────┘    │
│         ↓                                                        │
│  6. Paymaster pays gas from EntryPoint deposit                   │
│         ↓                                                        │
│  7. Treasury accumulates fees for LP rewards                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Task 1: Deploy Treasury Contract

**File**: `packages/contracts/contracts/Treasury.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ZeroTollTreasury is Ownable {
    using SafeERC20 for IERC20;
    
    // Accumulated fees per token
    mapping(address => uint256) public collectedFees;
    
    // Authorized fee collectors (routers)
    mapping(address => bool) public authorizedCollectors;
    
    event FeeCollected(address indexed token, uint256 amount, address indexed from);
    event FeeWithdrawn(address indexed token, uint256 amount, address indexed to);
    
    constructor() Ownable(msg.sender) {}
    
    function setCollector(address collector, bool authorized) external onlyOwner {
        authorizedCollectors[collector] = authorized;
    }
    
    function collectFee(address token, uint256 amount, address from) external {
        require(authorizedCollectors[msg.sender], "Not authorized");
        IERC20(token).safeTransferFrom(from, address(this), amount);
        collectedFees[token] += amount;
        emit FeeCollected(token, amount, from);
    }
    
    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        require(collectedFees[token] >= amount, "Insufficient balance");
        collectedFees[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
        emit FeeWithdrawn(token, amount, to);
    }
    
    function getBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
```

**Deployment**:
- Sepolia: TBD
- Amoy: TBD

---

### Task 2: Update ZeroTollRouterV2

**File**: `packages/contracts/contracts/ZeroTollRouterV2.sol`

**Changes**:

```solidity
// Add state variables
address public treasury;
uint256 public feeMultiplier = 200; // 200 = 2x, 150 = 1.5x, etc.
uint256 public constant FEE_DENOMINATOR = 100;

// Add fee parameter to executeSwapWithPermit
function executeSwapWithPermit(
    SwapIntent calldata intent,
    bytes calldata userSignature,
    uint256 permitDeadline,
    uint8 permitV,
    bytes32 permitR,
    bytes32 permitS,
    uint256 feeAmount  // NEW: Fee in input token units
) external returns (uint256) {
    // Verify signature...
    
    // Execute permit for FULL amount (including fee)
    IERC20Permit(intent.tokenIn).permit(
        intent.user,
        address(this),
        intent.amountIn,
        permitDeadline,
        permitV, permitR, permitS
    );
    
    // Transfer full amount from user
    IERC20(intent.tokenIn).safeTransferFrom(
        intent.user, 
        address(this), 
        intent.amountIn
    );
    
    // Transfer fee to treasury
    if (feeAmount > 0 && treasury != address(0)) {
        IERC20(intent.tokenIn).safeTransfer(treasury, feeAmount);
    }
    
    // Swap remaining amount
    uint256 swapAmount = intent.amountIn - feeAmount;
    uint256 amountOut = _executeSwap(
        intent.tokenIn,
        intent.tokenOut,
        swapAmount,
        intent.minAmountOut,
        intent.user
    );
    
    return amountOut;
}

// Admin functions
function setTreasury(address _treasury) external onlyOwner {
    treasury = _treasury;
}

function setFeeMultiplier(uint256 _multiplier) external onlyOwner {
    require(_multiplier <= 500, "Max 5x"); // Safety cap
    feeMultiplier = _multiplier;
}
```

---

### Task 3: Update Phase2 Relayer

**File**: `backend/phase2-relayer.mjs`

**Changes**:

```javascript
// Add fee calculation function
async function calculateFee(chainId, tokenIn, amountIn) {
  const chainConfig = CHAIN_CONFIG[chainId];
  
  // 1. Get gas price from Pimlico
  const gasPriceResponse = await fetch(chainConfig.pimlicoUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'pimlico_getUserOperationGasPrice',
      params: []
    })
  });
  const gasPriceResult = await gasPriceResponse.json();
  const maxFeePerGas = BigInt(gasPriceResult.result?.fast?.maxFeePerGas || '50000000000');
  
  // 2. Estimate gas used (~250,000 for swap with permit)
  const estimatedGas = 250000n;
  const gasCostWei = maxFeePerGas * estimatedGas;
  
  // 3. Get native token price in USD (from Pyth)
  const nativePrice = await getPythPrice(chainId === 80002 ? 'POL' : 'ETH');
  const gasCostUSD = Number(gasCostWei) / 1e18 * nativePrice;
  
  // 4. Apply 2x multiplier
  const feeUSD = gasCostUSD * 2;
  
  // 5. Get input token price in USD (from Pyth)
  const tokenPrice = await getPythPrice(getTokenSymbol(tokenIn));
  
  // 6. Convert fee to input token amount
  const tokenDecimals = getTokenDecimals(tokenIn);
  const feeInToken = BigInt(Math.ceil(feeUSD / tokenPrice * (10 ** tokenDecimals)));
  
  return {
    feeUSD,
    feeInToken,
    gasCostUSD,
    gasCostWei: gasCostWei.toString()
  };
}

// Update swap-with-permit endpoint
app.post('/api/intents/swap-with-permit', async (req, res) => {
  // ... existing code ...
  
  // Calculate fee
  const feeData = await calculateFee(chainId, intent.tokenIn, intent.amountIn);
  console.log('💰 Fee calculation:', feeData);
  
  // Encode router call WITH fee parameter
  const routerCallData = encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: 'executeSwapWithPermit',
    args: [
      message, 
      userSignature, 
      BigInt(permit.deadline), 
      permit.v, 
      permit.r, 
      permit.s,
      feeData.feeInToken  // NEW: Pass fee amount
    ]
  });
  
  // ... rest of code ...
});
```

---

### Task 4: Update Frontend

**File**: `frontend/src/hooks/useIntentGasless.js`

**Changes**:
- Display estimated fee to user before signing
- Show fee breakdown in UI

**File**: `frontend/src/pages/Swap.jsx`

**Changes**:
```jsx
// Add fee display
{isZeroTollGasless && quote && (
  <div className="text-sm text-zt-paper/70 mt-2">
    <div>Gas sponsored by ZeroToll ✨</div>
    <div>Service fee: ~${estimatedFee.toFixed(4)} ({feeTokenAmount} {tokenIn.symbol})</div>
    <div className="text-xs text-zt-paper/50">
      Fee = 2x gas cost. You still save time & hassle!
    </div>
  </div>
)}
```

---

### Task 5: Add Fee Estimation API

**File**: `backend/phase2-relayer.mjs`

**New Endpoint**:
```javascript
// GET /api/fee-estimate/:chainId/:tokenIn/:amountIn
app.get('/api/fee-estimate/:chainId/:tokenIn/:amountIn', async (req, res) => {
  try {
    const chainId = parseInt(req.params.chainId);
    const tokenIn = req.params.tokenIn;
    const amountIn = req.params.amountIn;
    
    const feeData = await calculateFee(chainId, tokenIn, amountIn);
    
    res.json({
      success: true,
      chainId,
      tokenIn,
      feeUSD: feeData.feeUSD,
      feeInToken: feeData.feeInToken.toString(),
      gasCostUSD: feeData.gasCostUSD,
      multiplier: '2x',
      message: 'Fee = 2x estimated gas cost'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

---

## Deployment Checklist

### Smart Contracts

- [x] Create `ZeroTollTreasury.sol` contract
- [x] Create `ZeroTollRouterV3.sol` with fee support
- [x] Create deployment script `deploy-phase2b.js`
- [x] Compile contracts successfully
- [ ] Deploy `ZeroTollTreasury` on Sepolia
- [ ] Deploy `ZeroTollTreasury` on Amoy
- [ ] Deploy `ZeroTollRouterV3` on Sepolia
- [ ] Deploy `ZeroTollRouterV3` on Amoy
- [ ] Set treasury address in router
- [ ] Authorize router as fee collector in treasury
- [ ] Fund RouterV3 with zToken liquidity
- [ ] Test fee collection on testnet

### Backend

- [ ] Add `calculateFee()` function to phase2-relayer
- [ ] Add `/api/fee-estimate` endpoint
- [ ] Update `/api/intents/swap-with-permit` to call RouterV3 with fee
- [ ] Add Pyth price fetching for fee calculation
- [ ] Update ROUTER_ABI to include `executeSwapWithPermitAndFee`
- [ ] Test fee calculation accuracy

### Frontend

- [ ] Add fee estimation call before swap
- [ ] Display fee to user in swap UI
- [ ] Update confirmation modal with fee breakdown
- [ ] Test user flow end-to-end

---

## Fee Economics

### Per-Swap Revenue

| Network | Avg Gas Cost | ZeroToll Fee (2x) | Profit |
|---------|--------------|-------------------|--------|
| Amoy | $0.005 | $0.01 | $0.005 |
| Sepolia | $0.02 | $0.04 | $0.02 |
| Polygon Mainnet | $0.01 | $0.02 | $0.01 |
| Ethereum Mainnet | $0.50 | $1.00 | $0.50 |

### Monthly Projections

| Daily Swaps | Avg Fee | Daily Revenue | Monthly Revenue |
|-------------|---------|---------------|-----------------|
| 100 | $0.02 | $2 | $60 |
| 1,000 | $0.02 | $20 | $600 |
| 10,000 | $0.02 | $200 | $6,000 |
| 100,000 | $0.02 | $2,000 | $60,000 |

### Treasury Distribution (Phase 3)

```
Monthly Revenue: $6,000
  ├── 80% LP Rewards: $4,800
  ├── 15% Operations: $900
  └── 5% Reserve: $300
```

---

## Risk Mitigation

### 1. Fee Too High
- **Risk**: Users reject swaps due to high fee
- **Mitigation**: Cap fee at 1% of swap amount
```solidity
uint256 maxFee = intent.amountIn / 100; // 1% cap
uint256 actualFee = feeAmount > maxFee ? maxFee : feeAmount;
```

### 2. Oracle Manipulation
- **Risk**: Attacker manipulates Pyth price to reduce fee
- **Mitigation**: Use TWAP or multiple oracle sources

### 3. Gas Price Spike
- **Risk**: Gas spikes after fee calculation, paymaster loses money
- **Mitigation**: Add 20% buffer to gas estimate

### 4. Token Price Volatility
- **Risk**: Token price drops between fee calc and execution
- **Mitigation**: Fee calculated at execution time on-chain (not relayer)

---

## Testing Plan

### Unit Tests

1. Treasury contract fee collection
2. Router fee deduction
3. Fee calculation accuracy
4. Edge cases (zero fee, max fee cap)

### Integration Tests

1. Full swap flow with fee
2. Fee displayed correctly in UI
3. Treasury balance increases
4. User receives correct output amount

### Testnet Validation

1. Execute 10 swaps on Amoy with fee
2. Verify treasury received fees
3. Verify user experience is smooth
4. Compare actual vs estimated fees

---

## Timeline

| Week | Tasks |
|------|-------|
| Week 1 | Deploy Treasury, update Router contract |
| Week 2 | Update relayer with fee calculation |
| Week 3 | Update frontend, testing |
| Week 4 | Testnet validation, bug fixes |

---

## Success Metrics

- [ ] Fee collection working on both networks
- [ ] Treasury accumulating fees
- [ ] User complaints < 5% (fee too high)
- [ ] Fee accuracy within 10% of estimate
- [ ] No failed swaps due to fee logic

---

## Next Steps After Phase 2B

**Phase 3: Community Paymaster Pool**
- Deploy PaymasterVault (ERC-4626)
- Allow LPs to deposit POL/ETH
- Distribute treasury fees to LPs
- Launch $ZEROTOLL token for bonus rewards
