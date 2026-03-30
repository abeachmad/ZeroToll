# Shared Config

This package is the source of truth for ZeroToll chain, contract, token, and Pyth feed configuration.

## Purpose

The repo previously duplicated addresses and token metadata across:

- `frontend/src/config/contracts.json`
- `frontend/src/config/tokenlists/*.json`
- `frontend/src/config/pyth.feeds.js`
- `backend/token_addresses.json`
- `backend/server.py`
- `backend/pyth_rest_oracle.py`

This package reduces that drift by storing source data once and generating the compatible artifacts the current apps already use.

## Source

- `src/source-of-truth.json`

## Generate

From the repo root:

```bash
npm run sync:shared-config
```

Or from this package:

```bash
node scripts/generate.mjs
```

## Deployment Updaters

Legacy updater scripts in the repo now target `src/source-of-truth.json` first and then regenerate derived frontend/backend artifacts.

That keeps these generated files as outputs, not primary edit targets:

- `frontend/src/config/contracts.json`
- `frontend/src/config/tokenlists/*.json`
- `frontend/src/config/pyth.feeds.json`
- `backend/token_addresses.json`
- `backend/chain_config.json`
- `backend/pyth_feed_ids.json`
