# ZeroToll Fhenix Direct Integration

Updated: 2026-04-03

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

## Confidential Architecture Decision Memo

This section answers the practical question:

- which architecture has the lowest risk
- which architecture is strongest in front of Fhenix judges
- which architecture is most likely to cause ZeroToll to fail

## Short Answer

The best choice for ZeroToll is:

- keep the **public gasless lane** fully ZeroToll-native
- rebuild the **confidential lane** directly on top of Fhenix / CoFHE
- do **not** use Reineira as the core architecture for the main demo path

This is the lowest-risk path that still gives the strongest Fhenix-native story.

## Option A: Full Custom CoFHE Confidential Lane

### Description

ZeroToll keeps its own:

- product UX
- relayer
- fee recovery logic
- token economics
- routing logic

And rebuilds only the confidential lane using:

- `@cofhe/sdk`
- Fhenix encrypted input types
- Fhenix permits
- `decryptForView`
- encrypted settlement state in ZeroToll-owned contracts

### Why this is strong

- it shows real use of the official Fhenix stack
- the confidential feature remains clearly a **ZeroToll feature**
- the demo narrative is clean:
  - ZeroToll already solves gasless execution
  - Fhenix adds confidential execution

### Main risks

- engineering complexity is higher than a plug-in integration
- privacy mistakes are easy if the contract still emits plaintext metadata
- recipient privacy is hard if funds are ultimately delivered to the same public EOA

### Judge fit

This option is the strongest for Fhenix judges because the privacy layer is visibly built on Fhenix primitives rather than outsourced to a separate settlement framework.

## Option B: Reineira-Powered Confidential Lane

### Description

ZeroToll uses `@reineira-os/sdk` and ReineiraOS as the confidential settlement substrate, while ZeroToll keeps its public swap lane and gasless execution lane.

### Why this is attractive

- lower implementation complexity for confidential settlement
- stronger default confidentiality model
- more complete operator / gate / escrow abstraction out of the box

### Main risks

- the product story becomes less clearly "ZeroToll built on Fhenix"
- judges may see the confidential architecture as primarily a Reineira integration
- ZeroToll loses some control over settlement semantics, fee flow, and roadmap timing

### Judge fit

This can still be impressive, but it is weaker than direct CoFHE integration if the judges are specifically evaluating how well ZeroToll itself used Fhenix.

## Option C: Recommended Hybrid

### Description

This is the recommended target architecture for the demo:

- public lane: ZeroToll-native
- confidential lane: direct Fhenix / CoFHE
- Reineira: optional reference architecture, not the core demo dependency

### Why this is the best balance

- lower risk than rewriting the whole product
- stronger judge story than delegating privacy to a third-party settlement SDK
- preserves the parts ZeroToll already does well:
  - ERC-4337 sponsorship
  - any-token fee recovery
  - multichain routing
  - native-output delivery

### Product story

The cleanest message is:

- **ZeroToll is the gasless execution engine**
- **Fhenix is the confidentiality engine**

That framing is easy to defend and easy for judges to remember.

## Which Architecture Is Most Likely To Fail

The highest-risk architecture is the current half-migrated hybrid:

- client-side encryption exists
- but plaintext testing helpers still drive live submission
- user addresses remain public
- output is still delivered directly to the main EOA

This is the worst of both worlds:

- too complex to claim "simple public flow"
- not private enough to claim "real confidential settlement"

If left in place, it creates three failure modes:

### 1. Privacy failure

Judges or users inspect explorers and discover:

- user address is still public
- events still expose counterparties
- state diffs still reveal the receiving wallet

### 2. Credibility failure

The product appears to use Fhenix, but only partially:

- encryption is performed
- but plaintext fallback still determines execution

That weakens the technical story significantly.

### 3. Product failure

The team spends time carrying both:

- a custom public execution engine
- and a fragile scaffold confidential engine

without getting a fully convincing privacy outcome.

## Recommended Demo Scope For Fhenix Judges

For a judge-facing demo, the must-have scope should be:

### Must-have

- a working public ZeroToll gasless lane
- a separate working confidential lane powered directly by Fhenix / CoFHE
- honest privacy boundaries
- no plaintext testing fallback in the confidential submission path

### Nice-to-have

- private recipient design
- stealth or claim-based withdrawal
- encrypted counterparty identities
- richer permit-based client decryption UX

### Avoid for the demo

- full protocol rewrite
- replacing all ZeroToll settlement with Reineira
- claiming "fully private" if recipient identity still lands on a public EOA

## Final Decision

If the goal is:

- lowest delivery risk
- strongest positioning with Fhenix judges
- highest chance of a convincing ZeroToll demo

then the decision should be:

- **keep ZeroToll's public lane**
- **rebuild the confidential lane directly with Fhenix / CoFHE**
- **treat Reineira as inspiration or an optional future integration, not the main architecture for the judging demo**

That is the most defensible strategy both technically and narratively.

## Implementation Checklist

This section turns the architecture decision into an execution plan.

The goal is to keep the confidential lane small enough to finish, while still making it credible in front of judges.

## Before Judging: Must Fix

These items should be treated as blocking work for a Fhenix-facing demo.

