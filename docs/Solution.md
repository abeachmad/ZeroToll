“ZeroToll uses ERC-4337 + Pimlico and can incorporate EIP-7702 via the relayer account.”



## 0. Target properties (so we don’t self-lie)

What we’re actually building:

* Wallet: **MetaMask only** on the frontend
* Backend: **Node.js relayer** using:

  * `viem` + (optionally) MetaMask Smart Accounts Kit
  * Pimlico bundler + paymaster (Sepolia / Amoy)
* UX: user clicks “Swap” → **pays 0 gas**; gas paid by **relayer AA** via Pimlico
* Trust model:

  * Contracts verify **user-signed intent** on-chain
  * Backend **cannot steal funds** if contracts are correct
  * Backend *can* censor (choose not to send), which is normal for a relayer

Important honesty bit:

* The **user’s MetaMask EOA is *not*** a 7702 smart account.
* The **relayer account** *can* be 7702+4337 if you want to show that in your tech story.

If you try to sell it as “user’s MetaMask is 7702 smart account”, that’s wrong. Sell it as:

> “We use EIP-7702 + ERC-4337 + Pimlico in our relayer architecture to sponsor gas for MetaMask users, who interact via signed intents.”

That’s accurate.

---

## 1. On-chain contract: intent-based, non-custodial

You need a contract that **only executes swaps when given a valid user signature**, so the backend cannot do arbitrary stuff.

### 1.1. Minimal interface (Solidity sketch)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ZeroTollRouter {
    struct SwapIntent {
        address user;          // MetaMask EOA
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        uint256 nonce;
        uint256 chainId;       // for EIP-712 domain separation
    }

    bytes32 public constant SWAP_INTENT_TYPEHASH =
        keccak256(
            "SwapIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,uint256 chainId)"
        );

    mapping(address => uint256) public nonces;

    // EIP-712 domain separator
    bytes32 public DOMAIN_SEPARATOR;

    constructor(string memory name, string memory version) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                chainId,
                address(this)
            )
        );
    }

    function executeSwap(
        SwapIntent calldata intent,
        bytes calldata userSignature
    ) external {
        require(block.timestamp <= intent.deadline, "Expired");
        require(intent.user != address(0), "Invalid user");
        require(intent.nonce == nonces[intent.user], "Bad nonce");

        // Verify signer == intent.user
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        SWAP_INTENT_TYPEHASH,
                        intent.user,
                        intent.tokenIn,
                        intent.tokenOut,
                        intent.amountIn,
                        intent.minAmountOut,
                        intent.deadline,
                        intent.nonce,
                        intent.chainId
                    )
                )
            )
        );

        address signer = _recover(digest, userSignature);
        require(signer == intent.user, "Invalid signature");

        // Increment nonce to prevent replay
        nonces[intent.user]++;

        // Now perform the swap using your existing ZeroToll logic
        // - pull tokens from user (permit / allowance)
        // - route via your pools or external DEX
        // - send tokenOut back to user
        _doSwap(intent);
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) revert("Bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return ecrecover(digest, v, r, s);
    }

    function _doSwap(SwapIntent calldata intent) internal {
        // TODO: your routing logic here.
        // Important: router never holds funds after swap completes.
    }
}
```

**Important constraints:**

* Only executes when `signer == intent.user`.
* Uses a **nonce per user**, so backend cannot replay old intents.
* `amountIn`, `minAmountOut`, `deadline` are all in the signed payload.
* Backend can choose *when* to call (censorship), but **cannot change what gets executed**.

This is the key to making the backend “gas sponsor” instead of “custodian”.

---

## 2. Backend relayer architecture

### 2.1. Stack

* **Node.js** (TS)
* `viem` or `@pimlico/permissionless`
* **Optionally** `@metamask/smart-accounts-kit` if you want the relayer to be 7702 stateless.

Environment:

* `RELAYER_PRIVATE_KEY` – EOA key used by relayer
* `PIMLICO_BUNDLER_URL` – `https://api.pimlico.io/v2/11155111/rpc` etc
* `PIMLICO_API_KEY` – for paymaster/bundler
* `ROUTER_ADDRESS` – deployed `ZeroTollRouter`

### 2.2. Optional: make relayer account 7702 smart account

If you *really* want 7702 in the story:

* Run a **one-time provisioning script** (backend only):

  ```ts
  import { createPublicClient, http, privateKeyToAccount } from "viem";
  import { sepolia } from "viem/chains";
  import { toMetaMaskSmartAccount, Implementation } from "@metamask/smart-accounts-kit";

  const rpcUrl = process.env.RPC_URL!;
  const privateKey = process.env.RELAYER_PRIVATE_KEY!;

  const eoa = privateKeyToAccount(`0x${privateKey}`);
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

  async function upgradeRelayer() {
    const smartAccount = await toMetaMaskSmartAccount({
      client,
      implementation: Implementation.Stateless7702,
      address: eoa.address,
      signer: eoa, // local account, NOT MetaMask extension
    });

    // Here you can test sending a UserOp or storing smartAccount address.
    console.log("Relayer smart account address:", smartAccount.address);
  }

  upgradeRelayer().catch(console.error);
  ```

