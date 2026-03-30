#!/bin/bash

echo "🧹 Cleaning up ZeroToll repository..."

# Remove tracked files that should be ignored
echo "Removing Python venv from git..."
git rm -r --cached backend/venv 2>/dev/null || true
git rm -r --cached backend/__pycache__ 2>/dev/null || true

echo "Removing build artifacts from git..."
git rm -r --cached packages/contracts/artifacts 2>/dev/null || true
git rm -r --cached packages/contracts/cache 2>/dev/null || true
git rm -r --cached frontend/build 2>/dev/null || true

echo "Removing test scripts from git..."
git rm --cached backend/test-*.mjs 2>/dev/null || true
git rm --cached backend/check-*.mjs 2>/dev/null || true
git rm --cached backend/fund-*.mjs 2>/dev/null || true
git rm --cached backend/deploy-*.mjs 2>/dev/null || true
git rm --cached backend/verify-*.mjs 2>/dev/null || true
git rm --cached backend/rescue-*.mjs 2>/dev/null || true

echo "Removing log files from git..."
git rm --cached backend/*.log 2>/dev/null || true
git rm --cached *.log 2>/dev/null || true

echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Commit: git commit -m 'Clean up repo: remove venv, artifacts, test scripts'"
echo "3. Push: git push"
echo ""
echo "Repo size will be reduced significantly after push."