### 1. Remove plaintext testing fallback from the live confidential submission path

Current risk:

- the frontend encrypts `minOut`
- but the live backend path still sends `plaintextMinOutForTesting`
- live submission still goes through testing helper functions

Required outcome:

- confidential submission must use encrypted inputs as the source of truth
- the live path should no longer depend on plaintext fallback values

Concrete work:

- remove `plaintextMinOutForTesting` from the production confidential flow
- stop routing live submissions through testing helper contract methods
- make encrypted payload handling the only accepted production path

### 2. Tighten the privacy claim on the product surface

Current risk:

- the app can currently be interpreted as promising stronger privacy than it really provides

Required outcome:

- all user-facing copy should clearly say what is private and what is not

Concrete work:

- describe the lane as protecting confidential execution parameters
- avoid claiming full recipient anonymity
- explain that the first production milestone is private threshold and private settlement logic

### 3. Separate demo-safe confidentiality from aspirational full privacy

Current risk:

- judges may inspect explorers and find user addresses
- this can look like a contradiction if the narrative is too broad

Required outcome:

- the demo should explicitly distinguish:
  - private execution constraints
  - private counterparties and private recipient delivery

Concrete work:

- script the demo around confidentiality of execution terms
- present hidden recipient identity as a next-phase milestone

### 4. Stop exposing unnecessary plaintext metadata in the confidential path

Current risk:

- `user` is currently stored in plaintext
- events expose the user
- settlement summary returns the full intent publicly

Required outcome:

- reduce plaintext leakage wherever possible without destabilizing the demo

Concrete work:

- remove or minimize publicly exposed user fields from events if the demo can tolerate it
- avoid public getters that return the full intent unless strictly required
- review backend persistence and logs for unnecessary user-address storage

### 5. Keep the public lane stable while confidential work is landing

Current risk:

- over-rotating into confidential work can break the already-working public demo path

Required outcome:

- public gasless swaps remain a reliable fallback and credibility anchor

Concrete work:

- freeze working 4337 public flow behavior unless a bug is critical
- treat the public lane as a stable baseline for the judge demo

## After Judging: High-Value Next Steps

These items matter a lot, but they should not block the initial Fhenix demo if time is tight.

### 1. Private recipient design

This is the largest privacy gap in the current model.

Target outcome:

- do not deliver confidential output directly to the same public EOA

Potential approaches:

- stealth address delivery
- claim-note redemption
- one-time destination address
- encrypted recipient commitment

### 2. Replace plaintext user identity in the intent model

Target outcome:

- avoid using `address user` as a public first-class field in the confidential intent

Potential approaches:

- encrypted address
- recipient commitment
- operator-known but publicly hidden withdrawal handle

### 3. Shift decryption UX to permit-based local reveal

Target outcome:

- use `decryptForView` and permit-based viewing wherever the output only needs to be shown to the user

Why it matters:

- it keeps more sensitive information off-chain
- it aligns better with the Fhenix model

### 4. Explore whether Reineira can accelerate the private recipient phase

This should be evaluated as an optional follow-up, not as the main demo dependency.

Target outcome:

- learn from Reineira's escrow and gate patterns without replacing ZeroToll's core public architecture

## Workstream Breakdown

The safest way to execute this plan is to split it into three workstreams.

### Workstream A: Frontend

Scope:

- remove production reliance on plaintext confidential fallback fields
- make confidential UI messaging precise
- improve status messaging around encrypted submission and decryption flow

Success criteria:

- the user signs encrypted confidential intent inputs
- the UI can explain exactly what is protected

### Workstream B: Backend / Relayer

Scope:

- stop accepting confidential production submissions that depend on testing-only pathways
- normalize encrypted payload validation
- reduce plaintext logging of confidential submissions

Success criteria:

- production confidential requests are clearly separated from scaffold or testing requests
- backend responses reflect real confidential state, not placeholder status language

### Workstream C: Contracts

Scope:

- move confidential production calls away from testing helper methods
- reduce public metadata exposure in events and getters where practical
- prepare a cleaner recipient abstraction for phase two

Success criteria:

- the contract path used in the demo is genuinely the intended confidential production path
- the contract no longer relies on plaintext-only shortcuts for its core confidential logic

## Suggested Delivery Order

The safest order is:

1. Lock the public lane and do not destabilize it.
2. Remove plaintext fallback from the confidential path.
3. Update product messaging so privacy claims are exact.
4. Reduce obvious plaintext leakage from confidential events and getters where feasible.
5. Prepare a post-demo plan for private recipient delivery.

## Demo Readiness Definition

ZeroToll should consider the Fhenix demo "ready" when all of the following are true:

- public gasless swaps work reliably
- confidential submission uses encrypted inputs without plaintext production fallback
- the demo story is honest about what is private
- the team can explain why recipient privacy is not yet complete and how phase two solves it
- judges can clearly see that Fhenix is a real execution component, not just branding on top of a scaffold

## Final Delivery Principle

The correct strategy is not to overclaim.

The strongest judge outcome will come from showing:

- a working product
- a real Fhenix-powered confidential lane
- a precise explanation of current privacy guarantees
- a believable roadmap toward deeper privacy

