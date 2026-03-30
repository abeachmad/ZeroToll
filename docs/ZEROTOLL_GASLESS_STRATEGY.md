# ZeroToll Gasless Strategy

Updated: 2026-03-30

## Goal

ZeroToll's primary product goal is:

- users can transact without holding native gas token
- ZeroToll fronts the gas cost
- ZeroToll recovers gas cost plus protocol margin from the user's swap tokens
- recovered fees flow into treasury / gas pool reward distribution

This goal maps most cleanly to ZeroToll's ERC-4337 paymaster stack, not to wallet-native EIP-7702 flows.

## Decision Summary

### Primary path: ZeroToll-sponsored gasless

Keep the ERC-4337 path as the canonical ZeroToll gasless architecture.

Why:

- ZeroToll controls sponsorship through its own paymaster and relayer.
- ZeroToll controls fee calculation and can recoup fees from token input/output.
- ZeroToll can route recovered fees into protocol treasury and gas pool rewards.
- Users do not need native gas.

Relevant code:

- [backend/phase2-relayer.mjs](../backend/phase2-relayer.mjs)
- [packages/contracts/contracts/ZeroTollRouterV3.sol](../packages/contracts/contracts/ZeroTollRouterV3.sol)
- [packages/contracts/contracts/RouterHub.sol](../packages/contracts/contracts/RouterHub.sol)

### Secondary path: wallet-native smart account UX

Treat MetaMask-style EIP-7702 as an optional wallet-native convenience mode, not as the core ZeroToll gasless engine.

Why:

- MetaMask smart accounts are real, but controlled by the wallet.
- sponsorship and gas-token settlement are wallet-driven, not protocol-driven
- the dapp does not fully control the sponsor, fee recoup, or treasury routing
- MetaMask's public guidance centers around `wallet_sendCalls` and its own smart account contract, not arbitrary dapp delegates

## Architecture Recommendation

### 1. Canonical economic engine

Use:

- ERC-4337 user operation flow
- ZeroToll VerifyingPaymaster
- relayer-side fee calculation
- contract-side fee recoup from token amount
- treasury accounting for gas pool rewards

Current building blocks already exist:

- fee estimation in [backend/phase2-relayer.mjs](../backend/phase2-relayer.mjs)
- input-token fee collection in [packages/contracts/contracts/ZeroTollRouterV3.sol](../packages/contracts/contracts/ZeroTollRouterV3.sol)
- output-token skim in [packages/contracts/contracts/RouterHub.sol](../packages/contracts/contracts/RouterHub.sol)

### 2. Optional wallet-native mode

Offer a separate "Smart Wallet Batch" mode for wallets like MetaMask that support:

- smart account upgrade inside the wallet
- `wallet_sendCalls`
- batched approve + swap
- wallet-managed gas sponsorship or gas-in-token where available

This mode should not be marketed as "ZeroToll-sponsored gasless" unless ZeroToll is actually the sponsor of record.

### 3. Experimental custom EIP-7702 mode

Keep custom EIP-7702 delegation as an advanced or experimental mode for wallet providers that expose low-level signing and allow delegation to an arbitrary contract chosen by the app.

This mode is useful for:

- embedded wallets
- server-managed / MPC wallets
- local programmatic signers

It is not a safe default assumption for browser extension wallets.

## Why MetaMask Is Not The Primary ZeroToll Gasless Path

MetaMask supports smart accounts and EIP-7702 concepts, but the official product flow is wallet-managed:

- users upgrade an account inside MetaMask
- MetaMask smart accounts point to MetaMask's own smart account contract
- the recommended developer flow uses `useSendCalls` / `wallet_sendCalls`

MetaMask's own help center states:

- smart accounts are enabled per network in-wallet
- the user pays a small gas fee to enable them
- MetaMask currently supports smart account functionality for its own smart contract

For ZeroToll, that means:

- batching can work
- wallet-native sponsorship may work on some networks
- but ZeroToll does not have end-to-end control of gas sponsorship economics

## Wallet Support Matrix For ZeroToll Custom EIP-7702

This matrix is about wallets or wallet providers that can support a ZeroToll-style custom EIP-7702 flow where the app or relayer needs an authorization for an arbitrary delegate chosen by ZeroToll.

### Strong fit

#### Privy embedded wallets

Status: strong fit

Why:

- Privy explicitly documents EIP-7702 authorization signing
- Privy says embedded wallets can be upgraded into any smart contract
- supports React SDK, REST API, and Node SDK

Best use:

- ZeroToll embedded wallet flow
- custom delegate authorization
- protocol-controlled EIP-7702 integrations

Sources:

- https://docs.privy.io/wallets/using-wallets/ethereum/sign-7702-authorization
- https://docs.privy.io/recipes/react/eip-7702

#### Magic embedded wallets

Status: strong fit

Why:

- Magic exposes `wallet.sign7702Authorization()`
- docs say it signs authorization to delegate the EOA to a specified smart contract

Important note:

