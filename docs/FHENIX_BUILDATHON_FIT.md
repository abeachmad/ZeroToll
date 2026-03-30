# ZeroToll x Fhenix Buildathon Fit

Updated: 2026-03-30

## Honest Summary

ZeroToll is not yet a strong buildathon fit in its current active implementation.

Why:

- the active product is a gasless DEX with ERC-4337 sponsorship
- the active runtime does not yet integrate Fhenix CoFHE, `@cofhe/sdk`, `@cofhe/react`, or Privara
- privacy is currently a roadmap theme, not a core architectural reality in the shipped stack

This does **not** mean ZeroToll should avoid the buildathon.

It means the submission should **not** be framed as "we already built a privacy-by-design protocol."
It should be framed as:

- ZeroToll is a working gasless execution engine
- we are adapting it into a privacy-native execution engine on Fhenix
- the buildathon milestone is the first real confidential execution flow, not a generic DEX demo

## Buildathon-Aligned Submission Angle

The strongest angle is:

**Confidential Gasless Intents**

ZeroToll already solves:

- no-native-gas UX
- sponsor-fronted execution
- fee recoup from token flow

Fhenix can add what ZeroToll currently lacks:

- hidden order parameters
- encrypted slippage / threshold logic
- MEV-resistant sealed execution inputs
- selective disclosure for professional users

This is a much stronger story than "gasless swap on Fhenix."

## Current Gaps In Active Code

The active stack remains transparent-by-default:

- [RouterHub.sol](../packages/contracts/contracts/RouterHub.sol) pulls user tokens directly and applies fees publicly
- [phase2-relayer.mjs](../backend/phase2-relayer.mjs) computes sponsorship and fee recovery in a normal transparent flow
- the active frontend has no Fhenix client encryption path, no encrypted permit flow, and no decryption UX

There are historical notes about encrypted intents in archived docs, but not a real active implementation yet.

## Minimum Bar To Be Credible In This Buildathon

### 1. Add real Fhenix integration

At least one active contract in the official runtime path should use Fhenix encrypted types and operations.

Examples:

- encrypted `minOut`
- encrypted slippage bound
- encrypted RFQ / sealed quote selection
- encrypted route preference or execution threshold

### 2. Add client-side encryption and decryption flow

The frontend should actually encrypt something before submission and decrypt or selectively reveal a result afterward.

At minimum:

- encrypt on the client
- pass encrypted input to contract
- manage permits / access control
- decrypt or unseal result for the user

### 3. Show privacy changing protocol behavior

Privacy cannot be cosmetic. Judges will likely care whether encrypted state changes what the protocol can do.

Good examples:

- a relayer cannot read the user's exact threshold
- mempool observers cannot see the user’s real limit
- an execution path can prove success without revealing sensitive parameters

### 4. Demo on a supported Fhenix environment

The buildathon copy says Fhenix is live on:

- Ethereum Sepolia
- Arbitrum Sepolia
- Base Sepolia

A strong submission should run on one of those, not only in mock mode.

## Highest-Probability MVP

If the goal is to maximize win probability without overbuilding, the best MVP is:

**ZeroToll Private MinOut / Sealed Intent**

Scope:

- keep the current ERC-4337 gasless engine
- do **not** replace the economic engine
- add one Fhenix-enabled execution path where user threshold data stays encrypted

Suggested confidential fields:

- `minOut`
- slippage tolerance
- optional order size bucket or strategy flag

Why this MVP is strong:

- it aligns with the buildathon's "confidential DeFi" theme
- it directly addresses MEV / strategy leakage
- it preserves ZeroToll's existing gasless differentiation
- it is much more realistic than rebuilding the whole DEX around FHE in one wave

## Stronger But Harder Direction

If the team has time and Fhenix support, the stronger long-term angle is:

**Confidential RFQ / Sealed Route Selection**

That would let ZeroToll position itself as:

- gasless
- privacy-preserving
- execution-quality focused

But this is meaningfully harder than encrypted `minOut`, because it touches quote generation, relayer logic, and execution semantics more deeply.

## What Would Make ZeroToll More Competitive

### Strong positives

- one real end-to-end confidential flow in the production path
- crisp articulation of what is hidden, from whom, and why that matters
- a demo that shows gasless UX still works without native gas
- a concrete institutional or pro-trader use case
- a clear before/after: transparent swap vs confidential gasless intent

### Weak signals

- renaming a normal swap as "private" without encrypted state
- mock-only Fhenix code with no live testnet demo
- generic privacy language without selective disclosure or encrypted computation
- using Fhenix only for a toy variable that does not affect execution outcomes

## Recommended Submission Story

ZeroToll should pitch itself as:

**A gasless execution protocol evolving into confidential intent infrastructure.**

One concise version:

> ZeroToll removes the native-gas barrier with ERC-4337 sponsorship, then uses Fhenix to hide execution thresholds and intent parameters that would otherwise leak alpha or invite MEV.

That is honest, differentiated, and actually aligned with the buildathon brief.

## Recommended Build Plan

### Phase A: qualify credibly

- add one Fhenix-backed contract path
- wire encrypted client input into the active frontend
- deploy and demo on Sepolia or Base Sepolia
- document exactly which data remains encrypted and how access is controlled

### Phase B: improve competitiveness

- add a comparison demo showing public-vs-confidential execution
- quantify why privacy matters for ZeroToll users
- show fee sponsorship still works in the confidential path
- add selective disclosure for debugging / audit / user confirmation

### Phase C: standout factor

- show confidential routing or sealed RFQ
- or show a privacy-preserving gas sponsorship marketplace / pool policy

## Recommended Near-Term Deliverables

1. `contracts/fhenix/ConfidentialIntentRouter.sol`
2. Fhenix client integration package in the active frontend
3. one demo flow: encrypt input -> submit gasless intent -> execute -> reveal result
4. architecture diagram focused on privacy boundaries
5. short demo video showing the exact user journey

## Bottom Line

As of now, ZeroToll is **promising but not yet buildathon-ready as a privacy-by-design protocol**.

It becomes a credible and potentially strong submission if the team ships one real Fhenix-powered confidential execution path and keeps the pitch tightly focused on:

- gasless UX
- confidential intent parameters
- MEV-resistant execution
- selective disclosure