That is more persuasive than promising full privacy while still leaking counterparties and payout destinations on-chain.

## Technical TODO By Module

This section translates the workstreams into concrete engineering targets.

The intention is to make implementation sequencing obvious and to minimize accidental regression in the already-working public lane.

## Frontend Modules

### `frontend/src/lib/cofhe.js`

Role:

- CoFHE client bootstrap
- input encryption helper

Current problem:

- the module currently encrypts only `uint128 minOut`
- it does not yet drive a full encrypted submission pipeline

Must-do:

- keep this file as the canonical place for Fhenix client setup
- extend it to support any additional encrypted payload types needed by the confidential lane
- add helper methods for production-safe encrypted input serialization

Nice-to-have later:

- permit-aware view decryption helpers
- support for encrypted recipient or encrypted withdrawal handle formats if phase two adopts them

### `frontend/src/hooks/useConfidentialIntentGasless.js`

Role:

- quote
- encrypt
- sign funding
- submit confidential intent
- execute/finalize status orchestration

Current problem:

- it still sends `plaintextMinOutForTesting`
- it still packages confidential submission as a hybrid scaffold

Must-do:

- remove `plaintextMinOutForTesting` from production requests
- separate production confidential mode from any local test mode
- ensure only encrypted production payloads are used when the confidential lane is enabled
- update status text so the user sees exact privacy guarantees

Nice-to-have later:

- support local `decryptForView` UX for verdicts or private view data
- support claim-based payout UX if a private recipient model is introduced

### `frontend/src/pages/Swap.jsx`

Role:

- top-level UX for public vs confidential execution

Current problem:

- users can infer stronger privacy guarantees than the current implementation actually provides

Must-do:

- revise confidential copy so it describes protected execution terms rather than full anonymity
- make lane differences explicit:
  - public gasless
  - confidential execution

Nice-to-have later:

- richer educational UI explaining what is hidden and what still remains public on-chain

## Backend Modules

### `backend/routes/confidential.py`

Role:

- confidential quote
- confidential submit
- confidential execute/finalize orchestration
- backend status persistence

Current problem:

- the route still accepts and stores plaintext-heavy fields
- it still bridges production flow into testing-helper contract methods

Must-do:

- split testing-only behavior from production behavior
- reject production confidential submissions that still rely on plaintext fallback
- reduce persistent storage of plaintext confidential metadata wherever possible
- make response labels honest and production-oriented rather than scaffold-oriented

Nice-to-have later:

- define a stricter confidential request schema for production mode
- reduce or hash any user-identifying backend persistence that is not strictly required

### `backend/confidential_contract.py`

Role:

- ABI binding
- contract submission helpers
- execution/finalization helpers

Current problem:

- the active helper set is centered on:
  - `submitIntentWithPlaintextMinOutForTesting`
  - `submitIntentWithPermit2ForTesting`
  - `submitIntentWithPermitForTesting`

Must-do:

- add production-grade contract call helpers for true encrypted-input submission
- demote testing helper methods so they cannot be confused with live confidential settlement
- align ABI usage with the actual production confidential path

Nice-to-have later:

- support cleaner confidential claim / redemption flows once the contract supports them

### `backend/server.py`

Role:

- general API surface
- public relayer proxy

Current problem:

- not a core privacy blocker, but it must stay stable while confidential work lands

Must-do:

- leave public-gasless behavior stable unless a bug is critical
- keep confidential routing and public routing clearly separated

## Contract Modules

### `packages/contracts/contracts/fhenix/ConfidentialIntentLib.sol`

Role:

- confidential intent model and hashing

Current problem:

- the struct still uses `address user`
- the hash still commits plaintext user identity directly

Must-do:

- decide whether the pre-judging version still keeps public user identity or moves to a more privacy-preserving commitment model
- if public identity remains for demo scope, document that decision clearly

Nice-to-have later:

- replace plaintext `user` with encrypted or commitment-based identity representation

### `packages/contracts/contracts/fhenix/ConfidentialIntentEscrow.sol`

Role:

- confidential settlement state machine
- encrypted threshold check
- release / execute / finalize lifecycle

Current problem:

- it exposes plaintext metadata in events
- it sends funds directly to the public user EOA
- it includes production-looking methods that are actually testing helpers

Must-do:

- define a clean production submission method that accepts the intended encrypted input path
- reduce or remove public metadata exposure where feasible for the demo scope
- make testing helper methods clearly non-production, or isolate them away from demo flow

Nice-to-have later:

- redesign final delivery so confidential outputs are not sent directly to the main public EOA
- add a private claim or stealth-destination pattern

### `packages/contracts/scripts/*confidential*`

Role:

- deploy and configure confidential infrastructure

Current problem:

- deploy/config scripts currently support the scaffold architecture, but they do not yet enforce production-safe confidentiality guarantees

Must-do:

- add deployment and configuration scripts for the production confidential path once contract changes land
- keep trusted operator setup explicit and reproducible

## Non-Blocking Supporting Work

These tasks matter, but they should not be allowed to derail the Fhenix demo:

