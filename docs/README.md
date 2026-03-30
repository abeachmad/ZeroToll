# ZeroToll Docs

This directory now holds the repo's non-root documentation.

## Core Docs

- `REPO_SIMPLIFICATION_PLAN.md`: current cleanup and consolidation direction
- `CURRENT_CONTRACTS.md`: contract deployment references
- `GASLESS_SWAP_ARCHITECTURE.md`: gasless flow and architecture notes
- `ZEROTOLL_GASLESS_STRATEGY.md`: product-level decision on ERC-4337 vs wallet-native / custom EIP-7702
- `FHENIX_BUILDATHON_FIT.md`: honest assessment and recommended scope for the Fhenix privacy-by-design buildathon
- `ZEROTOLL_FHENIX_DIRECT_INTEGRATION.md`: concrete architectural consequences and recommended design for direct Fhenix integration
- `EIP7702_IMPLEMENTATION_PLAN.md`: EIP-7702 implementation plan
- `LOCAL_SANDBOXES.md`: status of ignored local frontend sandboxes left at repo root
- `TRUST_MODEL.md`: protocol trust and security analysis
- `USER_MANUAL.md`: end-user guide

## Script Utilities

Active support scripts now live in `scripts/`.

The root `package.json` mirrors the official local lifecycle with:

- `npm run start:local`
- `npm run status:local`
- `npm run stop:local`
- `npm run sync:shared-config`

## Archived Root Notes

Historical notes that used to live at the repo root now live in `docs/archive/root-notes/`.

These include:

- deployment summaries
- testing guides and progress notes
- EIP-7702 fix logs
- temporary status reports
- one-off debugging writeups

The root of the repo is intentionally kept small now. For current entry points, start with `README.md` and `SERVICE_MANAGEMENT.md`.
