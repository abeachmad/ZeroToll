# ZeroToll Fhenix Direct Integration

Updated: 2026-04-02

## Executive Summary

Direct Fhenix integration will not be a small patch on top of the current ZeroToll swap flow.

The key reason is simple:

- the current ZeroToll routers enforce `minOut` and fee logic with normal public `require(...)` checks
- Fhenix comparisons return encrypted booleans
- encrypted booleans cannot drive normal Solidity `if` / `require` control flow
- Fhenix decryption is asynchronous and requires a later transaction

That means a true confidential threshold flow changes the protocol from:

- **single-step public swap execution**

into:

- **multi-step confidential intent settlement**

This is the most important architectural consequence.

## What Can Stay The Same

The economic engine does not need to be replaced.

ZeroToll should keep:

- ERC-4337 paymaster sponsorship
- ZeroToll relayer as the sponsor / executor
- fee recoup from user token flow
- treasury accounting for gas pool rewards

In other words:

- **ERC-4337 stays the gasless engine**
- **Fhenix becomes the confidentiality layer**

## What Cannot Stay The Same

The current RouterHub path in [RouterHub.sol](../packages/contracts/contracts/RouterHub.sol) assumes public values.

Examples:

- it pulls a public `intent.amtIn`
- it checks a public `intent.minOut`
- it immediately transfers or unwraps public output amounts

This works today because the control flow is fully public.

If `minOut` becomes encrypted:

- the contract can compare `grossOut` with encrypted `minOut`
- but the comparison result is an `ebool`
- that `ebool` cannot be used in normal public branching
- so the contract cannot safely do the current `require(grossOut >= minOut, "Slippage exceeded")` pattern

This makes a direct drop-in replacement unrealistic.

## Practical Consequence

If ZeroToll wants **real confidential threshold enforcement**, the confidential path should be designed as a separate flow:

1. user submits a confidential intent
2. input funds are escrowed or locked for settlement
3. the swap is attempted
4. the contract computes encrypted validity
5. decryption is requested
6. a later transaction finalizes either:
   - release output to user
   - or refund / fail the settlement path

That is a different product path than the current instant RouterHub swap.

## Recommended Product Split

### Public gasless path

Keep the current path for the main product:

- fast
- simple
- production-friendly
- ERC-4337 gasless

### Confidential buildathon path

Add a separate Fhenix-powered mode for:

- confidential execution thresholds
- MEV-resistant gasless intents
- privacy-first demos and experimentation

This avoids destabilizing the existing runtime while still creating a credible buildathon track.

## Recommended MVP Scope

The best direct Fhenix MVP for ZeroToll is:

**Confidential MinOut with escrowed finalization**

Public fields:

- user
- tokenIn
- tokenOut
- amountIn
- deadline
- nonce
- chainId

Encrypted field:

- `minOut`

Optional encrypted fields for later phases:

- slippage tolerance
- route preference bucket
- sponsor fee tolerance

## Recommended Contract Architecture

### 1. New library

Add a Fhenix-specific intent library:

- `packages/contracts/contracts/fhenix/ConfidentialIntentLib.sol`

Purpose:

- define a new confidential intent struct
- keep public fields separate from encrypted handles
- define intent hashing rules for public metadata

Suggested public struct shape:

```solidity
struct ConfidentialIntent {
    address user;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 deadline;
    uint256 nonce;
    uint256 chainId;
    bytes32 encryptedMinOutCommitment;
}
```

Why commitment instead of raw encrypted handle in the signed struct:

- signatures should bind the user to a stable public digest
- encrypted handles are runtime objects and should be treated carefully

### 2. New confidential settlement contract

Add a dedicated contract:

- `packages/contracts/contracts/fhenix/ConfidentialIntentEscrow.sol`

Responsibilities:

- receive / lock user funds
- store encrypted threshold input
- store encrypted comparison result
- request decryption
- finalize success or refund path later

This contract should not try to be a trivial edit of RouterHub.

### 3. Optional executor helper

Add a narrow execution helper:

- `packages/contracts/contracts/fhenix/ConfidentialExecutionRouter.sol`

Responsibilities:

- call whitelisted adapter
- capture public `grossOut`
- convert public output into encrypted comparable form
- store result in escrow contract

This keeps settlement concerns separate from routing concerns.

## Recommended Flow

### Transaction A: submit confidential intent

User:

- signs normal gasless authorization for sponsorship
- sends encrypted `minOut`
- relayer or frontend stores the confidential intent

Contract:

- locks funds
- stores encrypted threshold with `FHE.allowThis(...)`
- grants user access with `FHE.allowSender(...)` or `FHE.allow(...)`

### Transaction B: execute swap

Relayer:

- sponsors the execution with ERC-4337
- calls the adapter / routing path

Contract:

- obtains public `grossOut`
- converts `grossOut` to encrypted form
- computes encrypted `isSatisfied = FHE.gte(encGrossOut, encMinOut)`
- stores the encrypted verdict

### Transaction C: request decryption

Relayer or user:

- calls `FHE.decrypt(encryptedVerdict)`

### Transaction D: finalize

Relayer or user:

- reads `FHE.getDecryptResultSafe(...)`
- if success: release output and distribute fee
- if failure: refund according to protocol rules

## UX Consequence

The confidential path will feel different from the current swap:

- it is no longer a one-click immediate settlement flow
- it becomes a staged flow
- user may see statuses like:
  - encrypting threshold
  - sponsored execution in progress
  - decrypting verdict
  - finalizing settlement

For a buildathon demo, that is acceptable.

For the main production path, the current public gasless flow should remain available.

## Backend / Relayer Changes

The relayer in [backend/phase2-relayer.mjs](../backend/phase2-relayer.mjs) should keep fee sponsorship logic, but the confidential path needs new endpoints:

- `POST /api/confidential/quote`
- `POST /api/confidential/submit`
- `POST /api/confidential/execute`
- `POST /api/confidential/finalize`
- `GET /api/confidential/status/:intentId`

Responsibilities:

- sponsor ERC-4337 execution
- track confidential settlement state machine
- surface decryption / finalization status to frontend
- persist confidential intent lifecycle in history storage

## Frontend Changes

Add a dedicated hook:

- `frontend/src/hooks/useConfidentialIntentGasless.js`

Responsibilities:

- encrypt confidential inputs in the browser
- submit public metadata + encrypted payload
- poll confidential execution status
- present the staged UX

This should be a new mode, not a mutation of the existing public gasless hook.

## Recommended Mode Names

Keep the product honest with explicit labels:

- `ZeroToll Gasless`: current ERC-4337 public execution
- `Smart Wallet Batch`: wallet-native batch mode
- `Confidential Gasless Intent`: Fhenix buildathon mode
- `Custom EIP-7702`: experimental embedded-wallet path

## Risks

### 1. More transactions

True confidentiality introduces a staged settlement model.

### 2. More complex failure handling

If the verdict is false, refund logic must be explicit and fair.

### 3. Higher implementation complexity

Contracts, relayer, frontend, and history tracking all change.

### 4. Demo-only temptation

The team should avoid fake privacy where the encrypted field does not actually affect settlement behavior.

## Strong Recommendation

Do **not** rewrite the existing RouterHub path first.

Instead:

1. keep the existing public gasless flow intact
2. add a new Fhenix-only confidential mode
3. make the buildathon MVP an escrowed confidential settlement path

This gives ZeroToll:

- a working production gasless product
- a real privacy-native buildathon story
- a controlled way to iterate without breaking the current UX

## Immediate Build Order

1. Add the design primitives:
   - `ConfidentialIntentLib.sol`
   - `ConfidentialIntentEscrow.sol`
2. Add one confidential field:
   - encrypted `minOut`
3. Add relayer status machine for submit / execute / finalize
4. Add frontend confidential mode
5. Demo the full staged flow on a supported Fhenix environment

## Current Implementation Status

The repo now has a first staged runtime scaffold for this path:

- FHE-native contracts exist in `packages/contracts/contracts/fhenix/`
- frontend now uses `@cofhe/sdk` on Sepolia to encrypt `minOut` client-side before submission
- backend lifecycle routes now exist at:
  - `POST /api/confidential/quote`
  - `POST /api/confidential/submit`
  - `POST /api/confidential/execute`
  - `POST /api/confidential/finalize`
  - `GET /api/confidential/status/:intentId`