- homepage copy refinements around confidentiality wording
- optional Reineira exploration
- full private recipient research
- post-demo architecture cleanup for persistence and observability

## Engineering Priority Map

### Priority 0

- do not break public 4337 swaps

### Priority 1

- remove plaintext fallback from confidential production flow
- stop demoing testing-helper contract calls as if they were the final architecture

### Priority 2

- tighten privacy messaging in the UI and documentation
- reduce obvious plaintext leakage in events, getters, and backend persistence where feasible

### Priority 3

- design phase-two recipient privacy
- evaluate whether any Reineira patterns should be adopted after the demo

## Recommended Immediate Next Coding Sprint

The next sprint should focus only on these concrete deliverables:

1. Frontend confidential submit path no longer includes `plaintextMinOutForTesting` in production mode.
2. Backend confidential route refuses production requests that rely on testing-only fallback fields.
3. Contract/helper layer exposes a clearly named production submission path distinct from testing helpers.
4. Confidential UI copy and demo script are updated to reflect exact privacy guarantees.

If those four items land cleanly, ZeroToll will have a much more defensible Fhenix demo even before phase-two private recipient work begins.

## Post-Hackathon Feedback and Next Thesis

Judge feedback:

- "the gasless tx is a cool competitive edge"
- "strong integration so far"
- "would recommend exploring fherc20 for future developments"

This is encouraging feedback, not a rejection of the core ZeroToll thesis.

The judges did not say the gasless architecture was weak.
They explicitly highlighted gasless execution as a competitive edge.

The likely gap was different:

- ZeroToll already looked like a strong gasless execution product
- the Fhenix integration looked real, but not yet central enough to the product identity
- the privacy story was stronger at the intent / threshold layer than at the asset layer

In other words:

- ZeroToll looked like a good gasless protocol with confidential features
- it did not yet look like the best possible showcase of Fhenix-native private assets

That is exactly why the FHERC20 recommendation matters.

## What FHERC20 Changes

Official FHERC20 documentation:

- https://cofhe-docs.fhenix.zone/docs/devdocs/fherc/fherc20
- https://docs.redact.money/architecture/fherc20.sol
- https://docs.redact.money/architecture/confidentialerc20.sol

The official FHERC20 model introduces several ideas that are directly relevant for ZeroToll:

- balances are stored as encrypted values (`euint128`)
- standard ERC20 allowance flows are intentionally removed
- delegated token movement uses EIP-712 permit-style authorization instead of traditional allowances
- public wallet and explorer compatibility is preserved using "indicated balances" rather than true plaintext balances
- wrapped confidential assets can be created from existing ERC20s through ConfidentialERC20-style wrappers

This is important for ZeroToll because it aligns naturally with the product's strongest existing advantage:

- ZeroToll already sponsors gas
- ZeroToll already orchestrates delegated execution
- ZeroToll already supports signed authorization lanes

FHERC20 therefore does not fight the ZeroToll architecture.
It reinforces it.

## Why The Judge Comment Makes Sense

The current confidential lane in ZeroToll focused on:

- encrypted `minOut`
- encrypted threshold / verdict logic
- escrow-based settlement orchestration

That is meaningful, but it is still privacy around execution conditions.

FHERC20 pushes the privacy story one layer deeper:

- the asset itself becomes private
- balances become private
- transfer values become private
- allowance leakage is replaced by single-use signed permissions

For a Fhenix judge, this makes the product feel much more natively aligned with the ecosystem thesis.

The message becomes:

- not just "we used FHE somewhere in settlement"
- but "ZeroToll is the gasless execution layer for private Fhenix-native assets"

That is a much stronger identity.

## Lowest-Risk Architecture For ZeroToll

The lowest-risk path is not a full rewrite.

The lowest-risk path is:

- keep the public ZeroToll lane stable
- keep the gasless 4337 / fee-sponsorship engine as the core product edge
- add a dedicated FHERC20 lane as the next confidential product surface

This means:

### Keep unchanged

- public gasless swaps
- Permit2 flow for legacy ERC20s
- ERC-2612 flow for normal tokens where useful
- treasury and fee skim logic
- multichain routing roadmap

### Add next

- Sepolia-only FHERC20 / ConfidentialERC20 lane
- gasless sponsor flow for private-asset swaps
- fee payment from private or semi-private output path
- clearer privacy scope in UI and docs

This is lower risk than rebuilding all of ZeroToll around a new framework.

It is also stronger than outsourcing the privacy story to a third-party settlement abstraction.

## Recommended Product Positioning

The next-version pitch should shift from:

- "ZeroToll is a gasless multichain swap with confidential intent"

to:

- "ZeroToll is a gasless execution layer for FHERC20 and confidential asset flows"

That framing keeps the strongest existing differentiator:

- gasless execution

while making the Fhenix-specific value unmistakable:

- private assets
- encrypted transfers
- permit-style delegated movement
- private balance-aware UX

## Recommended FHERC20 Roadmap

### Phase 0: Preserve the Winning Core

Do not destabilize the strongest working components:

- public 4337 gasless path
- fee sponsorship
- relayer + paymaster logic
- exact-amount fee skim accounting

This remains the foundation of ZeroToll's competitive edge.

