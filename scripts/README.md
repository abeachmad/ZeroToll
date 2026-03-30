# ZeroToll Scripts

Support utilities that are still useful for active development now live here.

## Current Categories

- `deploy/`: deployment helpers
- `checks/`: balance, allowance, adapter, and state inspection helpers
- `debug/`: targeted debugging and failure-analysis utilities
- `decode/`: calldata and transaction decoding helpers
- `funding/`: scripts for funding test liquidity or adapters
- `testing/`: test runners and manual validation scripts
- `verification/`: config, deployment, and implementation checks
- `utils/`: small helper utilities

The official local runtime entry points remain at the repo root:

- `start-zerotoll.sh`
- `status-zerotoll.sh`
- `stop-zerotoll.sh`

Historical notes may still mention older root-level script paths. When that happens, use the equivalents under this directory or check `archive/`.

Obsolete or risky one-off helpers that are no longer part of the preferred flow
have been moved to `archive/root-scripts/`.