* That uses **local key**; MetaMask restrictions don’t apply because this is not `window.ethereum`.

* You now have a 7702 smart account for the relayer.

* For Pimlico, you can either:

  * use Smart Accounts Kit’s bundler client, or
  * wrap it into `permissionless.js` with a custom `signUserOperation`.

If it’s too much work under time pressure, you can **skip 7702** and just use a normal ERC-4337 smart account (e.g. `SimpleAccount`) from Pimlico/ZeroDev. The user value is the gasless UX; 7702 is mostly “nerd points” for the judges.

### 2.3. Core relayer endpoints

Assuming Express for concreteness:

#### `POST /api/intents/swap`

Frontend sends:

```json
{
  "chainId": 11155111,
  "intent": {
    "user": "0xUser…",
    "tokenIn": "0x…",
    "tokenOut": "0x…",
    "amountIn": "1000000000000000000",
    "minAmountOut": "950000000000000000",
    "deadline": 1735800000,
    "nonce": 3
  },
  "userSignature": "0x…"
}
```

Backend flow:

1. **Check** chainId supported.

2. **Rebuild digest** exactly like in contract and verify signature using viem:

   ```ts
   import { verifyTypedData } from "viem";

   const valid = await verifyTypedData({
     address: intent.user,
     domain,
     types,
     primaryType: "SwapIntent",
     message: intent,
     signature: userSignature,
   });

   if (!valid) throw new Error("Invalid user signature");
   ```

3. **(Optional) enforce relayer policy**, e.g. max size, slippage, blacklist tokens.

4. Construct **call data** for `ZeroTollRouter.executeSwap(intent, userSignature)`.

   ```ts
   import { encodeFunctionData } from "viem";
   import { routerAbi } from "./abis";

   const callData = encodeFunctionData({
     abi: routerAbi,
     functionName: "executeSwap",
     args: [intent, userSignature],
   });
   ```

5. Build a **UserOperation** where:

   * `sender` is the relayer smart account
   * single call:

     * `to = ROUTER_ADDRESS`
     * `data = callData`
   * `callGasLimit`, `verificationGasLimit` set as needed
   * `paymaster` fields left empty for now.

6. Ask **Pimlico** to fill paymaster fields / sponsor gas:

   With permissionless (pseudo-code):

   ```ts
   import { createSmartAccountClient } from "@pimlico/permissionless";

   const relayerClient = createSmartAccountClient({
     rpcUrl: process.env.PIMLICO_BUNDLER_URL!,
     apiKey: process.env.PIMLICO_API_KEY!,
     account: relayerSmartAccount, // from 7702 or normal AA
   });

   const userOpHash = await relayerClient.sendUserOperation({
     calls: [{ to: ROUTER_ADDRESS, data: callData }],
     // pimlico client handles paymaster under the hood
   });
   ```

7. Return to frontend:

```json
{
  "requestId": "uuid-123",
  "userOpHash": "0xabc…"
}
```

#### `GET /api/intents/:id/status`

* Poll Pimlico bundler / RPC for `getUserOperationReceipt(userOpHash)`
* Map to status: `pending | mined | failed`

---

## 3. Frontend flow with MetaMask (React / wagmi / viem)

On the frontend, you **never** touch 7702 or 4337. You just:

1. Connect MetaMask (normal EOA).

2. Build an `intent` object and get current `nonce` (read from `ZeroTollRouter` `nonces(user)` or track locally).

3. Sign intent with **EIP-712**:

   ```ts
   const signature = await window.ethereum.request({
     method: "eth_signTypedData_v4",
     params: [userAddress, JSON.stringify(typedData)],
   });
   ```

   where `typedData` matches the contract’s domain/types.

4. Call backend:

   ```ts
   await fetch("/api/intents/swap", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       chainId,
       intent,
       userSignature: signature,
     }),
   });
   ```

5. Poll `/api/intents/:id/status` or show a link to the AA tx on block explorer.

From the user’s perspective:

* They **sign once** with MetaMask (no gas).
* Your backend + relayer AA + Pimlico do the on-chain swap and pay gas.

That’s real gasless UX.

---

## 4. How this maps to your earlier 3 options

Your list:

> 1. Use a backend with a private key to sign UserOps
> 2. Wait for MetaMask to enable paymasterService on Sepolia
> 3. Use a different wallet

This design is explicitly **Option 1**, but:

* With a **non-custodial contract pattern** (backend can’t steal funds).
* Optional 7702 usage for the **relayer account**, not the user’s EOA.

And it’s actually shippable now, instead of wishing MetaMask added `paymasterService` tomorrow.

---