### Phase 1: Single-Chain FHERC20 MVP

Goal:

- build a Sepolia-only private asset lane that clearly showcases Fhenix-native value

Recommended scope:

- support one wrapped private stable asset, such as confidential USDC-style flow
- support one private-to-public swap path:
  - `eUSDC -> ETH`
  - or `eUSDC -> WETH`
- sponsor the entire execution path with ZeroToll
- deduct sponsored gas cost plus service fee from output value

Why this is a good MVP:

- small enough to finish
- directly aligned with judge feedback
- easier to demo than full multichain private routing
- preserves ZeroToll's strongest gasless story

### Phase 2: Private-to-Private Execution

Goal:

- move from "gasless swap involving one private asset" to "gasless swap across private assets"

Example:

- `eUSDC -> eWETH`
- `eLINK -> eUSDC`

Important implementation implication:

- routing logic must become aware that transfer success and amounts may be represented through encrypted results rather than ordinary ERC20 assumptions
- settlement logic must handle the FHERC20 transfer semantics carefully

### Phase 3: Confidential Pool and Liquidity Story

Goal:

- connect ZeroToll's pool / sponsorship economics with private asset execution

Potential narrative:

- pool providers fund native gas inventory and execution capacity
- ZeroToll earns service fees from private-asset flows
- private flow demand creates a stronger reason to deposit into the native gas pool

This is where ZeroToll becomes more than a swap demo.
It becomes private execution infrastructure with an economic flywheel.

## Concrete Technical Direction

### 1. Add an FHERC20 asset lane instead of replacing the whole token stack

Do not try to convert every existing path immediately.

Instead:

- add one explicit confidential asset lane
- isolate it in routing, quoting, and UI
- keep public and private lanes easy to distinguish

This keeps blast radius low.

### 2. Prefer wrapped confidential assets for the first usable demo

The Redact/ConfidentialERC20 model suggests a practical route:

- wrap existing ERC20s into confidential assets
- operate on the confidential wrapper
- decrypt or claim out only when the product really needs a public output

This is likely more realistic for ZeroToll than inventing a completely custom private token primitive from scratch.

### 3. Keep gasless sponsorship as the product anchor

The important message is not:

- "we also support FHERC20"

The important message is:

- "private assets are actually usable because ZeroToll sponsors execution"

That is where ZeroToll can stand out.

FHERC20 by itself is not the differentiation.
Gasless FHERC20 execution is.

### 4. Avoid claiming full recipient privacy until the payout model changes

Even with FHERC20, ZeroToll should still be careful about privacy claims.

If the final output lands in a standard public EOA, then:

- explorer-visible state changes can still reveal the recipient
- privacy is better than today, but not absolute

The safer framing is:

- private balances
- private transfer amounts
- gasless confidential execution

and later:

- private recipient / stealth claim / private redemption

## Architectures That Could Still Make ZeroToll Fail

### Failure Mode A: Full Rewrite Around Privacy

This is risky because:

- it threatens the strongest working gasless components
- it expands scope too quickly
- it delays a credible second demo cycle

### Failure Mode B: Keep Hybrid Confidential Logic But Ignore FHERC20

This is risky because:

- ZeroToll will continue to look only partially aligned with Fhenix
- privacy will still feel like a sidecar rather than a core asset model
- judges may continue to see stronger ecosystem fit elsewhere

### Failure Mode C: Use FHERC20 Only As Marketing Copy

This is perhaps the most dangerous path.

If ZeroToll says it is building for FHERC20 but does not actually redesign:

- routing assumptions
- fee collection semantics
- permit flow
- output privacy model

then the result will feel superficial.

## Recommended Immediate Build Order

### Sprint 1

- document ZeroToll's next product thesis as "gasless execution for private assets"
- choose the first confidential asset pair
- isolate a single-chain Sepolia FHERC20 MVP path
- define exactly how fees are recovered from output

### Sprint 2

- integrate one FHERC20 or ConfidentialERC20 asset path
- make the swap route sponsorable end-to-end
- add honest UI language around what is private and what is not

### Sprint 3

- tighten explorer-facing privacy leakage
- improve result handling for encrypted transfer outcomes
- build a cleaner claim / redemption story if public output is required

### Sprint 4

- connect the private flow to ZeroToll pool economics
- make the liquidity-provider reward story specific to confidential execution demand

## The Next Judge-Facing Story

The strongest next story is:

- ZeroToll already proved it can make swaps gasless
- the next evolution is making private assets actually usable
- FHERC20 is the right asset standard for that direction
- ZeroToll's role is to remove the gas and UX friction from confidential execution

That is a sharper, more ecosystem-native thesis than the current version.

## Final Recommendation

If the goal is to maximize the chance of stronger judge reception in the next cycle:

- do not abandon the gasless core
- do not over-rotate into a full rewrite
- do not keep confidential logic at the threshold-only layer

Instead:

- make ZeroToll the best gasless execution layer for FHERC20-style private assets

That path is:

- lower risk than a full architecture reset
- more aligned with the actual Fhenix product stack
- more memorable for judges
- and more faithful to ZeroToll's genuine strength

## FHERC20 Implementation Checklist By Module

