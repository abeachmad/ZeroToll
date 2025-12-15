# ZeroToll Phase 2: Self-Hosted Paymaster - Technical Report

> **Date:** December 14, 2025  
> **Version:** 1.0  
> **Status:** Production Ready  
> **Author:** ZeroToll Engineering Team

---

## Executive Summary

Phase 2 implements a self-hosted ERC-4337 paymaster system that enables truly gasless token swaps. Users sign two messages (permit + swap intent) and pay zero gas fees - ZeroToll sponsors all transaction costs through our `VerifyingPaymasterV07` contract.

### Key Achievements
- ✅ Deployed self-hosted paymaster on Sepolia and Polygon Amoy
- ✅ Verified gasless swaps working end-to-end on both networks
- ✅ Frontend integrated with single relayer endpoint (port 3002)
- ✅ No Pimlico paymaster dependency - full cost control
- ✅ User experience: 2 signatures, $0 gas

---

## 1. Architecture Overview

### 1.1 System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ZEROTOLL GASLESS SWAP FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    1. Sign Permit     ┌──────────────────┐                   │
│  │   User   │ ──────────────────────▶│   MetaMask       │                   │
│  │  (EOA)   │    2. Sign Intent     │   (EIP-712)      │                   │
│  └──────────┘ ◀──────────────────────└──────────────────┘                   │
│       │                                                                     │
│       │ 3. Submit signatures                                                │
│       ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ZEROTOLL RELAYER (Port 3002)                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │  │
│  │  │ Verify Intent   │  │ Build UserOp    │  │ Sign with Policy    │   │  │
│  │  │ Signature       │──▶│ (ERC-4337)      │──▶│ Signer Key          │   │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       │ 4. Submit UserOp                                                    │
│       ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      PIMLICO BUNDLER                                  │  │
│  │  • Validates UserOp format                                            │  │
│  │  • Simulates execution                                                │  │
│  │  • Bundles with other UserOps                                         │  │
│  │  • Submits to blockchain                                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       │ 5. handleOps()                                                      │
│       ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      ENTRYPOINT v0.7                                  │  │
│  │  0x0000000071727De22E5E9d8BAf0edAc6f37da032                          │  │
│  │  • Validates UserOp                                                   │  │
│  │  • Calls paymaster.validatePaymasterUserOp()                          │  │
│  │  • Executes UserOp                                                    │  │
│  │  • Calls paymaster.postOp()                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       │ 6. validatePaymasterUserOp()                                        │
│       ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                 VERIFYING PAYMASTER V07                               │  │
│  │  Sepolia: 0xaf7e002447b790f212ea435f9387509cd1ef0054                  │  │
│  │  Amoy:    0xaad1211a722ee04b6980724586b6b5b7b0c86fee                  │  │
│  │                                                                       │  │
│  │  • Verifies policy signer signature                                   │  │
│  │  • Approves gas sponsorship                                           │  │
│  │  • Pays gas from EntryPoint deposit                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       │ 7. execute()                                                        │
│       ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    SMART ACCOUNT (SimpleAccount)                      │  │
│  │  0x2caF80daf45581E017aaC929812b92Ad954Be2E8                          │  │
│  │                                                                       │  │
│  │  • Executes swap on ZeroToll Router                                   │  │
│  │  • Transfers tokens to user                                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│       │                                                                     │
│       │ 8. executeSwapWithPermit()                                          │
│       ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ZEROTOLL ROUTER                                    │  │
│  │  Sepolia: 0x577560699EF88e99f15d04df57c9552056d2a10D                  │  │
│  │  Amoy:    0xc75df1943d6EFE04b422b9bB45509782609Fc67a                  │  │
│  │                                                                       │  │
│  │  • Verifies user's swap intent signature                              │  │
│  │  • Executes permit (gasless token approval)                           │  │
│  │  • Performs token swap via adapter                                    │  │
│  │  • Transfers output tokens to user                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility | Location |
|-----------|---------------|----------|
| Frontend | Collect signatures, display status | `frontend/src/hooks/useIntentGasless.js` |
| Relayer | Build UserOps, sign with policy key | `backend/phase2-relayer.mjs` |
| Pimlico Bundler | Submit UserOps to blockchain | External service |
| VerifyingPaymasterV07 | Validate & sponsor gas | On-chain contract |
| Smart Account | Execute swaps on behalf of relayer | On-chain (SimpleAccount) |
| ZeroToll Router | Execute token swaps | On-chain contract |