- Magic's direct `send7702Transaction()` docs assume the wallet has native gas to submit the type-4 transaction itself
- ZeroToll can still use Magic for signing only, then submit via its own relayer

Sources:

- https://docs.magic.link/embedded-wallets/wallets/features/eip-7702

#### Turnkey

Status: strong fit

Why:

- Turnkey officially supports EIP-7702 Type 4 transactions
- `@turnkey/viem` added `signAuthorization`
- works well for backend or embedded-style signing flows

Best use:

- programmatic signer
- server-side orchestration
- controlled ZeroToll flows

Sources:

- https://docs.turnkey.com/networks/ethereum
- https://docs.turnkey.com/changelogs/viem/readme

### Likely fit with provider integration work

#### Para embedded wallets

Status: likely fit

Why:

- Para documents EIP-7702 with Alchemy and ZeroDev
- Para's examples show an embedded/account-kit style `signAuthorization` flow
- Para's embedded signing model can likely be adapted for protocol-controlled flows

Caveat:

- official examples are built around Alchemy / ZeroDev integrations
- custom ZeroToll delegate wiring still needs implementation validation

Sources:

- https://docs.getpara.com/v2/react/guides/web3-operations/evm/smart-accounts/upgrade-eoa-7702
- https://docs.getpara.com/v2/react/guides/account-abstraction/eip7702-zerodev
- https://docs.getpara.com/account-abstraction/alchemy-accountkit

### Needs re-validation before adoption

#### Dynamic embedded wallets

Status: needs re-validation

Why:

- earlier ecosystem guidance indicated Dynamic had EIP-7702 material for embedded wallets
- on 2026-03-30, the public docs path previously referenced for 7702 returned 404

Caveat:

- do not treat Dynamic as a confirmed ZeroToll custom EIP-7702 wallet until current official docs or a working integration is verified

Source checked:

- https://www.dynamic.xyz/docs/smart-wallets/smart-wallet-providers/7702

### Not suitable for ZeroToll custom EIP-7702 today

#### MetaMask extension / mobile

Status: not suitable for custom ZeroToll delegation

Why:

- official flow is wallet-managed smart accounts
- docs/tutorials center on `wallet_sendCalls`
- current public behavior does not expose `wallet_signAuthorization` for arbitrary dapp use
- MetaMask states it only supports smart account functionality for its own smart contract

Result:

- compatible for batch UX
- not a reliable path for arbitrary ZeroToll delegate authorization

Sources:

- https://docs.metamask.io/tutorials/upgrade-eoa-to-smart-account/
- https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/

#### External browser wallets like Rabby / Trust / similar

Status: assume not suitable unless proven otherwise

Why:

- multiple AA provider docs state external wallets generally block apps from installing code on EOAs through EIP-7702
- provider guidance consistently routes these wallets to fallback models instead of direct 7702 delegation

This is an ecosystem inference, not a direct official statement from every wallet vendor.

Sources:

- https://docs.biconomy.io/new/getting-started/enable-mee-eoa-users/
- https://docs.biconomy.io/new/quickstart/external-wallets-quickstart
- https://docs.getpara.com/account-abstraction/alchemy-accountkit

## Product Modes To Keep Separate

### ZeroToll Gasless

Definition:

- gas sponsored by ZeroToll
- no native token required
- fee recouped from token input/output
- treasury / gas pool receives protocol fee

Recommended stack:

- ERC-4337
- ZeroToll paymaster
- ZeroToll relayer
- RouterV3 / RouterHub fee collection

### Smart Wallet Batch

Definition:

- wallet-native smart account UX
- batching may work
- gas may be sponsored by wallet or paid in supported tokens
- not guaranteed to be sponsored by ZeroToll

Recommended stack:

- `wallet_sendCalls`
- wallet-native capabilities
- simple approve + swap batching

### Custom EIP-7702

Definition:

- ZeroToll chooses the delegate contract
- user signs EIP-7702 authorization
- relayer submits type-4 transaction

Recommended stack:

- embedded wallets or programmatic signers only
- treat as experimental unless the wallet support is proven

## Implementation Plan

### Immediate

- keep ERC-4337 as the production gasless path
- keep relayer fee calculation as the source of truth
- keep treasury distribution logic tied to sponsored execution
- stop treating MetaMask EIP-7702 as the same thing as ZeroToll-sponsored gasless

### Near-term

- add frontend wallet capability routing:
  - MetaMask external wallet -> smart wallet batch mode
  - embedded/programmatic signer -> optional custom EIP-7702 mode
  - default -> ZeroToll ERC-4337 gasless mode

### Later

- if ZeroToll wants EIP-7702 as a first-class protocol path, prioritize embedded wallet partners:
  - Privy
  - Magic
  - Turnkey
  - Para embedded

## Practical Recommendation

For the current product:

- ship ZeroToll Gasless on ERC-4337 as the main promise
- support MetaMask smart accounts as a separate UX mode, not the economic core
- pursue custom EIP-7702 only with embedded or programmatic wallets

That combination keeps the protocol economically correct while still letting the frontend support modern wallet-native smart account UX where available.
