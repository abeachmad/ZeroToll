# Repo Simplification Plan

## Goal

Turn the current ZeroToll repository into a repo with one clear runtime path, one clear configuration source, and a much smaller set of "official" entry points.

The current repo mixes:

- active runtime code
- legacy runtime code
- experiments and backups
- vendor/reference code
- duplicated configuration
- multiple overlapping EIP-7702 paths

This document defines the target structure and a safe migration order.

## Target Repo Shape

The current target shape is:

```text
ZeroToll/
  frontend/             # official frontend
  backend/              # official FastAPI + relayer services
  packages/
    contracts/          # smart contracts
    shared-config/      # chain/token/address/feed/source-of-truth config
    subgraph/           # graph artifacts
  config/               # generated env-specific outputs only
  docs/
  scripts/
  archive/
    experiments/
    legacy-services/
    root-scripts/
    vendor/
    misc/
```

Moving everything into `apps/*` is no longer the active simplification target.
It may still be revisited later, but the repo is now being simplified around the
current working `frontend/` and `backend/` directories.

## Official Runtime After Simplification

At the current stage of simplification, only these services should be treated as production or demo-official:

- `frontend`
- `backend/server.py`
- `backend/phase2-relayer.mjs`
- `backend/delegation-gasless-api.mjs`
- `packages/contracts`

Everything else should either be archived, deleted, or marked experimental.

## Keep, Move, Archive

### Keep As Core

Keep in the current active locations:

- `frontend/`
- `backend/server.py`
- `backend/routes/eip7702.py`
- `backend/token_registry.py`
- `backend/token_addresses.json`
- `backend/route_client.py`
- `backend/web3_tx_builder.py`
- `backend/pyth_rest_oracle.py`
- `backend/phase2-relayer.mjs`
- `backend/delegation-gasless-api.mjs`
- `packages/contracts/`
- `config/asset-registry.amoy.json`
- `config/asset-registry.sepolia.json`

### Archive As Legacy Frontends / Experiments

Move to `archive/experiments/` where practical, or leave in place only if they
are local-only ignored sandboxes:

- `archive/experiments/frontend-vite/`
- `frontend-nextjs-broken/`
- `frontend-cra-backup/`
- `archive/experiments/7702-Readiness/`
- `archive/experiments/ZeroToll-fresh/`
- `archive/experiments/apps/web/`

Current decision:

- keep `frontend-nextjs-broken/` in place as a gitignored local sandbox
- keep `frontend-cra-backup/` in place as a gitignored local sandbox
- document them explicitly instead of moving them automatically

### Archive As Legacy Services

Move to `archive/legacy-services/`:

- `backend/legacy/policy-server/`
- `archive/legacy-services/packages/relayer/`
- `archive/legacy-services/packages/ai/`
- `backend/eip7702_routes.py` if `backend/routes/eip7702.py` remains the official path

### Archive As Vendor / Reference

Move to `archive/vendor/` or externalize from the main repo:

- `archive/vendor/bundler-infinitism/`
- `archive/vendor/qn-guide-examples/`

### Archive Root Progress Logs

Move repetitive status/progress markdown from repo root into `docs/archive/logs/`, for example:

- `PHASE*.md`
- `FINAL*.md`
- `EIP7702*.md`
- `DEPLOY*.md`
- `TEST*.md`
- `SUMMARY*.md`
- `STATUS*.md`

Keep only a very small root set:

- `README.md`
- `package.json`
- workspace config
- primary start/stop scripts
- top-level docs index if needed

## Single Source Of Truth

Create `packages/shared-config/` and treat it as the only configuration authority for:

- chain IDs
- explorer URLs
- RPC defaults
- contract addresses
- token addresses
- token decimals
- permit support
- Pyth feed IDs
- feature flags
- service ports

Suggested layout:

```text
packages/shared-config/
  src/
    chains.json
    tokens.json
    contracts.json
    services.json
    index.ts
  generated/
    frontend.contracts.json
    backend.token-addresses.json
```

### Required Rule

Addresses and token metadata must not be hardcoded separately in:

- frontend pages
- backend routes
- docs pages
- shell scripts

Instead:

1. store once in `packages/shared-config`
2. import directly where possible
3. generate derived JSON artifacts where direct import is not practical

## Frontend Simplification

The current frontend mixes multiple gasless strategies in one page.

### Target

The swap page should depend on one orchestrator abstraction:

- `useSwapExecution()`