---

## 2. Smart Contract: VerifyingPaymasterV07

### 2.1 Contract Overview

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerifyingPaymasterV07 is Ownable {
    IEntryPoint public immutable entryPoint;
    address public immutable verifySigner;
    
    // v0.7 paymasterAndData format:
    // Bytes 0-20:  paymaster address
    // Bytes 20-36: paymasterVerificationGasLimit (uint128)
    // Bytes 36-52: paymasterPostOpGasLimit (uint128)
    // Bytes 52+:   signature from policy server
}
```

### 2.2 Key Functions

#### `validatePaymasterUserOp`
Called by EntryPoint to validate if paymaster will sponsor the UserOp.

```solidity
function validatePaymasterUserOp(
    PackedUserOperation calldata userOp,
    bytes32 userOpHash,
    uint256 maxCost
) external returns (bytes memory context, uint256 validationData);
```

**Validation Logic:**
1. Extract signature from `paymasterAndData[52:]`
2. Calculate hash of UserOp (excluding paymaster signature)
3. Recover signer from signature
4. Verify signer matches `verifySigner`
5. Return validation result

#### `getHash`
Calculates the hash that the policy server must sign.

```solidity
function getHash(PackedUserOperation calldata userOp) public view returns (bytes32) {
    return keccak256(abi.encode(
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.accountGasLimits,
        userOp.preVerificationGas,
        userOp.gasFees,
        keccak256(paymasterAndDataWithoutSig),
        block.chainid,
        address(this)
    ));
}
```

### 2.3 Deployment Addresses

| Network | Address | Explorer |
|---------|---------|----------|
| Sepolia | `0xaf7e002447b790f212ea435f9387509cd1ef0054` | [View](https://sepolia.etherscan.io/address/0xaf7e002447b790f212ea435f9387509cd1ef0054) |
| Amoy | `0xaad1211a722ee04b6980724586b6b5b7b0c86fee` | [View](https://amoy.polygonscan.com/address/0xaad1211a722ee04b6980724586b6b5b7b0c86fee) |

### 2.4 Constructor Parameters

```solidity
constructor(
    IEntryPoint _entryPoint,    // 0x0000000071727De22E5E9d8BAf0edAc6f37da032
    address _verifySigner       // 0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A
)
```

---

## 3. Backend: Phase 2 Relayer

### 3.1 Overview

The Phase 2 Relayer (`backend/phase2-relayer.mjs`) is a Node.js Express server that:
1. Receives signed swap intents from frontend
2. Builds ERC-4337 UserOperations
3. Signs with policy signer key
4. Submits to Pimlico bundler
5. Tracks transaction status

### 3.2 API Endpoints

#### `POST /api/intents/swap-with-permit`
Execute a gasless swap with ERC-2612 permit.

**Request:**
```json
{
  "chainId": 80002,
  "intent": {
    "user": "0x7E98e08FbD9c6250Bc6b6649A09268C2500373E2",
    "tokenIn": "0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD",
    "tokenOut": "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9",
    "amountIn": "1000000",
    "minAmountOut": "900000000000000000",
    "deadline": "1765720536",
    "nonce": "0",
    "chainId": "80002"
  },
  "userSignature": "0x...",
  "permit": {
    "v": 28,
    "r": "0x...",
    "s": "0x...",
    "deadline": 1765720536
  }
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "phase2_1734192000000",
  "userOpHash": "0x...",
  "smartAccount": "0x2caF80daf45581E017aaC929812b92Ad954Be2E8",
  "explorerUrl": "https://amoy.polygonscan.com/tx/0x...",
  "sponsor": "ZeroToll Paymaster (Phase 2)",
  "message": "Gas sponsored by ZeroToll!"
}
```

#### `GET /api/intents/:id/status`
Check swap status.

**Response:**
```json
{
  "requestId": "phase2_1734192000000",
  "status": "confirmed",
  "userOpHash": "0x...",
  "txHash": "0x321e898840e4532e4fecbdea6af812e24f9de1dd0678d64c32e60aff0d7e4165",
  "explorerUrl": "https://amoy.polygonscan.com/tx/0x..."
}
```

#### `GET /api/nonce/:chainId/:address`
Get user's nonce for swap intent.

#### `GET /api/config/:chainId`
Get chain configuration.

#### `GET /api/paymaster/balance/:chainId`
Get paymaster deposit balance.

#### `GET /health`
Health check with system status.

### 3.3 UserOp Construction

```javascript
// Build packed UserOp for v0.7
const packedUserOp = {
  sender: smartAccountAddress,
  nonce: nonce,
  initCode: initCode,           // Factory call if account doesn't exist
  callData: executeCallData,    // SimpleAccount.execute(router, 0, swapData)
  accountGasLimits: accountGasLimits,  // (verificationGas << 128) | callGas
  preVerificationGas: 100000n,
  gasFees: gasFees,             // (maxPriorityFee << 128) | maxFee
  paymasterAndData: paymasterAndData,  // paymaster + gasLimits + signature
  signature: accountSignature
};
```

### 3.4 Paymaster Signature Flow

```javascript
// 1. Build paymasterAndData with dummy signature
const paymasterAndDataForHash = buildPaymasterAndData(
  paymaster,
  verificationGasLimit,
  postOpGasLimit,
  '0x' + '00'.repeat(65)  // 65 zero bytes
);

