# ZeroToll Gasless Implementation Guide

## The Problem

MetaMask returns `EIP-7702 not supported on chain: 0x13882` (Polygon Amoy) and `0xaa36a7` (Ethereum Sepolia).

**Root Cause**: MetaMask only supports EIP-7702 on specific mainnets, NOT on testnets.

## Research Findings

### MetaMask EIP-7702 Support (December 2024)

| Chain | Chain ID | EIP-7702 Support | Notes |
|-------|----------|------------------|-------|
| Gnosis Chain | 100 | ✅ YES | Full support |
| Base | 8453 | ✅ YES | Full support |
| Ethereum Mainnet | 1 | ⚠️ Limited | Rolling out |
| Polygon PoS | 137 | ⚠️ Experimental | Limited |
| Ethereum Sepolia | 11155111 | ❌ NO | Not supported |
| Polygon Amoy | 80002 | ❌ NO | Not supported |

### Key Insights from Working Examples

1. **MetaMask 7702-Readiness Demo** (https://github.com/MetaMask/7702-Readiness)
   - Works on Gnosis Chain and Sepolia (for upgrade only)
   - Uses `wallet_sendCalls` (EIP-5792)
   - Paymaster capability NOT yet supported by MetaMask

2. **QuickNode Token Sweeper** (https://www.quicknode.com/sample-app-library/token-sweeper-eip-7702)
   - Uses Gnosis Chain for demos
   - Batches multiple approvals + swaps
   - Works with MetaMask Smart Accounts

3. **Uniswap Integration**
   - Uses hybrid approach
   - EIP-7702 on supported chains
   - Fallback to standard transactions elsewhere

## Solution Architecture

### Option 1: Use Supported Chains (Recommended for Production)

Add Gnosis Chain support to ZeroToll:

```javascript
// frontend/src/config/networks.js
export const GASLESS_CHAINS = {
  100: { // Gnosis Chain
    name: 'Gnosis',
    rpcUrl: 'https://rpc.gnosischain.com',
    explorer: 'https://gnosisscan.io',
    tokens: {
      USDC: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
      WETH: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
      WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d'
    }
  },
  8453: { // Base
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    tokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      WETH: '0x4200000000000000000000000000000000000006'
    }
  }
};
```

### Option 2: Batch Transactions on Testnets

On testnets, use `wallet_sendCalls` for batching (user still pays gas):

```javascript
// Batch approve + swap in one transaction
const result = await walletClient.request({
  method: 'wallet_sendCalls',
  params: [{
    version: '2.0.0',
    chainId: `0x${chainId.toString(16)}`,
    from: address,
    calls: [
      { to: tokenAddress, data: approveData, value: '0x0' },
      { to: routerHub, data: swapData, value: '0x0' }
    ],
    atomicRequired: true
  }]
});
```

### Option 3: ERC-4337 Smart Accounts (Universal)

Use Pimlico's bundler with Safe Smart Accounts:

```javascript
import { createSmartAccountClient } from 'permissionless';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// Works on ANY chain including testnets
const safeAccount = await toSafeSmartAccount({
  client: publicClient,
  owners: [{ address: userAddress }],
  version: '1.4.1'
});

const smartAccountClient = createSmartAccountClient({
  account: safeAccount,
  bundlerTransport: http(PIMLICO_BUNDLER_URL),
  paymaster: pimlicoClient
});

// Execute gasless
await smartAccountClient.sendUserOperation({
  calls: [approveCall, swapCall]
});
```

## Implementation Files

### New Hooks Created

1. **`useWorkingGasless.js`** - Production-ready hook
   - Detects chain support automatically
   - Uses EIP-7702 on Gnosis/Base
   - Falls back to batch on testnets
   - Clear user messaging

2. **`useHybridGasless.js`** - Advanced hybrid approach
   - EIP-7702 on supported chains
   - ERC-4337 fallback on testnets
   - Requires permissionless package

3. **`usePimlicoGasless.js`** - Direct Pimlico integration
   - Uses Pimlico bundler directly
   - Works with existing smart accounts

## Usage in Swap.jsx

```javascript
import { useWorkingGasless } from '../hooks/useWorkingGasless';

const Swap = () => {
  const gasless = useWorkingGasless();
  
  const handleGaslessSwap = async () => {
    const availability = await gasless.checkAvailability();
    
    if (!availability.available) {
      toast.error(availability.reason);
      return;
    }
    
    // Show appropriate message
    if (availability.gaslessAvailable) {
      toast.info('🎉 TRUE gasless - you pay $0!');
    } else {
      toast.info('⚡ Batch mode - approve + swap in one tx');
    }
    
    await gasless.executeApproveAndSwap({
      tokenAddress: tokenIn.address,
      spender: routerHubAddress,
      amount: amountWei,
      routerHub: routerHubAddress,
      swapCallData
    });
  };
};
```

## Recommended Next Steps

1. **Short-term**: Update UI to clearly show gasless is only available on Gnosis/Base
2. **Medium-term**: Add Gnosis Chain support to ZeroToll for true gasless testing
3. **Long-term**: Monitor MetaMask updates for testnet EIP-7702 support

## References

- [MetaMask 7702-Readiness](https://github.com/MetaMask/7702-Readiness)
- [QuickNode Token Sweeper](https://www.quicknode.com/sample-app-library/token-sweeper-eip-7702)
- [Pimlico Documentation](https://docs.pimlico.io/)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [EIP-5792 wallet_sendCalls](https://eips.ethereum.org/EIPS/eip-5792)