The goal of this checklist is not to redesign ZeroToll all at once.

The goal is to add one focused FHERC20 lane that:

- preserves the current public gasless architecture
- proves private assets can be used in ZeroToll
- strengthens the Fhenix-native story without exploding scope

## Product Scope For The First FHERC20 MVP

Recommended initial scope:

- single chain: Sepolia
- one private stable asset lane:
  - `eUSDC` or equivalent ConfidentialERC20-style wrapper
- one destination asset:
  - `WETH` first
  - optional `ETH` unwrap as a second step
- gas sponsorship remains handled by ZeroToll
- fee is deducted from output

The first milestone should not attempt:

- multichain private routing
- full private recipient model
- private LP economics
- many private token pairs

## Frontend Modules

### `frontend/src/pages/Swap.jsx`

Role for the FHERC20 MVP:

- expose a dedicated private-asset lane
- clearly distinguish:
  - public gasless
  - confidential intent
  - FHERC20/private-asset execution

Must-do:

- add an explicit private asset mode selector
- label wrapped confidential assets clearly
- show honest privacy copy:
  - private balances
  - private transfer amounts
  - recipient privacy still limited if output settles to a public EOA
- display fee deduction policy for sponsored private execution

Nice-to-have later:

- side-by-side comparison of public vs private execution
- live explanation of what data stays encrypted

### `frontend/src/hooks/useConfidentialIntentGasless.js`

Role for the FHERC20 MVP:

- evolve from threshold-only confidential flow toward private-asset execution orchestration

Must-do:

- split FHERC20/private-asset logic from the current hybrid confidential helper flow
- stop treating all confidential flows as the same product surface
- add runtime capability checks:
  - FHERC20 supported
  - encrypted submit supported
  - private-output claim supported or not

Nice-to-have later:

- separate hook for FHERC20 execution so the current intent hook stays simpler

### `frontend/src/lib/cofhe.js`

Role for the FHERC20 MVP:

- remain the browser encryption gateway

Must-do:

- support any additional encrypted inputs needed by FHERC20 lane
- keep payload serialization stable and explicit
- document which actor the payload is encrypted for:
  - user
  - relayer
  - settlement contract

Nice-to-have later:

- shared utilities for encrypted amount, encrypted recipient commitment, and decrypt-for-view helpers

## Backend Modules

### `backend/routes/confidential.py`

Role for the FHERC20 MVP:

- stop being only an intent-lifecycle route
- become the API surface for private-asset execution capability checks

Must-do:

- define a separate runtime mode for FHERC20/private-asset execution
- avoid mixing:
  - plaintext testing helper
  - encrypted intent path
  - FHERC20 asset path
- return honest capability flags to frontend:
  - `privateAssetLaneReady`
  - `encryptedSubmitReady`
  - `publicRecipientOnly`
  - `privateClaimReady`

Nice-to-have later:

- provide richer explorer-safe status summaries without exposing raw debugging details to the UI

### `backend/confidential_contract.py`

Role for the FHERC20 MVP:

- bind backend execution to Fhenix-native private token contracts

Must-do:

- add ABI bindings for the chosen FHERC20 or ConfidentialERC20 contract
- add helper methods for:
  - encrypt/wrap flow if backend coordination is needed
  - private transfer or claim path
  - sponsored settlement path
- keep testing helpers isolated so they cannot be confused with private-asset production paths

Nice-to-have later:

- support multiple private assets once the first path is stable

### `backend/server.py`

Role for the FHERC20 MVP:

- remain stable while new private lanes are added

Must-do:

- keep public gasless routing untouched unless required
- ensure private-lane routes are versioned or clearly separated
- avoid conflating public metrics with private-lane metrics

## Contract Modules

### `packages/contracts/contracts/fhenix/ConfidentialIntentEscrow.sol`

Role for the FHERC20 MVP:

- continue as confidential settlement state machine if the first private-asset lane still uses escrow orchestration

Must-do:

- define whether FHERC20 execution reuses this escrow or needs a cleaner dedicated contract
- remove ambiguity between:
  - helper testing methods
  - production encrypted methods
- avoid overloading the contract with too many product concepts at once

Recommendation:

- if possible, keep this contract focused on confidential settlement
- add a separate contract for FHERC20-specific flow if the semantics diverge too much

### `packages/contracts/contracts/fhenix/ConfidentialIntentLib.sol`

Role for the FHERC20 MVP:

- likely remains useful for confidential intent hashing, but it may not be sufficient for private-asset execution semantics

Must-do:

- decide whether a private-asset execution intent should have a distinct struct and hash
- avoid forcing FHERC20 execution into a model that assumes public ERC20 behavior

### New FHERC20 / ConfidentialERC20 Integration Contracts

Likely need:

- wrapper integration contract
- private-asset swap adapter
- optional claim/redemption helper

Must-do:

- define the minimal contract surface for the first pair
- document exactly where balances are private and where they become public again
- keep interfaces narrow enough to audit and test quickly

## Test Modules

### `packages/contracts/test/ConfidentialIntentEscrow.test.js`

Role for the FHERC20 MVP:

- remain the regression suite for current confidential escrow behavior

