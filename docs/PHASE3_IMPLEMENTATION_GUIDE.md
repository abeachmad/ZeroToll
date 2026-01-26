# Phase 3 Implementation Guide: EIP-7702 & Decentralized Relayer Network

## Overview

This guide walks through implementing Phase 3 of ZeroToll, which includes:
1. **EIP-7702 Integration** - Gasless swaps with 50% gas savings
2. **Decentralized Relayer Network** - Multiple relayers competing to execute swaps

---

## Part 1: EIP-7702 Integration (Weeks 1-4)

### Week 1: Deploy Delegate Contract

#### Step 1: Update Router Addresses

Edit `packages/contracts/scripts/deploy-zerotoll-delegate.js`:

```javascript
const ADDRESSES = {
  80002: {
    router: "0xYOUR_ROUTER_V3_AMOY",  // Update this
    treasury: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    weth: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"
  },
  11155111: {
    router: "0xYOUR_ROUTER_V3_SEPOLIA",  // Update this
    treasury: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    weth: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
  }
};
```

#### Step 2: Deploy to Amoy

```bash
cd packages/contracts
npx hardhat run scripts/deploy-zerotoll-delegate.js --network amoy
```

Expected output:
```
=== Deploying ZeroTollDelegate ===
Network: amoy
Chain ID: 80002
Deployer: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Balance: 1.5 POL

Configuration:
Router: 0x...
Treasury: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
WETH/WPOL: 0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9

Deploying ZeroTollDelegate...
✅ ZeroTollDelegate deployed to: 0xABC...
Domain Separator: 0x123...

✅ Deployment info saved to: zerotoll-delegate-amoy-1234567890.json
✅ Contract verified
```

#### Step 3: Deploy to Sepolia

```bash
npx hardhat run scripts/deploy-zerotoll-delegate.js --network sepolia
```

#### Step 4: Update Relayer Config

Edit `backend/eip7702-relayer.mjs`:

```javascript
const DELEGATE_ADDRESS = {
  80002: '0xYOUR_DELEGATE_AMOY',     // From deployment
  11155111: '0xYOUR_DELEGATE_SEPOLIA' // From deployment
};
```

---

### Week 2: Integrate Relayer

#### Step 1: Add EIP-7702 Endpoint

Create `backend/routes/eip7702.mjs`:

```javascript
import express from 'express'