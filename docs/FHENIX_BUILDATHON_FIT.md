# ZeroToll x Fhenix Buildathon Fit

Updated: 2026-03-31

## Honest Summary

ZeroToll is now a credible Fhenix buildathon submission, but it should still be presented honestly.

What is real today:

- the core ZeroToll product path is still a working gasless execution engine built around ERC-4337 sponsorship
- the repo now also ships a live **Confidential Gasless Intent** path on **Ethereum Sepolia**
- the frontend uses **browser-side CoFHE encryption** through `@cofhe/sdk`
- the confidential path uses a deployed on-chain **`ConfidentialIntentEscrow`**
- the confidential lifecycle is staged and on-chain:
  - submit
  - execute
  - request decryption
  - finalize
- the app can finalize into **native ETH**

What should still be stated clearly:

- this is not yet a production-grade confidential router
- mixed regular-token <-> zToken paths are still partly demo-oriented
- `USDC` still relies on a one-time Permit2 setup approval before the experience becomes gasless again

## Strongest Submission Angle

The strongest framing is:

**ZeroToll is a gasless execution protocol evolving into confidential intent infrastructure.**

That framing is stronger than either of these weaker alternatives:

- "we built a fully private DEX"
- "we just added a toy encrypted field"

The important story is the combination:

- no native gas required up front
- sponsored execution
- confidential execution thresholds
- native ETH delivery after wrapped internal settlement

## What Is Working Right Now

### 1. Main ZeroToll gasless path

- ERC-4337 paymaster-sponsored execution remains the main product path
- Sepolia can now deliver **native ETH** to the user after internal wrapped settlement

### 2. Confidential Gasless Intent on Sepolia

- browser encrypts a private threshold using CoFHE
- backend submits into `ConfidentialIntentEscrow`
- execution runs in staged form
- decryption is requested on-chain
- settlement is finalized on-chain
- successful paths can unwrap into native `ETH`

### 3. Confirmed confidential examples

- `USDC -> ETH`: live adapter-backed confidential flow through `SmartDexAdapter`
- `zUSDC -> ETH`: live confidential flow through inventory-backed escrow settlement

These flows are meaningful because they prove:

- client encryption exists in the active frontend
- staged settlement exists in the active runtime
- the private threshold path is not just mocked in the UI
- the user can end in native ETH

## Recommended Submission Language

Use language like:

> ZeroToll removes the native-gas barrier with ERC-4337 sponsorship, then adds a Fhenix-powered confidential intent path where execution thresholds are encrypted in the browser and finalized through an on-chain staged settlement flow on Sepolia.

That is accurate and still compelling.

## What To Avoid Claiming

Do not claim:

- that the whole protocol is already fully privacy-by-default
- that every route is already backed by a direct live venue adapter
- that the live contract path already represents perfect end-to-end encrypted production enforcement
- that `USDC` is approval-free from the first transaction

Those claims would overstate the current implementation.

## Why This Is Still A Good Submission

Even with the caveats, ZeroToll now has a differentiated buildathon story:

- gasless execution is real
- confidential staged settlement is real
- browser-side CoFHE encryption is real
- native ETH delivery is real
- the repo shows an actual migration path from public gasless DeFi to confidential intent execution

This is much stronger than a normal DEX demo with privacy language layered on top.

## Best Judge-Facing Narrative

If the judges ask what changed, the clearest answer is:

- ZeroToll already had a live gasless engine
- this wave added a live confidential path on Sepolia
- private thresholds now begin in the browser
- settlement now goes through a dedicated escrow lifecycle
- successful confidential swaps can finalize into native ETH

## Near-Term Risks To Mention Honestly

- `USDC` confidential flow still needs a one-time Permit2 approval
- `zUSDC -> ETH` still uses an inventory-backed path rather than a direct venue adapter
- the confidential path is ready for demo and judging, but not yet positioned as production-grade private routing

## Bottom Line

ZeroToll is now **buildathon-credible** because it ships a real gasless engine plus a live Fhenix-aligned confidential execution path on Sepolia.

The best submission is the honest one:

- lead with **gasless + confidential intents**
- show the live Sepolia proof points
- highlight native ETH delivery
- acknowledge the remaining demo-oriented edges instead of hiding them
