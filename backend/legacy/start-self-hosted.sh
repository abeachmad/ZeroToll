#!/bin/bash
cd "$(dirname "$0")/../.."
echo "[DEPRECATED] backend/legacy/start-self-hosted.sh is a legacy helper."
echo "[DEPRECATED] Official entry point: ./start-zerotoll.sh"
echo "[DEPRECATED] Suggested replacement: backend/phase2-relayer.mjs"
echo "[DEPRECATED] Legacy inventory: backend/LEGACY_SERVICES.md"
node backend/legacy/self-hosted-relayer.mjs