Must-do:

- keep existing coverage intact
- avoid turning this file into a catch-all for unrelated FHERC20 behavior

Recommendation:

- add a separate FHERC20-focused test file once the first private asset contract is introduced

### New FHERC20 Test Files

Must-do:

- test wrap/encrypt path
- test sponsored swap path
- test fee deduction from output
- test failure behavior when output is insufficient after sponsorship
- test privacy-facing event surface so claims in the UI remain honest

## Configuration and Deployment

### `packages/contracts/scripts/*`

Must-do:

- add deployment scripts for the selected private asset lane
- add configuration scripts for:
  - wrapper address
  - private asset adapter
  - trusted operator / submitter
  - output fee recipient

Nice-to-have later:

- one-click environment bootstrap for Sepolia demo deployments

### Shared Config Files

Must-do:

- extend chain config with explicit private-asset capability flags
- do not infer FHERC20 readiness from ordinary confidential readiness
- keep asset registry explicit:
  - public symbol
  - private wrapper symbol
  - underlying asset
  - output capabilities

## First FHERC20 Sprint Plan

### Sprint A: Design Lock

Deliverables:

- choose one private asset pair
- choose one execution pattern
- define fee recovery formula
- define honest privacy scope

Output:

- short design spec
- sequence diagram
- UI copy draft

### Sprint B: Contract MVP

Deliverables:

- deploy one confidential wrapper or integrate an existing one
- implement one swap execution contract or adapter path
- add tests for sponsored execution and output fee deduction

Output:

- one stable Sepolia private-asset route

### Sprint C: Frontend and Demo

Deliverables:

- add private-asset lane to swap UI
- display capability flags and caveats honestly
- produce one end-to-end demo path

Output:

- judge-facing or investor-facing demo flow that is sharper than the previous confidential demo

## Judge-Facing Pitch Rewrite

The next pitch should be simpler and more Fhenix-native.

### One-line product statement

ZeroToll is a gasless execution layer for FHERC20 and confidential asset flows.

### Short version

ZeroToll removes the gas friction from private execution.
Users can move and swap confidential assets without needing native gas upfront, while ZeroToll sponsors execution and recovers fees from settlement.

### Slightly longer version

Most private assets are still hard to use because every action carries execution friction.
ZeroToll solves that by combining sponsored execution with Fhenix-native private assets.
The result is a product where confidential balances and transfers become usable in practice, not just technically possible.

### What to emphasize in the next demo

- gasless remains the competitive edge
- FHERC20 makes the privacy story asset-native
- ZeroToll is not just hiding thresholds
- ZeroToll is making private assets usable

### What to avoid saying

- "fully private everything"
- "private recipients" unless the payout model is actually redesigned
- "production-ready" unless helper paths are gone and explorer leakage is honestly bounded

### Strong closing line

ZeroToll is building the missing execution layer for private assets: sponsored, usable, and designed for real FHERC20 flows.

## FHERC20 Technical TODO By File

This section turns the FHERC20 roadmap into a repo-level execution map.

The goal is to answer:

- which file should change first
- why that file matters
- what "done" looks like for that file

## Priority 0: Product and Config Surface

### `frontend/src/config/contracts.json`

Likely role:

- add addresses for the first FHERC20 or ConfidentialERC20 lane

Must add:

- private wrapper token address
- underlying public token address
- private execution adapter address
- optional private claim / redemption contract address

Done when:

- frontend can distinguish between public and private versions of the same asset without hardcoded ad hoc checks

### `backend/chain_config.json`

Likely role:

- declare runtime capability flags for private-asset execution

Must add:

- `privateAssetLaneReady`
- `privateAssetAdapter`
- `privateClaimReady`
- `publicRecipientOnly`

Done when:

- backend can tell the frontend exactly what the active privacy/runtime guarantees are for the selected chain

### `backend/token_addresses.json`

Likely role:

- register the first private wrapper token symbol and address

Must add:

- canonical symbol for the private wrapper
- underlying mapping if needed for quoting or unwrap semantics

Done when:

- ZeroToll can resolve private and public assets deterministically without hand-maintained UI hacks

## Priority 1: New Contract Surface

### New file: `packages/contracts/contracts/fhenix/ZeroTollPrivateAssetRouter.sol`

Suggested role:

- the first dedicated execution contract for FHERC20-style flows

Why a new contract is recommended:

- avoids overloading `ConfidentialIntentEscrow.sol`
- keeps private-asset semantics isolated
- makes testing and auditing simpler

Responsibilities:

- accept a sponsored swap request for a private asset
- coordinate transfer / claim / unwrap semantics
- calculate and deduct ZeroToll fee from output
- emit a minimal, honest event surface

Done when:

- one end-to-end `private stable -> WETH` or `private stable -> ETH` path can execute through this contract without relying on plaintext helper scaffolding

### Possible supporting file: `packages/contracts/contracts/fhenix/PrivateAssetIntentLib.sol`

Suggested role:

- define a separate intent/hash model for FHERC20 execution if the semantics diverge from the current confidential intent struct

Why it may be needed:

- current `ConfidentialIntentLib.sol` is optimized for threshold-style confidential settlement, not necessarily private-asset routing

