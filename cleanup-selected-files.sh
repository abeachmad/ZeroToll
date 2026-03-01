#!/bin/bash

# ZeroToll Selective File Cleanup Script
# Removes only obsolete documentation, frontend tests, and backend debug files

echo "🧹 ZeroToll Selective Cleanup"
echo "=============================="
echo ""
echo "Deleting:"
echo "  - 36 Obsolete Documentation Files"
echo "  - 19 Obsolete Frontend Tests"
echo "  - 21 Obsolete Backend Files"
echo ""

# 36 Obsolete Documentation Files
echo "📄 Removing obsolete documentation..."
rm -f AMOY_ORACLE_FIX.md
rm -f BUNDLER_SETUP.md
rm -f BUNDLER_SETUP_GUIDE.md
rm -f CLEANUP_SUMMARY.md
rm -f CRITICAL_BUGFIXES_ROUND2.md
rm -f DEBUGGING_REPORT_NOV9.md
rm -f DEBUGGING_SUMMARY.md
rm -f DEBUGGING_VERIFICATION.md
rm -f EIP7702_CUSTOM_SIGNING.md
rm -f EIP7702_IMPLEMENTATION_COMPLETE.md
rm -f EIP7702_IMPLEMENTATION_PLAN.md
rm -f EIP7702_IMPLEMENTATION_STATUS.md
rm -f EIP7702_QUICKSTART.md
rm -f EIP7702_TESTING_GUIDE.md
rm -f FILE_CLEANUP_ANALYSIS.md
rm -f GASLESS_MUST_WORK_CHECKLIST.md
rm -f GASLESS_QUICKSTART.md
rm -f GASLESS_SPECIFICATION.md
rm -f GASLESS_UX_FIXES.md
rm -f LIVE_TEST_GUIDE.md
rm -f "METAMASK 7702.md"
rm -f MIGRATION_COMPLETE.md
rm -f NATIVE_TOKEN_SOLUTION.md
rm -f PAYMASTER_STRATEGY.md
rm -f PHASE_1_DEPLOYMENT.md
rm -f PHASE_2_DEPLOYMENT.md
rm -f PHASE_2_TEST_RESULTS.md
rm -f PHASE3_COMPLETE.md
rm -f PHASE3_PROGRESS.md
rm -f PHASE4_COMPLETE.md
rm -f SCRIPTS_COMPLETE.md
rm -f TESTING_GASLESS_FIXES.md
rm -f ZERO_HARDCODE_AUDIT_FINAL.md
rm -f CROSS_CHAIN_STRATEGY.md
rm -f COMMANDS.md
rm -f VSCode_WSL_Optimization.md

# 19 Obsolete Frontend Tests
echo "🧪 Removing obsolete frontend tests..."
rm -f frontend/test-bundler-direct.mjs
rm -f frontend/test-debug-swap.mjs
rm -f frontend/test-debug-swap-v2.mjs
rm -f frontend/test-debug.mjs
rm -f frontend/test-delegation.mjs
rm -f frontend/test-gasless.mjs
rm -f frontend/test-gasless-v2.mjs
rm -f frontend/test-gasless-v3.mjs
rm -f frontend/test-gasless-v4.mjs
rm -f frontend/test-gasless-v5.mjs
rm -f frontend/test-gasless-final.mjs
rm -f frontend/test-gasless-swap-v2.mjs
rm -f frontend/test-gasless-swap-v3.mjs
rm -f frontend/test-gasless-swap-v4.mjs
rm -f frontend/test-gasless-transfer.mjs
rm -f frontend/test-simple-account.mjs
rm -f frontend/test-swap-debug.mjs
rm -f frontend/check-account.mjs
rm -f frontend/test-check-contracts.mjs

# 21 Obsolete Backend Files
echo "🔧 Removing obsolete backend files..."
rm -f backend/analyze_failed_txs.py
rm -f backend/analyze_formula_v2.py
rm -f backend/check_adapter_balance.py
rm -f backend/check_cctp_recovery.py
rm -f backend/check_failed_quotes.py
rm -f backend/decode_amoy_minout.py
rm -f backend/decode_failed_tx.py
rm -f backend/decode_internal_txs.py
rm -f backend/direct_swap_test.py
rm -f backend/test_adapter_quote.py
rm -f backend/test_amoy_oracle.py
rm -f backend/test_amoy_pyth.py
rm -f backend/test_getquote_formula.py
rm -f backend/test_oracle_direct.py
rm -f backend/test_quote_pyth.py
rm -f backend/update_amoy_prices.py
rm -f backend/pyth_price_service_old.py
rm -f backend/real_blockchain_service.py
rm -f backend/simple_swap_service.py
rm -f backend/dex_integration_service.py
rm -f backend/.env.eip7702

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Deleted:"
echo "  ✓ 36 obsolete documentation files"
echo "  ✓ 19 obsolete frontend tests"
echo "  ✓ 21 obsolete backend files"
echo ""
echo "Total: 76 files removed"
