# EIP-7702 Implementation Plan for ZeroToll

## Research Findings

### Network Support ✅

| Network | EIP-7702 Support | Verified |
|---------|------------------|----------|
| **Polygon Amoy** | ✅ Yes | RPC returns "EIP-7702 transaction with empty auth list" |
| **Ethereum Sepolia** | ✅ Yes | RPC returns "EIP-7702 transaction with empty auth list" |

### Viem Support ✅

```javascript
// viem/experimental exports:
- eip7702Actions
- hashAuthorization
- prepareAuthorization
- recoverAuthorizationAddress
- serializeAuthorizationList
- signAuthorization
- verifyAuthorization

// viem/accounts exports:
- signAuthorization
```

---

## What is EIP-7702?

EIP-7702 allows an EOA to **temporarily delegate** to a smart contract's code for a single transaction. After the transaction, the EOA reverts to being a normal EOA.

### Key Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                     BEFORE EIP-7702                         │
├─────────────────────────────────────────────────────────────┤
│  EOA (0x123...)                                             │
│  - Can only send simple transfers                           │
│  - Cannot execute complex logic                             │
│  - Must have native token for gas                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     WITH EIP-7702                           │
├─────────────────────────────────────────────────────────────┤
│  EOA (0x123...) + Authorization                             │
│  - Temporarily has smart contract code                      │
│  - Can execute complex swap logic                           │
│  - Can batch multiple operations                            │
│  - Relayer pays gas, user signs authorization               │
│  - After tx: back to normal EOA                             │
└─────────────────────────────────────────────────────────────┘
```

### Authorization Structure

```javascript
const authorization = {
  chainId: 80002,                    // Polygon Amoy
  address: DELEGATE_CONTRACT,        // Contract code to use
  nonce: userNonce,                  // User's current nonce
  // Signed by user's private key
};
```

---

## Why EIP-7702 for ZeroToll?

### Current ERC-4337 Flow (Complex)

```
User signs permit + intent
        ↓
Relayer builds UserOperation
        ↓
Bundler validates & submits to EntryPoint
        ↓
EntryPoint calls Smart Account
        ↓
Smart Account calls Router
        ↓
Paymaster pays gas
        ↓
6 contract calls, high gas overhead
```

### New EIP-7702 Flow (Simple)

```
User signs authorization + permit + intent
        ↓
Relayer builds single transaction with authorizationList
        ↓
Relayer submits directly to RPC
        ↓
EOA executes delegate code (swap + unwrap)
        ↓
2-3 contract calls, lower gas
```

### Benefits

| Aspect | ERC-4337 | EIP-7702 |
|--------|----------|----------|
| Gas cost | ~300,000 | ~150,000 |
| Infrastructure | Bundler + EntryPoint + Paymaster | Just relayer |
| User experience | "Upgrade to Smart Account" | Invisible |
| Account type | Permanent Smart Account | EOA stays EOA |
| Complexity | High | Medium |
| Native token output | Requires extra logic | Built-in |

---

## Implementation Plan

### Phase 3A: EIP-7702 Core (Week 1-2)

#### 1. Deploy ZeroTollDelegate Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
}

interface IZeroTollRouter {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256);
}

/**
 * @title ZeroTollDelegate
 * @notice Delegate contract for EIP-7702 gasless swaps
 * @dev User's EOA temporarily delegates to this contract
 */
contract ZeroTollDelegate {
    // Special address for native token
    address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    // Immutable addresses (set at deployment)
    address public immutable router;
    address public immutable treasury;
    address public immutable weth;  // WETH on Sepolia, WPOL on Amoy
    
    // Domain separator for intent verification
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    bytes32 public constant SWAP_INTENT_TYPEHASH = keccak256(
        "SwapIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,uint256 chainId)"
    );
    
    struct SwapIntent {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        uint256 nonce;
        uint256 chainId;
    }
    
    struct PermitData {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
    
    // Nonces for replay protection
    mapping(address => uint256) public nonces;
    
    constructor(address _router, address _treasury, address _weth) {
        router = _router;
        treasury = _treasury;
        weth = _weth;
        
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("ZeroTollDelegate"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }
    
    /**
     * @notice Execute gasless swap with permit
     * @dev Called via EIP-7702 delegation on user's EOA
     * @param intent Swap intent signed by user
     * @param intentSignature User's signature on intent
     * @param permit Permit data for token approval
     * @param fee Fee amount to send to treasury
     */
    function execute(
        SwapIntent calldata intent,
        bytes calldata intentSignature,
        PermitData calldata permit,
        uint256 fee
    ) external returns (uint256 amountOut) {
        // 1. Verify this is being called on the user's EOA via 7702
        require(address(this) == intent.user, "Invalid delegation");
        
        // 2. Verify deadline
        require(block.timestamp <= intent.deadline, "Intent expired");
        
        // 3. Verify and increment nonce
        require(nonces[intent.user] == intent.nonce, "Invalid nonce");
        nonces[intent.user]++;
        
        // 4. Verify intent signature
        bytes32 structHash = keccak256(abi.encode(
            SWAP_INTENT_TYPEHASH,
            intent.user,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            intent.minAmountOut,
            intent.deadline,
            intent.nonce,
            intent.chainId
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = _recover(digest, intentSignature);
        require(signer == intent.user, "Invalid signature");
        
        // 5. Execute permit (gasless approval)
        IERC20Permit(intent.tokenIn).permit(
            intent.user,
            address(this),
            intent.amountIn,
            permit.deadline,
            permit.v,
            permit.r,
            permit.s
        );
        
        // 6. Transfer fee to treasury
        if (fee > 0) {
            IERC20(intent.tokenIn).transfer(treasury, fee);
        }
        
        // 7. Approve router for swap amount
        uint256 swapAmount = intent.amountIn - fee;
        IERC20(intent.tokenIn).approve(router, swapAmount);
        
        // 8. Execute swap
        bool isNativeOut = intent.tokenOut == NATIVE || intent.tokenOut == weth;
        address actualTokenOut = isNativeOut ? weth : intent.tokenOut;
        
        amountOut = IZeroTollRouter(router).swap(
            intent.tokenIn,
            actualTokenOut,
            swapAmount,
            intent.minAmountOut
        );
        
        // 9. If native output, unwrap WETH and keep in EOA
        if (isNativeOut && intent.tokenOut == NATIVE) {
            IWETH(weth).withdraw(amountOut);
            // Native token now in user's EOA (this contract via delegation)
        }
        
        return amountOut;
    }
    
    /**
     * @notice Recover signer from signature
     */
    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        return ecrecover(digest, v, r, s);
    }
    
    /**
     * @notice Receive native token (for WETH unwrap)
     */
    receive() external payable {}
}
```