Internally it can delegate to strategies, but only one public integration point should be used by the page.

Suggested structure:

```text
frontend/src/hooks/swap/
  useSwapExecution.ts
  strategies/
    intentGasless.ts
    eip7702.ts
    approvalOnly.ts
```

### Hooks To Collapse

The following should not remain as top-level competing public hooks:

- `useGaslessSwap.js`
- `useTrueGaslessSwap.js`
- `useWorkingGasless.js`
- `useIntentGasless.js`
- `useEIP7702Swap.js`
- `useMetaMask7702.js`
- `usePimlico7702.js`

Keep the best logic, but expose one public path.

## Backend Simplification

### Target

FastAPI should own:

- quote
- execute
- history
- stats
- config
- EIP-7702 API

Node relayer should own:

- ERC-4337 sponsorship
- paymaster flow
- delegation execution
- optional EIP-7702 CLI helpers

### EIP-7702 Rule

Pick one official backend path:

- Option A: keep `backend/routes/eip7702.py`
- Option B: keep `backend/eip7702_routes.py`

Do not keep both as first-class maintained implementations.

Recommended choice:

- keep `backend/routes/eip7702.py`
- archive `backend/eip7702_routes.py`

because `backend/server.py` already mounts the `routes/eip7702.py` router.

## Demo vs Live Separation

The repo currently mixes live logic and fallback/demo logic in the same code path.

Introduce an explicit mode boundary:

- `APP_MODE=live`
- `APP_MODE=demo`

### Live Mode

- no fake stats
- no fake quote math
- no silent mock route substitutions unless clearly surfaced

### Demo Mode

- mock routes allowed
- mock stats allowed
- synthetic liquidity allowed
- UI labels must clearly say demo/mock

## Service Topology Standard

Define one official local topology and use it everywhere:

- README
- startup scripts
- status scripts
- docs
- environment examples

Recommended topology:

- frontend: `3000`
- api: `8000`
- relayer: `3002`
- delegation api: `3003`
- mongodb: `27017`

If bundler or policy server are no longer official runtime requirements, remove them from the standard service map.

## Workspace Strategy

The workspace should only describe actual workspace-managed packages.

### Target

At the current stage, that means:

- `packages/contracts`
- `packages/shared-config`
- `packages/subgraph`

Root package scripts should mirror the official local entry points:

```json
{
  "scripts": {
    "start:local": "bash ./start-zerotoll.sh",
    "status:local": "bash ./status-zerotoll.sh",
    "stop:local": "bash ./stop-zerotoll.sh",
    "sync:shared-config": "node packages/shared-config/scripts/generate.mjs"
  }
}
```

## Migration Phases

### Phase 1: Freeze The Official Stack

- declare official runtime services
- update README
- update start/stop/status scripts
- add deprecation banners to legacy folders

### Phase 2: Centralize Config

- create `packages/shared-config`
- move chain/token/address/feed data into it
- generate frontend/backend artifacts from it
- remove duplicated hardcoded config

### Phase 3: Collapse EIP-7702 Paths

- choose one backend EIP-7702 route implementation
- choose one frontend execution entry point
- archive duplicate hooks and duplicate backend route files

### Phase 4: Separate Demo and Live Modes

- label synthetic behavior
- gate fallback behavior behind explicit config
- stop presenting mock metrics as live metrics

### Phase 5: Align Workspace And Root Tooling

- keep workspace focused on actual packages only
- keep `frontend/` and `backend/` as the active app locations
- add root scripts for the official local lifecycle
- remove stale workspace references that imply an `apps/` layout

### Phase 6: Archive Remaining Legacy Content

- move backup frontends
- move legacy service packages
- move root progress logs
- move vendor/reference code out of the core tree

## Decision Defaults

If no further product decision is made, use these defaults:

- official frontend base: current `frontend/`
- official backend API: current `backend/server.py`
- official relayer: current `backend/phase2-relayer.mjs`
- official EIP-7702 backend route: `backend/routes/eip7702.py`
- official contract package: `packages/contracts`
- official configuration authority: new `packages/shared-config`

## First Concrete Refactor Checklist

1. Add this plan document.
2. Update `README.md` to declare one official topology.
3. Update `status-zerotoll.sh` to match `start-zerotoll.sh`.
4. Add `DEPRECATED.md` markers inside legacy folders.
5. Create `packages/shared-config`.
6. Move addresses from frontend/backend/docs into shared config.
7. Replace direct hardcoded frontend docs addresses with generated data.
