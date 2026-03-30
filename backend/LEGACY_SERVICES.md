# Backend Legacy Services

This folder still contains several historical relayer and API variants.
They remain in the repo for reference, but they are not part of the official
local runtime.

## Official Runtime

Use `./start-zerotoll.sh` from the repo root.

The supported local stack is:

- `backend/phase2-relayer.mjs`
- `backend/delegation-gasless-api.mjs`
- `backend/eip7702-relayer.mjs` via `backend/routes/eip7702.py`
- `backend/server.py`

## Legacy Entry Points

Legacy entry points have been moved under `backend/legacy/`.

The following files are legacy or experimental:

- `backend/legacy/gasless-relay-api.mjs`
- `backend/legacy/gasless_api.mjs`
- `backend/legacy/hybrid-relayer.mjs`
- `backend/legacy/hybrid-self-hosted-relayer.mjs`
- `backend/legacy/intent-relayer.mjs`
- `backend/legacy/pimlico-fixed-relayer.mjs`
- `backend/legacy/pimlico-relayer.mjs`
- `backend/legacy/pimlico-v2-relayer.mjs`
- `backend/legacy/pimlico-v3-relayer.mjs`
- `backend/legacy/self-hosted-relayer.mjs`
- `backend/legacy/smart-relayer.mjs`
- `backend/legacy/policy-server/`
- `backend/legacy/start-self-hosted.sh`
- `backend/legacy/run-e2e-test.sh`
- `backend/legacy/test-api-e2e.mjs`
- `archive/legacy-services/root-scripts/start-services.sh`
- `archive/legacy-services/root-scripts/run-relayer.sh`
- `archive/legacy-services/root-scripts/run-e2e-test.sh`

## Notes

- These files may still work for research or debugging, but they are not kept
  in sync with the official runtime path.
- Several still assume older ports such as `3001`, older bundler flows, or
  alternative sponsorship designs.
- Prefer reading or extending the official runtime files before touching these
  variants.
