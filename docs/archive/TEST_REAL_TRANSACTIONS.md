# Real Transaction Testing Guide

## ✅ Configuration Verified

All 4 testnets are properly configured and connected:
- **Ethereum Sepolia** (11155111) ✅
- **Polygon Amoy** (80002) ✅  
- **Arbitrum Sepolia** (421614) ✅
- **Optimism Sepolia** (11155420) ✅

## Prerequisites

### 1. Get Testnet Tokens

**Ethereum Sepolia ETH**:
- https://sepoliafaucet.com
- https://www.alchemy.com/faucets/ethereum-sepolia

**Polygon Amoy POL**:
- https://faucet.polygon.technology

**Arbitrum Sepolia ETH**:
- https://faucet.quicknode.com/arbitrum/sepolia
- Or bridge from Sepolia: https://bridge.arbitrum.io/?destinationChain=arbitrum-sepolia

**Optimism Sepolia ETH**:
- https://app.optimism.io/faucet
- Or bridge from Sepolia: https://app.optimism.io/bridge

### 2. Start ZeroToll

```bash
cd /home/abeachmad/ZeroToll
bash start-zerotoll.sh
```

Wait for:
- Backend: http://localhost:8000
- Frontend: http://localhost:3000

## Test Cases

### Test 1: Ethereum Sepolia → Polygon Amoy

**Setup**:
1. Open http://localhost:3000
2. Connect MetaMask
3. Switch to Ethereum Sepolia network

**Execute**:
- From: Ethereum Sepolia, ETH, 0.001
- To: Polygon Amoy, POL
- Fee Mode: INPUT
- Max Fee Cap: 0.001
- Click "Get Quote"
- Click "Execute Swap"

**Verify**:
- Transaction hash appears in UI
- Check Sepolia explorer: https://sepolia.etherscan.io/address/[YOUR_ADDRESS]
- Verify 0.001 ETH was sent (not 0.01 or 0.1)
- Status should be "Success"

### Test 2: Arbitrum Sepolia → Optimism Sepolia

**Setup**:
1. Switch MetaMask to Arbitrum Sepolia
2. Ensure you have Arbitrum Sepolia ETH

**Execute**:
- From: Arbitrum Sepolia, ETH, 0.0005
- To: Optimism Sepolia, ETH
- Fee Mode: NATIVE
- Max Fee Cap: 0.0005
- Click "Get Quote"
- Click "Execute Swap"

**Verify**:
- Check Arbitrum explorer: https://sepolia.arbiscan.io/address/[YOUR_ADDRESS]
- Verify transaction recorded
- Amount should be exactly 0.0005 ETH

### Test 3: Polygon Amoy → Ethereum Sepolia

**Setup**:
1. Switch MetaMask to Polygon Amoy
2. Ensure you have Amoy POL

**Execute**:
- From: Polygon Amoy, POL, 0.01
- To: Ethereum Sepolia, ETH
- Fee Mode: INPUT
- Max Fee Cap: 0.01
- Click "Get Quote"
- Click "Execute Swap"

**Verify**:
- Check Amoy explorer: https://amoy.polygonscan.com/address/[YOUR_ADDRESS]
- Verify 0.01 POL transaction
- Status: Success

### Test 4: Optimism Sepolia → Arbitrum Sepolia

**Setup**:
1. Switch MetaMask to Optimism Sepolia
2. Ensure you have Optimism Sepolia ETH

**Execute**:
- From: Optimism Sepolia, ETH, 0.0003
- To: Arbitrum Sepolia, ETH
- Fee Mode: OUTPUT
- Max Fee Cap: 0.0003
- Click "Get Quote"
- Click "Execute Swap"

**Verify**:
- Check Optimism explorer: https://sepolia-optimism.etherscan.io/address/[YOUR_ADDRESS]
- Verify exact amount sent
- Transaction confirmed

## Expected Behavior

### ✅ What Should Work

1. **Real Transactions**: All transactions recorded on blockchain
2. **Correct Amounts**: Exact amounts from user input (no 10x errors)
3. **Explorer Verification**: Transactions visible on block explorers
4. **Multi-Network**: All 4 testnets functional
5. **Native Transfers**: ETH and POL transfers work

### ⚠️ Current Limitations

1. **No DEX Swaps**: Only native token transfers (ETH/POL)
2. **No Token Swaps**: LINK swaps not yet implemented
3. **No Cross-Chain**: Transactions are single-chain only
4. **Testnet Liquidity**: DEX pools have limited liquidity

## Troubleshooting

### Transaction Fails

**Check**:
1. Sufficient balance for amount + gas
2. Correct network selected in MetaMask
3. Backend logs: `tail -f /tmp/zerotoll_backend.log`
4. Relayer has funds (if using relayer mode)

### Amount Wrong (0.1 instead of 0.01)

**Fixed**: Frontend now sends correct `callData` with `amtIn`
**Verify**: Check transaction on explorer shows exact input amount

### Transaction Not on Explorer

**Causes**:
1. Transaction failed before submission
2. Wrong network selected
3. Backend error (check logs)

**Solution**:
1. Check backend logs for errors
2. Verify network connection
3. Ensure relayer has funds

## Verification Checklist

After each test:
- [ ] Transaction hash received
- [ ] Transaction on block explorer
- [ ] Correct amount sent
- [ ] Status: Success
- [ ] No errors in logs

## Success Criteria

ZeroToll is working correctly if:
1. ✅ All 4 networks connect
2. ✅ Transactions recorded on explorers
3. ✅ Amounts match user input
4. ✅ No 500 errors from backend
5. ✅ Transaction hashes are real (not 0x000...)

---

**Last Updated**: 2024-11-04
**Status**: ✅ Ready for testing
**Networks**: Sepolia, Amoy, Arbitrum Sepolia, Optimism Sepolia
