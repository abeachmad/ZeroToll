#!/bin/bash
# Cleanup script to remove test files with hardcoded keys from git tracking
# These files are now in .gitignore but were previously tracked

echo "=== Removing test files from git tracking ==="
echo "These files contain hardcoded keys and should not be committed"
echo ""

# Remove test files from git tracking (keeps local files)
git rm --cached backend/test-*.mjs 2>/dev/null
git rm --cached backend/fund-*.mjs 2>/dev/null
git rm --cached frontend/test-*.mjs 2>/dev/null
git rm --cached frontend/fund-*.mjs 2>/dev/null
git rm --cached frontend/return-*.mjs 2>/dev/null
git rm --cached frontend/transfer-*.mjs 2>/dev/null
git rm --cached frontend/verify-*.mjs 2>/dev/null
git rm --cached scripts/test-*.mjs 2>/dev/null
git rm --cached scripts/test-*.js 2>/dev/null
git rm --cached frontend-cra-backup/*.mjs 2>/dev/null
git rm --cached frontend-nextjs-broken/*.mjs 2>/dev/null

echo ""
echo "=== Done! ==="
echo "Now commit the changes with: git commit -m 'Remove test files with hardcoded keys from tracking'"
echo ""
echo "The files are still on your local disk but won't be committed to git."