#### 2. Update Relayer for 7702

```javascript
// backend/eip7702-relayer.mjs

import { 
  createWalletClient, 
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { 
  eip7702Actions,
  signAuthorization 
} from 'viem/experimental';
import { polygonAmoy, sepolia } from 'viem/chains';

const DELEGATE_ADDRESS = {
  80002: '0x...', // Amoy
  11155111: '0x...' // Sepolia
};

/**
 * Execute gasless swap using EIP-7702
 */
async function executeSwap7702(chainId, userAuth, permit, intent, intentSig, fee) {
  const chain = chainId === 80002 ? polygonAmoy : sepolia;
  const delegateAddress = DELEGATE_ADDRESS[chainId];
  
  // Create relayer wallet client with 7702 actions
  const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  const walletClient = createWalletClient({
    account: relayerAccount,
    chain,
    transport: http(RPC_URL[chainId])
  }).extend(eip7702Actions());
  
  // Encode delegate call
  const callData = encodeFunctionData({
    abi: DELEGATE_ABI,
    functionName: 'execute',
    args: [intent, intentSig, permit, fee]
  });
  
  // Build and send 7702 transaction
  const txHash = await walletClient.sendTransaction({
    to: intent.user,  // Call user's EOA directly!
    data: callData,
    authorizationList: [userAuth],  // User's 7702 authorization
    gas: 300000n
  });
  
  return txHash;
}
```

#### 3. Update Frontend for 7702 Signing

```javascript
// frontend/src/hooks/useEIP7702Gasless.js

import { useWalletClient } from 'wagmi';
import { signAuthorization } from 'viem/experimental';

export function useEIP7702Gasless() {
  const { data: walletClient } = useWalletClient();
  
  const executeGaslessSwap = async (tokenIn, tokenOut, amountIn, minAmountOut) => {
    // 1. Get user's current nonce
    const nonce = await publicClient.getTransactionCount({ address: userAddress });
    
    // 2. Sign EIP-7702 authorization
    const authorization = await walletClient.signAuthorization({
      contractAddress: DELEGATE_ADDRESS,
      chainId: chainId,
      nonce: nonce
    });
    
    // 3. Sign ERC-2612 permit
    const permitSig = await signPermit(tokenIn, DELEGATE_ADDRESS, amountIn);
    
    // 4. Sign swap intent
    const intent = {
      user: userAddress,
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      nonce: intentNonce,
      chainId
    };
    const intentSig = await signTypedData(INTENT_TYPES, intent);
    
    // 5. Submit to relayer
    const response = await fetch(`${RELAYER_URL}/api/swap-7702`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId,
        authorization,
        permit: permitSig,
        intent,
        intentSignature: intentSig
      })
    });
    
    return response.json();
  };
  
  return { executeGaslessSwap };
}
```