- frontend now has `useConfidentialIntentGasless.js`
- the Swap UI exposes a separate **Confidential Gasless Intent** mode
- shared config now has a `confidentialIntentEscrow` slot and the contracts package has a deploy script for it
- `ConfidentialIntentEscrow` is now deployed on Sepolia and synced into shared config
- the active backend can now attempt a live on-chain submit into `ConfidentialIntentEscrow` through the contract's plaintext testing helper
- the active frontend now redirects ERC-20 approval for confidential mode to the escrow contract when the live contract path is enabled
- for `same-token` confidential demos on Sepolia, the active backend can now drive the full escrow lifecycle on-chain:
  - submit
  - release input
  - return same-token funds to escrow
  - record execution result
  - request decryption
  - finalize on-chain
- for `cross-token` confidential demos on Sepolia, the active backend can now drive a live **inventory-backed** escrow lifecycle on-chain when the operator has enough `tokenOut` inventory:
  - submit
  - release `tokenIn`
  - fund escrow with operator-held `tokenOut`
  - record execution result
  - request decryption
  - finalize on-chain
- for `cross-token` confidential demos where both tokens are standard testnet assets, the active backend can now drive a live **adapter-backed** escrow lifecycle through `MockDEXAdapter`:
  - live proof: `USDC -> WETH`
  - direct adapter swap tx: `0xca8b5c70e6e3e8108a5e6f79f3b7010e8fc523e8ccbed8c398fab441fa4e5d44`
- for `cross-token` confidential demos where both tokens are zTokens, the active backend can now drive a live **adapter-backed** escrow lifecycle through `ZeroTollAdapter`:
  - live proof: `zUSDC -> zETH`
  - direct adapter swap tx: `0xd72a6a4b53ff695195d0afdb0784e8edb6fc43b79d6c0d256f8689de4ab8cabf`
- the contracts package now includes a one-shot prep script for Sepolia confidential demos:
  - `packages/contracts/scripts/prepare-confidential-demo-sepolia.js`
  - current live prep change: `ZeroTollAdapter.maxPriceAge` was relaxed to `604800` on Sepolia via tx `0xfb125d70def1fc71993d53007a6321f948a96a557181cbf0050aa1d78a027b30`

What is still intentionally unfinished:

- CoFHE browser encryption is only wired for Sepolia right now
- the live app does not yet send the real encrypted `InEuint128` payload into the live contract path
- the confidential live path still needs one ERC-20 approval to `ConfidentialIntentEscrow`, because the contract currently uses `transferFrom`-based escrow funding
- mixed regular-token <-> zToken paths are still inventory-backed/hybrid; they are not yet routed through a single live adapter execution path
- the direct adapter-backed path is still demo-grade testnet routing:
  - standard-token pairs currently go through `MockDEXAdapter`
  - zToken pairs currently go through `ZeroTollAdapter`
  - neither path should be marketed as production-ready confidential liquidity routing yet

This means the product is now honest in both directions:

- the confidential mode is now real enough to demonstrate staged lifecycle UX, real browser-side encryption on Sepolia, a live escrow submit path, a fully on-chain `same-token` demo lifecycle, a fully on-chain `cross-token inventory-backed` demo lifecycle, and two fully on-chain **adapter-backed** cross-token demos
- but it does **not** yet claim that the live frontend/backend path is already enforcing `minOut` with Fhenix end-to-end on-chain

## Bottom Line

Direct Fhenix integration makes ZeroToll more powerful, but it also changes the architecture.

The biggest change is not fee logic.
It is this:

- **confidential threshold enforcement pushes ZeroToll toward staged settlement**

That is why the correct design is a **new confidential execution path**, not a cosmetic patch to the existing public router.

## Detailed Product Plan: Same-Address True Gasless UX

The next major design question is not only how to support confidentiality, but how to preserve the UX that mainstream users actually expect:

- keep using the same wallet address they already know
- avoid asking them to hold native gas first
- avoid forcing them into a separate smart-account address
- let ZeroToll sponsor execution and recover cost from token flow

This section describes the concrete plan for that model.

## Core Principle

ZeroToll should separate three concerns that are often mixed together:

- **authorization standard**
- **execution engine**
- **fee recovery model**

Those are not the same thing.

### 1. Authorization standard

This determines how the protocol gets permission to move user tokens.

Examples:

- `ERC-2612 permit`
- `EIP-3009 receiveWithAuthorization`
- `Permit2`
- plain ERC-20 `approve`

### 2. Execution engine

This determines how the transaction is submitted and who pays gas up front.

Examples:

- direct relayer transaction
- `ERC-4337` smart-account execution
- `EIP-7702` delegated smart-EOA execution

### 3. Fee recovery model

This determines how ZeroToll gets paid back after sponsoring execution.

The intended ZeroToll model is:

- ZeroToll sponsors the actual native gas cost
- ZeroToll then recovers:
  - `actual sponsored gas cost`
  - plus `5% service fee on the sponsored gas cost`
- the deduction is taken from the user token flow, ideally from output before final delivery

That means the economic formula should converge toward:

```text
totalFee = actualSponsoredGasCostInSettlementToken * 1.05
netUserOutput = grossOutput - totalFee
```

This is the cleanest expression of the protocol's business model.

## Why Approval Is Not Caused by ERC-4337

It is important to be explicit here:

- `ERC-4337` does **not** create the approval problem
- the approval problem comes from standard ERC-20 allowance mechanics

If a token only supports:

- `approve(spender, amount)`
- followed by `transferFrom(...)`

then some allowance-granting action must exist somewhere in the flow.

What `ERC-4337` changes is:

- who pays gas
- whether multiple actions can be batched atomically
- whether the user has to manually send a standalone approval transaction

So the right framing is:

- approval exists because of the token authorization model
- `ERC-4337` and `EIP-7702` are tools to make that approval invisible or sponsored

## Role of EIP-712

`EIP-712` is not a gasless mechanism by itself.

It is the structured-signature format used by multiple gasless-friendly systems:

- `ERC-2612`
- `EIP-3009`
- `Permit2`
- ZeroToll intents

So in ZeroToll's architecture:

- `EIP-712` is the signing language
- `ERC-2612` / `EIP-3009` / `Permit2` define what the signature authorizes
- `ERC-4337` / `EIP-7702` define how sponsored execution happens

## Token-Lane Decision Matrix

ZeroToll should not force every token through the same flow. The correct product architecture is lane-based.

### Lane A: Signature-native zTokens

Tokens:

- `zUSDC`
- `zETH`
- `zPOL`
- `zLINK`

Authorization:

- `ERC-2612`

User address model:

- same EOA address

Execution:

- ZeroToll-sponsored relayer flow today
- can also be sponsored through `ERC-4337` or `EIP-7702` later if useful

Gasless quality:

- **true gasless from step zero**

Why this lane matters:

- it already matches the best possible UX story
- it proves ZeroToll's gasless economics without any approval caveat

Recommendation:

- keep these tokens as the flagship true-gasless lane

### Lane B: USDC lane

Token:

- `USDC`

Current state:

- currently routed through `Permit2`

Problem:

- `Permit2` still needs a one-time on-chain approval to the Permit2 contract
- that means the first use is not truly gasless

Target design:

- prefer `EIP-3009 receiveWithAuthorization` if the deployed token implementation supports it

User address model:

- same EOA address

Execution:

- ZeroToll relayer submits the authorized transfer and sponsors gas

Gasless quality:

- **true gasless from step zero**, if `EIP-3009` is supported on the actual deployed token

Fallback:

- if `EIP-3009` is unavailable on the target deployment, use the generic-token lane below

Recommendation:

- make `USDC` a dedicated lane instead of treating it as just another Permit2 token

### Lane C: Generic ERC-20 lane

Tokens:

- `WETH`
- `LINK`
- `PYUSD`
- any token without `ERC-2612` or `EIP-3009`

Authorization:

- standard ERC-20 approval semantics