// 2. Get hash from paymaster contract
const hashToSign = await publicClient.readContract({
  address: paymaster,
  abi: PAYMASTER_ABI,
  functionName: 'getHash',
  args: [packedUserOpForHash]
});

// 3. Sign with policy signer
const paymasterSig = await policySignerAccount.signMessage({
  message: { raw: hashToSign }
});

// 4. Build final paymasterAndData
const paymasterAndData = buildPaymasterAndData(
  paymaster,
  verificationGasLimit,
  postOpGasLimit,
  paymasterSig
);
```

---

## 4. Frontend Integration

### 4.1 Hook: useIntentGasless

Location: `frontend/src/hooks/useIntentGasless.js`

**Key Configuration:**
```javascript
// Single relayer URL - self-hosted paymaster only
const RELAYER_URL = process.env.REACT_APP_RELAYER_URL || 'http://localhost:3002';
```

### 4.2 Swap Flow

```javascript
// 1. Sign ERC-2612 Permit
const permit = await signPermit(tokenIn, routerAddress, amountIn, deadline);

// 2. Sign Swap Intent (EIP-712)
const signature = await walletClient.request({
  method: 'eth_signTypedData_v4',
  params: [address, JSON.stringify(typedData)]
});

// 3. Submit to relayer
const response = await fetch(`${RELAYER_URL}/api/intents/swap-with-permit`, {
  method: 'POST',
  body: JSON.stringify({ chainId, intent, userSignature, permit })
});

// 4. Poll for confirmation
const status = await fetch(`${RELAYER_URL}/api/intents/${requestId}/status`);
```

### 4.3 Supported Tokens

**ERC-2612 Permit Tokens (Fully Gasless):**
| Token | Sepolia | Amoy |
|-------|---------|------|
| zUSDC | `0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C` | `0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD` |
| zETH | `0x8153FA09Be1689D44C343f119C829F6702A8720b` | `0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9` |
| zPOL | `0x63c31C4247f6AA40B676478226d6FEB5707649D6` | `0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d` |
| zLINK | `0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C` | `0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1` |

---

## 5. Key Addresses

### 5.1 Infrastructure

| Component | Address |
|-----------|---------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| SimpleAccount Factory | `0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985` |
| Relayer EOA | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` |
| Policy Signer | `0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A` |
| Smart Account | `0x2caF80daf45581E017aaC929812b92Ad954Be2E8` |

