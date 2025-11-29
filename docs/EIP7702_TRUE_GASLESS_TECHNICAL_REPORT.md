# EIP-7702 TRUE Gasless Transactions - Technical Report

## Executive Summary

This report documents the successful implementation of TRUE gasless transactions using EIP-7702 (Set EOA Account Code) with MetaMask Smart Accounts. Users pay **$0 in gas fees** - all gas costs are sponsored by a paymaster (Pimlico).

**Key Achievement**: We successfully executed multiple gasless swap transactions on Polygon Amoy and Ethereum Sepolia testnets where the user's native token balance remained unchanged (zero gas paid).

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Architecture](#2-solution-architecture)
3. [Technical Implementation](#3-technical-implementation)
4. [Key Components](#4-key-components)
5. [Code Implementation](#5-code-implementation)
6. [Verification & Test Results](#6-verification--test-results)
7. [Common Pitfalls & Solutions](#7-common-pitfalls--solutions)
8. [Replication Guide](#8-replication-guide)
9. [References](#9-references)

---

## 1. Problem Statement

### 1.1 The Challenge

Traditional Ethereum transactions require users to pay gas fees in the native token (ETH, POL, etc.). This creates friction for:
- New users who don't have native tokens
- DeFi applications wanting seamless UX
- Cross-chain operations where users may not have gas on destination chain

### 1.2 Why Previous Attempts Failed


#### Attempt 1: Using `useSendCalls` (EIP-5792) Alone

```javascript
// ❌ THIS DOES NOT PROVIDE GASLESS
const { sendCallsAsync } = useSendCalls();
await sendCallsAsync({ calls: [...] });
```

**Why it failed**: EIP-5792 (`wallet_sendCalls`) only provides transaction batching. MetaMask's implementation does NOT include paymaster sponsorship. Users still pay gas fees.

#### Attempt 2: Raw UserOperation Submission

```javascript
// ❌ WRONG FORMAT FOR METAMASK DELEGATION FRAMEWORK
const userOp = {
  sender: address,
  nonce: 0n,
  callData: approveData, // Direct callData - WRONG!
  ...
};
```

**Why it failed**: The callData format was incorrect for MetaMask's delegation framework. The `EIP7702StatelessDeleGatorImpl` expects a specific execution format, not raw callData.

#### Attempt 3: Wrong Implementation Name

```javascript
// ❌ WRONG
implementation: 'stateless7702'  // lowercase

// ✅ CORRECT
implementation: 'Stateless7702'  // PascalCase
```

**Why it failed**: The MetaMask Smart Accounts Kit uses PascalCase for implementation names.

---

## 2. Solution Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER WALLET (EOA)                                 │
│                   0x5a87A3c738cf99DB95787D51B627217B6dE12F62            │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  EIP-7702 Code: 0xef0100 + DelegatorAddress                     │   │
│   │  Delegator: 0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B          │   │
│   │  (EIP7702StatelessDeleGatorImpl)                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Signs UserOperation
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    METAMASK SMART ACCOUNTS KIT                           │
│                                                                          │
│   toMetaMaskSmartAccount({                                              │
│     implementation: 'Stateless7702',                                    │
│     address: walletAddress,                                             │
│     signer: { walletClient }                                            │
│   })                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Creates properly formatted UserOp
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      PIMLICO BUNDLER + PAYMASTER                         │
│                                                                          │
│   ┌─────────────────────┐    ┌─────────────────────┐                   │
│   │  Bundler Client     │    │  Paymaster Client   │                   │
│   │  - Submits UserOps  │    │  - Sponsors gas     │                   │
│   │  - Estimates gas    │    │  - Signs paymaster  │                   │
│   │  - Waits for receipt│    │    data             │                   │
│   └─────────────────────┘    └─────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Submits to EntryPoint
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTRYPOINT v0.7 (ERC-4337)                            │
│              0x0000000071727De22E5E9d8BAf0edAc6f37da032                  │
│                                                                          │
│   1. Validates UserOperation                                            │
│   2. Calls Smart Account (EOA with delegated code)                      │
│   3. Executes the calls (approve + swap)                                │
│   4. Paymaster pays gas (user pays $0)                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Insight: EOA = Smart Account

With EIP-7702, the EOA address IS the Smart Account address. There's no separate contract deployment. The EOA's code is set to delegate to an implementation contract.

```
Before EIP-7702:
  EOA: 0x5a87... (no code)

After EIP-7702:
  EOA: 0x5a87... (code: 0xef0100 + delegator)
  
Same address, now with Smart Account capabilities!
```

---

## 3. Technical Implementation

### 3.1 Prerequisites


#### Required Dependencies

```json
{
  "@metamask/smart-accounts-kit": "^0.1.0",
  "permissionless": "^0.3.2",
  "viem": "^2.23.2",
  "wagmi": "^2.19.2"
}
```

#### Required Accounts & Keys

1. **Pimlico API Key**: Free tier available at https://dashboard.pimlico.io
2. **Wallet with EIP-7702 Smart Account**: EOA upgraded via MetaMask

### 3.2 Smart Account Detection

To check if an EOA is upgraded to Smart Account:

```javascript
const code = await publicClient.getCode({ address: walletAddress });

if (code && code.startsWith('0xef0100')) {
  // EIP-7702 Smart Account enabled!
  const delegator = '0x' + code.substring(8, 48);
  console.log('Delegator:', delegator);
}
```

The `0xef0100` prefix indicates EIP-7702 delegation. The next 20 bytes are the delegator contract address.

### 3.3 Supported Chains

| Chain | Chain ID | Delegator Address | Status |
|-------|----------|-------------------|--------|
| Polygon Amoy | 80002 | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` | ✅ Working |
| Ethereum Sepolia | 11155111 | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` | ✅ Working |

---

## 4. Key Components

### 4.1 MetaMask Smart Accounts Kit

The `@metamask/smart-accounts-kit` package provides:

- `toMetaMaskSmartAccount()`: Creates a Smart Account instance from an EOA
- `getSmartAccountsEnvironment()`: Gets chain-specific configuration
- Proper UserOperation formatting for MetaMask's delegation framework

### 4.2 Pimlico Infrastructure

Pimlico provides:

- **Bundler**: Submits UserOperations to the network
- **Paymaster**: Sponsors gas fees (user pays $0)
- **Gas Price Oracle**: Provides optimal gas prices

### 4.3 EntryPoint v0.7

The ERC-4337 EntryPoint contract at `0x0000000071727De22E5E9d8BAf0edAc6f37da032`:

- Validates UserOperations
- Executes calls through Smart Accounts
- Handles paymaster payments

---

## 5. Code Implementation

### 5.1 Complete Working Example

```javascript
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseUnits } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

// Configuration
const PIMLICO_API_KEY = 'your-pimlico-api-key';
const PRIVATE_KEY = '0x...your-private-key';

const CONFIG = {
  chain: polygonAmoy,
  chainId: 80002,
  rpc: 'https://rpc-amoy.polygon.technology',
  pimlicoRpc: `https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_API_KEY}`
};

async function executeGaslessTransaction() {
  // 1. Create account from private key
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  // 2. Create clients
  const publicClient = createPublicClient({
    chain: CONFIG.chain,
    transport: http(CONFIG.rpc)
  });
  
  const walletClient = createWalletClient({
    account,
    chain: CONFIG.chain,
    transport: http(CONFIG.rpc)
  });
  
  // 3. Verify Smart Account is enabled
  const code = await publicClient.getCode({ address: account.address });
  if (!code || !code.startsWith('0xef0100')) {
    throw new Error('Smart Account not enabled');
  }
  
  // 4. Create MetaMask Smart Account instance
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: 'Stateless7702',  // IMPORTANT: PascalCase!
    address: account.address,
    signer: { walletClient }  // IMPORTANT: { walletClient }, not nested
  });
  
  // 5. Create Pimlico paymaster client
  const pimlicoClient = createPimlicoClient({
    chain: CONFIG.chain,
    transport: http(CONFIG.pimlicoRpc),
    entryPoint: {
      address: entryPoint07Address,
      version: '0.7'
    }
  });
  
  // 6. Create Bundler client with paymaster
  const bundlerClient = createBundlerClient({
    chain: CONFIG.chain,
    transport: http(CONFIG.pimlicoRpc),
    account: smartAccount,
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      }
    }
  });
  
  // 7. Build calls (example: ERC20 approve)
  const calls = [{
    to: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // USDC
    data: encodeFunctionData({
      abi: [{
        name: 'approve',
        type: 'function',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ type: 'bool' }]
      }],
      functionName: 'approve',
      args: ['0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881', parseUnits('1', 6)]
    }),
    value: 0n
  }];
  
  // 8. Send GASLESS UserOperation
  const userOpHash = await bundlerClient.sendUserOperation({ calls });
  console.log('UserOp Hash:', userOpHash);
  
  // 9. Wait for confirmation
  const receipt = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
    timeout: 120000
  });
  
  console.log('TX Hash:', receipt.receipt.transactionHash);
  console.log('Success:', receipt.success);
  // User paid $0 in gas!
}
```

### 5.2 React Hook Implementation

```javascript
// useTrueGaslessSwap.js
import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import { http } from 'viem';

const PIMLICO_API_KEY = 'your-api-key';

export function useTrueGaslessSwap() {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState(false);

  const executeGasless = useCallback(async ({ calls }) => {
    if (!address || !publicClient || !walletClient || !chain) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    
    try {
      // Create Smart Account
      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient,
        implementation: 'Stateless7702',
        address: address,
        signer: { walletClient }
      });

      // Create Pimlico client
      const pimlicoRpc = `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${PIMLICO_API_KEY}`;
      
      const pimlicoClient = createPimlicoClient({
        chain: chain,
        transport: http(pimlicoRpc),
        entryPoint: { address: entryPoint07Address, version: '0.7' }
      });

      // Create Bundler client
      const bundlerClient = createBundlerClient({
        chain: chain,
        transport: http(pimlicoRpc),
        account: smartAccount,
        paymaster: pimlicoClient,
        userOperation: {
          estimateFeesPerGas: async () => {
            const gasPrices = await pimlicoClient.getUserOperationGasPrice();
            return gasPrices.fast;
          }
        }
      });

      // Send UserOperation
      const hash = await bundlerClient.sendUserOperation({ calls });
      
      // Wait for receipt
      const receipt = await bundlerClient.waitForUserOperationReceipt({
        hash,
        timeout: 120000
      });

      return receipt;
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient, walletClient, chain]);

  return { executeGasless, isLoading };
}
```

---

## 6. Verification & Test Results

### 6.1 Successful Transactions


#### Polygon Amoy Transactions

| TX Hash | Type | Amount | User Gas Paid |
|---------|------|--------|---------------|
| `0x3ee52bdebd2d2fc091cb6debec6e243839c0d02603864d05dc7763a388d151cf` | Approve | 1 USDC | **$0** ✅ |
| `0x200b3e073492c47d0a96e48dd4a56796877abab53ce89062b5883968ab4fb6ce` | Swap | 0.05 USDC → 0.282 WMATIC | **$0** ✅ |
| `0x1e8a069dfd4acd686c9d38bc8da6962e1b1f3713a18c8e8a7017ed70b5c361d5` | Swap | 0.1 USDC → 0.564 WMATIC | **$0** ✅ |
| `0x42267a954b4955dd3151b2272ca9131879a4230a43a6c67b63cfc7d6d1342e4d` | Swap | 0.1 USDC → 0.564 WMATIC | **$0** ✅ |

#### Ethereum Sepolia Transactions

| TX Hash | Type | User Gas Paid |
|---------|------|---------------|
| `0xa257927dd36590c5c725397ed68fcbd11a5e86256920d607592fd70b6ecad4e0` | Self-transfer | **$0** ✅ |

### 6.2 Balance Verification

```
Test: Full Gasless Swap on Amoy

Initial Balances:
  POL:    1.097915049995838283
  USDC:   4.8
  WMATIC: 1.128139069892335539

Final Balances:
  POL:    1.097915049995838283  ← NO CHANGE (zero gas paid!)
  USDC:   4.7                   ← -0.1 (swapped)
  WMATIC: 1.692208604838503308  ← +0.564 (received)

Result: TRUE GASLESS - User paid $0 in gas!
```

### 6.3 Who Paid the Gas?

```javascript
// Verify who paid gas
const tx = await publicClient.getTransaction({ hash: txHash });
console.log('TX From:', tx.from);
// Output: 0x4337011463ef6bd863e47e7b5e743d2522261131 (Pimlico Bundler)

console.log('User Wallet:', userAddress);
// Output: 0x5a87A3c738cf99DB95787D51B627217B6dE12F62

// tx.from !== userAddress → Bundler paid gas, not user!
```

---

## 7. Common Pitfalls & Solutions

### 7.1 Wrong Implementation Name

```javascript
// ❌ WRONG
implementation: 'stateless7702'
implementation: 'Stateless-7702'
implementation: 'EIP7702StatelessDeleGator'

// ✅ CORRECT
implementation: 'Stateless7702'
```

### 7.2 Wrong Signer Format

```javascript
// ❌ WRONG
signer: walletClient
signer: { type: 'wallet', data: { walletClient } }
signatory: { walletClient }

// ✅ CORRECT
signer: { walletClient }
```

### 7.3 Missing Gas Price Estimation

```javascript
// ❌ WRONG - No gas price estimation
const bundlerClient = createBundlerClient({
  chain,
  transport: http(pimlicoRpc),
  account: smartAccount,
  paymaster: pimlicoClient
  // Missing userOperation.estimateFeesPerGas!
});

// ✅ CORRECT - Include gas price estimation
const bundlerClient = createBundlerClient({
  chain,
  transport: http(pimlicoRpc),
  account: smartAccount,
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () => {
      const gasPrices = await pimlicoClient.getUserOperationGasPrice();
      return gasPrices.fast;
    }
  }
});
```

### 7.4 Smart Account Not Enabled

Before using gasless, verify the wallet is upgraded:

```javascript
const code = await publicClient.getCode({ address });

if (!code || !code.startsWith('0xef0100')) {
  // User needs to enable Smart Account in MetaMask first!
  // Go to MetaMask → Account Details → Enable Smart Account
  throw new Error('Please enable Smart Account in MetaMask');
}
```

### 7.5 Using useSendCalls Expecting Gasless

```javascript
// ❌ THIS IS NOT GASLESS
import { useSendCalls } from 'wagmi/experimental';
const { sendCallsAsync } = useSendCalls();
await sendCallsAsync({ calls }); // User still pays gas!

// ✅ FOR TRUE GASLESS, use the full implementation with Pimlico
```

---

## 8. Replication Guide

### Step 1: Install Dependencies

```bash
npm install @metamask/smart-accounts-kit permissionless viem wagmi
```

### Step 2: Get Pimlico API Key

1. Go to https://dashboard.pimlico.io
2. Create account and get API key
3. Free tier includes testnet sponsorship

### Step 3: Enable Smart Account in MetaMask

1. Open MetaMask
2. Click on account icon → Account Details
3. Enable "Smart Account" feature
4. This sets the EIP-7702 delegation code on your EOA

### Step 4: Verify Smart Account

```javascript
const code = await publicClient.getCode({ address: yourAddress });
console.log('Code:', code);
// Should start with 0xef0100
```

### Step 5: Run Test Script

Create `test-gasless.mjs`:

```javascript
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createBundlerClient, entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';

const PRIVATE_KEY = '0x...'; // Your private key
const PIMLICO_KEY = '...';   // Your Pimlico API key

async function test() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  
  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology')
  });
  
  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http('https://rpc-amoy.polygon.technology')
  });
  
  // Check initial balance
  const initialBalance = await publicClient.getBalance({ address: account.address });
  console.log('Initial POL:', formatUnits(initialBalance, 18));
  
  // Create Smart Account
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: 'Stateless7702',
    address: account.address,
    signer: { walletClient }
  });
  
  // Create Pimlico client
  const pimlicoClient = createPimlicoClient({
    chain: polygonAmoy,
    transport: http(`https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_KEY}`),
    entryPoint: { address: entryPoint07Address, version: '0.7' }
  });
  
  // Create Bundler client
  const bundlerClient = createBundlerClient({
    chain: polygonAmoy,
    transport: http(`https://api.pimlico.io/v2/80002/rpc?apikey=${PIMLICO_KEY}`),
    account: smartAccount,
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const gasPrices = await pimlicoClient.getUserOperationGasPrice();
        return gasPrices.fast;
      }
    }
  });
  
  // Send gasless transaction (self-transfer)
  const hash = await bundlerClient.sendUserOperation({
    calls: [{ to: account.address, data: '0x', value: 0n }]
  });
  
  console.log('UserOp Hash:', hash);
  
  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
  console.log('TX Hash:', receipt.receipt.transactionHash);
  
  // Check final balance
  const finalBalance = await publicClient.getBalance({ address: account.address });
  console.log('Final POL:', formatUnits(finalBalance, 18));
  
  const diff = initialBalance - finalBalance;
  console.log('Gas Paid:', formatUnits(diff, 18), 'POL');
  
  if (diff === 0n) {
    console.log('🎉 TRUE GASLESS SUCCESS!');
  }
}

test().catch(console.error);
```

Run:
```bash
node test-gasless.mjs
```

---

## 9. References

### Standards & Specifications

- [EIP-7702: Set EOA Account Code](https://eips.ethereum.org/EIPS/eip-7702)
- [EIP-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [EIP-5792: Wallet Call API](https://eips.ethereum.org/EIPS/eip-5792)

### Libraries & Tools

- [MetaMask Smart Accounts Kit](https://github.com/MetaMask/smart-accounts-kit)
- [Pimlico Documentation](https://docs.pimlico.io)
- [viem Account Abstraction](https://viem.sh/account-abstraction)
- [permissionless.js](https://docs.pimlico.io/permissionless)

### Contract Addresses

| Contract | Address |
|----------|---------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| MetaMask Stateless Delegator | `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` |

---

## Conclusion

TRUE gasless transactions with EIP-7702 are achievable using:

1. **MetaMask Smart Accounts Kit** - For proper UserOperation formatting
2. **Pimlico Bundler + Paymaster** - For gas sponsorship
3. **Correct configuration** - Implementation name, signer format, gas estimation

The key insight is that `useSendCalls` alone is NOT gasless. You need the full stack:
- Smart Account instance from MetaMask kit
- Pimlico paymaster for sponsorship
- Bundler client with paymaster integration

**Users pay $0 in gas fees. The paymaster covers all costs.**

---

*Report generated: November 29, 2025*
*Wallet tested: 0x5a87A3c738cf99DB95787D51B627217B6dE12F62*
*Chains tested: Polygon Amoy (80002), Ethereum Sepolia (11155111)*
