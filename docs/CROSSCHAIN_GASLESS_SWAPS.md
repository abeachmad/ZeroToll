# Cross-Chain Gasless Swaps

## Overview

ZeroToll now supports cross-chain gasless swaps using a SushiXSwap-inspired architecture with LayerZero-style message passing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CROSS-CHAIN GASLESS SWAP                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SOURCE CHAIN (Amoy)                    DESTINATION CHAIN (Sepolia)     │
│  ┌─────────────────────┐                ┌─────────────────────┐         │
│  │   User Smart Acct   │                │   User Smart Acct   │         │
│  │   (ERC-4337)        │                │   (Same Address)    │         │
│  └─────────┬───────────┘                └─────────▲───────────┘         │
│            │ 1. Gasless TX                        │ 4. Receive Tokens   │
│            ▼                                      │                     │
│  ┌─────────────────────┐                ┌─────────┴───────────┐         │
│  │ MockLayerZeroAdapter│   2. Event     │ MockLayerZeroAdapter│         │
│  │ - Lock tokens       │ ──────────────▶│ - Execute swap      │         │
│  │ - Emit event        │   (Relayer)    │ - Transfer tokens   │         │
│  └─────────────────────┘                └─────────────────────┘         │
│            │                                      ▲                     │
│            │ 3. Off-chain relayer monitors        │                     │
│            │    events and calls receiveMessage   │                     │
│            └──────────────────────────────────────┘                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. MockLayerZeroAdapter
- **Location**: `packages/contracts/contracts/adapters/bridges/MockLayerZeroAdapter.sol`
- **Purpose**: Handles cross-chain message passing
- **Functions**:
  - `bridgeAndSwap()`: Initiates cross-chain swap on source chain
  - `receiveMessage()`: Executes swap on destination chain
  - `setPeer()`: Configure trusted peer adapters

### 2. LayerZeroBridgeAdapter (Production)
- **Location**: `packages/contracts/contracts/adapters/bridges/LayerZeroBridgeAdapter.sol`
- **Purpose**: Real LayerZero V2 OApp integration
- **Features**:
  - LayerZero endpoint integration
  - Cross-chain message verification
  - Gas estimation for destination execution

## Deployed Contracts

### Testnet Addresses

| Contract | Amoy (80002) | Sepolia (11155111) |
|----------|--------------|-------------------|
| MockLayerZeroAdapter | `0x349436899Da2F3D5Fb2AD4059b5792C3FeE0bE50` | `0x73F01527EB3f0ea4AA0d25BF12C6e28d48e46A4C` |
| RouterHub | `0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881` | `0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84` |

## How It Works

### Step 1: User Initiates (Source Chain - Gasless)
```javascript
// User calls bridgeAndSwap via smart account (gasless)
await smartAccountClient.sendTransaction({
  to: BRIDGE_ADAPTER_ADDRESS,
  data: encodeFunctionData({
    abi: BRIDGE_ADAPTER_ABI,
    functionName: 'bridgeAndSwap',
    args: [
      tokenIn,      // Source token
      amountIn,     // Amount to bridge
      dstChainId,   // Destination chain ID
      dstToken,     // Token to receive
      minDstAmount, // Minimum output
      user,         // Recipient
      deadline,     // Expiry
    ],
  }),
});
```

### Step 2: Relayer Monitors Events
```javascript
// Off-chain relayer monitors CrossChainSwapInitiated events
const logs = await sourceClient.getLogs({
  address: BRIDGE_ADAPTER_ADDRESS,
  event: CrossChainSwapInitiatedEvent,
});
```

### Step 3: Relayer Executes on Destination
```javascript
// Relayer calls receiveMessage on destination chain
await relayerWallet.sendTransaction({
  to: DST_BRIDGE_ADAPTER_ADDRESS,
  data: encodeFunctionData({
    abi: BRIDGE_ADAPTER_ABI,
    functionName: 'receiveMessage',
    args: [crossChainMessage, signature],
  }),
});
```

### Step 4: User Receives Tokens
- Tokens are transferred to user's smart account on destination chain
- Same address on both chains (deterministic deployment)

## Test Scripts

### Setup Peers
```bash
cd frontend
node setup-crosschain-peers.mjs
```

### Test Cross-Chain Swap
```bash
cd frontend
node test-crosschain-layerzero.mjs
```

## Production Considerations

### 1. Replace Mock with Real LayerZero
- Deploy `LayerZeroBridgeAdapter` instead of mock
- Configure LayerZero endpoints for each chain
- Set up DVN (Decentralized Verifier Network) configuration

### 2. Automated Relayer
- Deploy relayer service to monitor events
- Implement retry logic for failed deliveries
- Add gas price optimization

### 3. Security
- Add signature verification for cross-chain messages
- Implement rate limiting
- Add emergency pause functionality

### 4. Liquidity Management
- Fund adapters with destination tokens
- Implement liquidity rebalancing
- Add slippage protection

## Supported Chains

Currently tested on:
- Polygon Amoy (Testnet)
- Ethereum Sepolia (Testnet)

For production, add:
- Polygon Mainnet
- Ethereum Mainnet
- Arbitrum
- Optimism
- Base

## References

- [SushiXSwap V2](https://github.com/sushiswap/sushixswap-v2)
- [LayerZero V2 Docs](https://docs.layerzero.network/v2)
- [ERC-4337 Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