### 5.2 Paymasters

| Network | Address | Deposit |
|---------|---------|---------|
| Sepolia | `0xaf7e002447b790f212ea435f9387509cd1ef0054` | ~0.2 ETH |
| Amoy | `0xaad1211a722ee04b6980724586b6b5b7b0c86fee` | ~1 POL |

### 5.3 Routers

| Network | Address |
|---------|---------|
| Sepolia | `0x577560699EF88e99f15d04df57c9552056d2a10D` |
| Amoy | `0xc75df1943d6EFE04b422b9bB45509782609Fc67a` |

---

## 6. Verified Transactions

### 6.1 Sepolia Test

**Transaction:** `0xb1b35a8babc749d74f389af3a8e2f16000f4a7d37e08b841f63be7e1723f4b4f`

**Details:**
- Swap: 1 zUSDC → zETH
- Gas Paid: 0 (sponsored by paymaster)
- Paymaster: `0xaf7e002447b790f212ea435f9387509cd1ef0054`

[View on Etherscan](https://sepolia.etherscan.io/tx/0xb1b35a8babc749d74f389af3a8e2f16000f4a7d37e08b841f63be7e1723f4b4f)

### 6.2 Amoy Test

**Transaction:** `0x3b0e9a09612da693eeb50ba130302e57ecb50c4df97cdd5f0d438fb8e8a3ae1f`

**Details:**
- Swap: 1 zUSDC → zETH
- Gas Paid: 0 (sponsored by paymaster)
- Paymaster: `0xaad1211a722ee04b6980724586b6b5b7b0c86fee`

[View on Polygonscan](https://amoy.polygonscan.com/tx/0x3b0e9a09612da693eeb50ba130302e57ecb50c4df97cdd5f0d438fb8e8a3ae1f)

---

## 7. Why Pimlico Bundler + Our Paymaster?

### 7.1 The Problem with Self-Hosted Bundler

The Infinitism bundler requires `debug_traceCall` RPC support for UserOp simulation. Public RPC endpoints don't provide this method.

**Options Considered:**
1. ❌ Run archive node - Expensive, complex
2. ❌ Use paid RPC with debug support - Additional cost
3. ✅ Use Pimlico bundler + our paymaster - Best of both worlds

### 7.2 Hybrid Architecture Benefits

| Aspect | Pimlico Bundler | Our Paymaster |
|--------|-----------------|---------------|
| UserOp Simulation | ✅ Handled | - |
| Gas Estimation | ✅ Accurate | - |
| Bundle Submission | ✅ Reliable | - |
| Gas Sponsorship | - | ✅ We control |
| Cost Control | - | ✅ Our deposit |
| Policy Control | - | ✅ Our signer |

### 7.3 Cost Comparison

| Approach | Cost per Swap | Control |
|----------|---------------|---------|
| Pimlico Paymaster | ~$0.50 + markup | Low |
| Self-Hosted (Full) | ~$0.30 | High |
| **Hybrid (Current)** | **~$0.30** | **High** |

---

## 8. Security Considerations

### 8.1 Policy Signer Key

The policy signer key (`RELAYER_PRIVATE_KEY`) is critical:
- Signs all UserOps for paymaster validation
- Must be kept secure
- Consider HSM for production

### 8.2 Paymaster Deposit

- Monitor deposit balance regularly
- Set up alerts for low balance
- Auto-refill mechanism available (`gas-tank-monitor.mjs`)

### 8.3 Rate Limiting

Future enhancement:
- Limit swaps per user per day
- Limit total gas sponsored per day
- Blacklist abusive addresses

---

## 9. Operational Procedures

### 9.1 Starting Services

```bash
./start-zerotoll.sh
```

This starts:
- Python Backend (port 8000)
- ZeroToll Relayer (port 3002)
- Delegation API (port 3003)
- Frontend (port 3000)

### 9.2 Stopping Services

```bash
./stop-zerotoll.sh
```

### 9.3 Checking Paymaster Balance

```bash
curl http://localhost:3002/api/paymaster/balance/11155111  # Sepolia
curl http://localhost:3002/api/paymaster/balance/80002     # Amoy
```

### 9.4 Monitoring Logs

```bash
tail -f .pids/relayer.log
tail -f .pids/backend.log
tail -f .pids/frontend.log
```

---

## 10. Future Enhancements

### 10.1 Planned

- [ ] Rate limiting per user
- [ ] Gas tank auto-refill alerts
- [ ] Multi-sig policy signer
- [ ] Analytics dashboard

### 10.2 Potential

- [ ] Cross-chain gasless swaps
- [ ] Session keys for recurring swaps
- [ ] Batch UserOps for efficiency
- [ ] Custom paymaster policies (whitelist, limits)

---

## 11. Troubleshooting

### 11.1 Common Issues

**"Paymaster not configured"**
- Check `SEPOLIA_VERIFYING_PAYMASTER` or `AMOY_VERIFYING_PAYMASTER` in `.env.credentials`

**"Invalid signature"**
- Verify user signed with correct domain (router address, chainId)
- Check permit signature components (v, r, s)

**"AA21 didn't pay prefund"**
- Paymaster deposit is too low
- Fund paymaster: `paymaster.deposit{value: 0.1 ether}()`

**"AA25 invalid account nonce"**
- Nonce mismatch - fetch fresh nonce from router

### 11.2 Debug Commands

```bash
# Check relayer health
curl http://localhost:3002/health

# Check paymaster balance
curl http://localhost:3002/api/paymaster/balance/80002

# Check user nonce
curl http://localhost:3002/api/nonce/80002/0x7E98e08FbD9c6250Bc6b6649A09268C2500373E2
```

---

## 12. Conclusion

Phase 2 successfully implements a self-hosted paymaster system that:

1. **Reduces costs** - We control gas sponsorship, no Pimlico paymaster markup
2. **Maintains UX** - Users still sign 2 messages, pay $0 gas
3. **Provides control** - We decide who gets sponsored
4. **Is production-ready** - Tested on Sepolia and Amoy

The hybrid architecture (Pimlico bundler + our paymaster) provides the best balance of reliability and cost control.

---

## Appendix A: File Structure

```
ZeroToll/
├── backend/
│   ├── phase2-relayer.mjs          # Main relayer (port 3002)
│   ├── gas-tank-monitor.mjs        # Balance monitoring
│   └── check-balances.mjs          # Balance checker
├── frontend/
│   └── src/
│       ├── hooks/
│       │   └── useIntentGasless.js # Frontend hook
│       └── pages/
│           └── Swap.jsx            # Swap UI
├── packages/
│   └── contracts/
│       └── contracts/
│           └── VerifyingPaymasterV07.sol
├── docs/
│   ├── PHASE2_IMPLEMENTATION_PLAN.md
│   └── PHASE2_TECHNICAL_REPORT.md  # This file
├── start-zerotoll.sh               # Start all services
└── stop-zerotoll.sh                # Stop all services
```

## Appendix B: Environment Variables

```env
# Required
RELAYER_PRIVATE_KEY=<private_key>
PIMLICO_API_KEY=<api_key>

# Paymaster Addresses
SEPOLIA_VERIFYING_PAYMASTER=0xaf7e002447b790f212ea435f9387509cd1ef0054
AMOY_VERIFYING_PAYMASTER=0xaad1211a722ee04b6980724586b6b5b7b0c86fee

# Frontend
REACT_APP_RELAYER_URL=http://localhost:3002
```

## Appendix C: Gas Costs

| Operation | Estimated Gas | Cost (at 30 gwei) |
|-----------|---------------|-------------------|
| UserOp Verification | ~100,000 | ~0.003 ETH |
| Paymaster Validation | ~50,000 | ~0.0015 ETH |
| Swap Execution | ~200,000 | ~0.006 ETH |
| **Total** | **~350,000** | **~0.01 ETH** |

*Actual costs vary based on network conditions and swap complexity.*
