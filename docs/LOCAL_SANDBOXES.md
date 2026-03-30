# Local Sandboxes

Two root-level directories are intentionally left outside the tracked cleanup flow:

- `frontend-nextjs-broken/`
- `frontend-cra-backup/`

## Why They Were Not Moved

These directories are:

- gitignored
- local-only
- not part of the official runtime
- full of ad hoc test files, local installs, or other machine-specific state

Moving them automatically during repo cleanup is riskier than leaving them in
place, because they may contain local work that is not represented in git.

## Current Policy

Treat both directories as personal sandbox areas, not as official project
structure.

They should not be used as:

- the canonical frontend
- an archive source of truth
- a deployment path
- evidence of active workspace layout

## Official Frontend

The official frontend remains:

- `frontend/`

## If You Want To Clean Them Up Later

Do it as an explicit local action, for example:

1. inspect them manually
2. decide whether they should be deleted, moved to `archive/`, or preserved elsewhere
3. remove local `node_modules` before any large move

Until then, they remain intentionally ignored and undocumented in the runtime path.