---

### Phase 3B: Native Token Support (Week 2-3)

#### Special Handling for ERC20 → Native

```javascript
// In frontend
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// User wants to buy POL with USDC
const intent = {
  tokenIn: USDC_ADDRESS,
  tokenOut: NATIVE_TOKEN,  // Special address
  amountIn: parseUnits('100', 6),  // 100 USDC
  minAmountOut: parseEther('200')  // Expect ~200 POL
};
```

#### Router Update for Native Output

```solidity
// In ZeroTollRouterV3 or new adapter
function swapToNative(
    address tokenIn,
    uint256 amountIn,
    uint256 minAmountOut,
    address recipient
) external returns (uint256) {
    // 1. Swap tokenIn → WETH/WPOL
    uint256 wethOut = _swap(tokenIn, WETH, amountIn);
    
    // 2. Unwrap
    IWETH(WETH).withdraw(wethOut);
    
    // 3. Send native to recipient
    (bool success, ) = recipient.call{value: wethOut}("");
    require(success, "Native transfer failed");
    
    require(wethOut >= minAmountOut, "Slippage");
    return wethOut;
}
```

---

### Phase 3C: Hybrid Mode (Week 3-4)

Support both ERC-4337 and EIP-7702 based on:
1. Network support
2. User preference
3. Gas optimization

```javascript
// Relayer decides which path
async function executeGaslessSwap(request) {
  const { chainId, mode } = request;
  
  if (mode === '7702' && SUPPORTS_7702[chainId]) {
    return execute7702Swap(request);
  } else {
    return execute4337Swap(request);  // Fallback to current
  }
}
```

---

## Migration Strategy

### Week 1: Foundation
- [ ] Deploy ZeroTollDelegate on Amoy
- [ ] Deploy ZeroTollDelegate on Sepolia
- [ ] Create eip7702-relayer.mjs
- [ ] Test basic 7702 transaction

### Week 2: Integration
- [ ] Update frontend with useEIP7702Gasless hook
- [ ] Add 7702 mode toggle in UI
- [ ] Implement fee calculation for 7702
- [ ] Test ERC20 → ERC20 swaps

### Week 3: Native Token
- [ ] Add native token output support
- [ ] Update router for WETH unwrap
- [ ] Test ERC20 → Native swaps
- [ ] Handle edge cases (insufficient output, etc.)

### Week 4: Production Ready
- [ ] Hybrid mode (4337 + 7702)
- [ ] Gas comparison metrics
- [ ] Error handling and fallbacks
- [ ] Documentation update

---

## Gas Comparison (Estimated)

| Operation | ERC-4337 | EIP-7702 | Savings |
|-----------|----------|----------|---------|
| Simple swap | ~300,000 | ~150,000 | 50% |
| Swap + unwrap | ~350,000 | ~180,000 | 49% |
| First-time user | ~400,000 | ~150,000 | 63% |

---

## Security Considerations

### 1. Delegate Contract Security
- Minimal attack surface
- No upgradability (immutable)
- Audited before mainnet

### 2. Authorization Replay Protection
- Chain ID in authorization
- Nonce management
- Deadline enforcement

### 3. Signature Verification
- EIP-712 typed data
- Proper domain separator
- Nonce per user

### 4. Fee Protection
- Fee calculated by relayer
- User sees fee before signing
- Max fee cap in contract

---

## Files to Create/Modify

### New Files
```
packages/contracts/contracts/ZeroTollDelegate.sol
backend/eip7702-relayer.mjs
frontend/src/hooks/useEIP7702Gasless.js
docs/EIP7702_IMPLEMENTATION_PLAN.md (this file)
```

### Modified Files
```
backend/phase2-relayer.mjs (add hybrid mode)
frontend/src/pages/Swap.jsx (add 7702 option)
frontend/src/config/contracts.json (add delegate addresses)
README.md (update architecture)
```

---

## Next Steps

1. **Approve this plan** - Review and confirm approach
2. **Deploy delegate contract** - Start with Amoy testnet
3. **Build 7702 relayer** - New endpoint for 7702 swaps
4. **Update frontend** - Add 7702 signing flow
5. **Test end-to-end** - ERC20 → ERC20 and ERC20 → Native
6. **Compare gas costs** - Measure actual savings
7. **Production rollout** - Enable for all users

---

## References

- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [Viem EIP-7702 Docs](https://viem.sh/experimental/eip7702)
- [Biconomy 7702 Guide](https://blog.biconomy.io/a-comprehensive-eip-7702-guide-for-apps/)
- [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/)