Done when:

- the FHERC20 lane no longer has to pretend it is the same product flow as the current confidential threshold lane

### Existing file: `packages/contracts/contracts/fhenix/ConfidentialIntentEscrow.sol`

Must review:

- whether this contract should remain only for threshold-based confidential settlement
- whether any shared logic should be extracted rather than stretched further

Recommended action:

- keep using it for the current confidential lane
- do not force the first FHERC20 lane into this contract unless the semantics are truly compatible

Done when:

- the contract boundary between:
  - confidential intent settlement
  - private-asset routing

  is clear and defensible

## Priority 2: Contract Tests

### New file: `packages/contracts/test/ZeroTollPrivateAssetRouter.test.js`

Must cover:

- private asset funding path
- sponsored execution path
- fee deduction from output
- unwrap-to-ETH path if supported
- failure when output cannot cover sponsored gas + fee
- privacy-facing event expectations

Done when:

- the FHERC20 route has its own regression suite and does not piggyback only on escrow tests

### Existing file: `packages/contracts/test/ConfidentialIntentEscrow.test.js`

Must do:

- keep as a regression suite for current confidential intent behavior
- do not keep expanding it with unrelated private-asset behavior

Done when:

- current confidential tests remain stable and focused

## Priority 3: Backend Integration

### `backend/confidential_contract.py`

New responsibilities for FHERC20 MVP:

- add ABI bindings for the selected private wrapper
- add helper methods for:
  - private asset routing
  - fee deduction accounting
  - unwrap/claim completion

Avoid:

- overloading the current helper set with too many mixed behaviors

Recommended structure:

- keep current confidential escrow helpers
- add a clearly separated section for FHERC20/private-asset helpers

Done when:

- backend code makes a clean distinction between:
  - confidential threshold settlement
  - private-asset execution

### `backend/routes/confidential.py`

Must evolve into:

- runtime capability router, not only intent-lifecycle router

Must add:

- a branch or separate sub-route for the private-asset lane
- explicit response fields describing:
  - private lane readiness
  - funding model
  - fee recovery model
  - output publicity level

Done when:

- frontend can request a quote/status for a private-asset lane without guessing from generic confidential flags

### Possible new file: `backend/routes/private_assets.py`

Recommended if scope grows:

- isolate FHERC20/private-asset routes away from the existing confidential intent route

Benefits:

- reduces confusion
- keeps the current hybrid confidential lane stable
- makes the private-asset roadmap easier to reason about

Done when:

- route ownership is obvious and product surfaces are not blended together

## Priority 4: Frontend Integration

### `frontend/src/pages/Swap.jsx`

Must add:

- explicit asset lane switch:
  - public gasless
  - confidential intent
  - private asset
- asset badges that distinguish:
  - public token
  - confidential/private wrapper
- fee explanation for sponsored private execution

Done when:

- a user can tell which lane they are using without reading internal jargon

### Possible new file: `frontend/src/hooks/usePrivateAssetGasless.js`

Recommended role:

- separate hook for the FHERC20/private-asset lane

Why:

- current `useConfidentialIntentGasless.js` is already responsible for one product surface
- adding FHERC20 logic into the same hook will likely create confusion and brittle branching

Done when:

- FHERC20 flow logic is isolated from threshold-only confidential intent logic

### `frontend/src/lib/cofhe.js`

Must add:

- reusable helpers for private-asset lane encryption inputs
- explicit serialization for any new encrypted amount or permission objects

Done when:

- frontend encryption helpers are shared infrastructure instead of one-off logic for only `minOut`

## Priority 5: Deployment and Operations

### New or updated scripts under `packages/contracts/scripts/`

Need:

- deploy FHERC20 / ConfidentialERC20 wrapper
- deploy private asset router
- configure trusted operator
- configure fee recipient
- configure supported pair metadata

Done when:

- Sepolia private-asset lane can be redeployed from scripts, not hand-configured state

### Optional new doc: `docs/ZEROTOLL_FHERC20_MVP_PLAN.md`

Recommended role:

- keep the future implementation plan separate from the older confidential-integration history once scope grows further

Done when:

- the team can navigate current-state vs next-state docs more easily

## Minimal Acceptance Criteria For The First FHERC20 MVP

The first FHERC20 milestone should count as successful only if all of these are true:

1. One private asset can be selected in the UI as a distinct lane.
2. ZeroToll sponsors the execution path.
3. The output visibly reflects sponsored-gas recovery plus service fee.
4. The private-asset path is tested independently.
5. The product copy honestly states what is private and what is still public.

If any of those are missing, the implementation may still be useful internally, but it is not yet a strong public demo.

## Suggested Immediate Next Coding Sprint

If engineering resumes on the FHERC20 thesis, the best immediate sprint is:

1. Add private-asset capability flags to config and backend runtime responses.
2. Create a separate hook and UI lane for private assets.
3. Introduce a dedicated private-asset router contract instead of overloading the escrow further.
4. Write one end-to-end Sepolia test route for a single private stablecoin pair.

That sequence keeps the blast radius controlled while moving ZeroToll toward the architecture the judge feedback was pointing at.