Constraint:

- an ordinary EOA cannot magically create allowance by signature if the token itself does not support that pattern

Correct solution:

- use `EIP-7702` delegated smart-EOA execution

Why `EIP-7702` is especially important:

- the user keeps the **same address**
- assets do not move into a separate smart-account address
- ZeroToll can batch:
  - `approve`
  - `swap / submit / execute`
  - optional cleanup or allowance reset
- ZeroToll can sponsor the entire transaction

Gasless quality:

- **true gasless from the user's perspective**
- even though approval still happens on-chain inside the sponsored batch

This is exactly the right answer for the "user wants to keep the same EOA" requirement.

Recommendation:

- this should become the default lane for ordinary ERC-20 tokens that lack signature-native authorization

### Lane D: Permit2 compatibility lane

Tokens:

- tokens currently tagged as `permit2`

Use case:

- short-term compatibility layer
- fallback for wallets / routes not yet using the preferred lane

Problem:

- first use still costs the user gas because of the Permit2 approval transaction

Recommendation:

- keep Permit2 only as a compatibility fallback
- do **not** present it as the final true-gasless architecture

## Execution Matrix

### Best available execution per lane

#### zToken lane

- sign `ERC-2612 permit`
- sign ZeroToll intent
- ZeroToll sponsors execution
- recover fee from token flow

#### USDC lane

- sign `EIP-3009` authorization if supported
- sign ZeroToll intent
- ZeroToll sponsors execution
- recover fee from output or other selected settlement token

#### Generic token lane

- user enables smart-account behavior on the same EOA through `EIP-7702`
- ZeroToll batches `approve + execute`
- ZeroToll sponsors the batch
- recover fee from token flow

## Product-Level Recommendation

ZeroToll should present the lanes honestly to users:

### Best UX lane

- `zUSDC`, `zETH`, `zPOL`, `zLINK`
- no setup gas
- signature-first
- true gasless from first use

### Mainstream stablecoin lane

- `USDC`
- move from Permit2-first toward `EIP-3009` if available
- otherwise upgrade to same-address smart-EOA path

### Generic token lane

- use `EIP-7702`
- same address
- sponsored batch execution

### Compatibility lane

- Permit2 remains available, but only as a fallback

## Fee Recovery Model

The user requirement is clear:

- ZeroToll should sponsor all gas-bearing steps
- the user should not need native gas
- ZeroToll should recover cost from received token flow

The recommended accounting model is:

### 1. Estimate sponsorship ex ante

At quote time:

- estimate gas cost conservatively
- convert to fee token or output token equivalent
- display a maximum expected sponsored cost

### 2. Measure sponsorship ex post

At settlement time:

- use actual gas consumed and actual gas price paid by ZeroToll
- convert that actual sponsored cost into the settlement token

### 3. Apply service fee

Protocol fee:

- `5% of actual sponsored gas cost`

### 4. Final deduction

Deduct from output where possible:

- `actual sponsored gas cost`
- plus `5% service fee`

This keeps the user promise simple:

- ZeroToll fronts gas
- user repays sponsored cost from token flow
- ZeroToll earns a clear service margin on top

## Recommended Near-Term Build Order

1. Keep `ERC-2612` zToken lane as the flagship true-gasless path.
2. Investigate whether the deployed `USDC` token on target networks supports `EIP-3009`.
3. If yes, implement a dedicated `USDC` authorization lane using `receiveWithAuthorization`.
4. Upgrade the generic-token path toward same-address `EIP-7702` sponsored batching.
5. Demote Permit2 from primary product story to fallback compatibility layer.
6. Keep fee recovery in token flow and move toward actual-cost-based post-settlement accounting.

## Final Recommendation

For ZeroToll's long-term UX, the right answer is **not** "everything through Permit2" and **not** "force everyone into a new smart-account address."

The right answer is:

- use **signature-native authorization** when the token supports it
- use **same-address `EIP-7702` smart-EOA execution** for generic tokens
- recover sponsored gas plus a small explicit protocol fee from token flow

That combination is the strongest path toward a product that feels familiar to mainstream EOA users while still being honestly and technically gasless.
