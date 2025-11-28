# ZeroToll File Cleanup Recommendations

## ✅ Files to KEEP

### Core Application Files
- `README.md` - Main project documentation
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` - Package management
- `.gitignore`, `.env.example` - Git and environment config
- `vercel.json` - Deployment config
- `ZeroToll.code-workspace` - VS Code workspace

### Scripts (Keep - Operational)
- `start-zerotoll.sh` - Start all services
- `stop-zerotoll.sh` - Stop all services
- `status-zerotoll.sh` - Check service status
- `start-services.sh` - Service management
- `generate_testnet_key.py` - Key generation utility
- `verify-config.py` - Config verification

### Current Documentation (Keep - Active)
- `EIP7702_GASLESS_SUCCESS.md` - **LATEST** - Successful implementation proof
- `QUICK_REFERENCE.md` - Quick reference guide
- `SECURITY.md` - Security documentation
- `SERVICE_MANAGEMENT.md` - Service management guide
- `CREDENTIALS_SETUP.md` - Setup instructions
- `HOW_GASLESS_SWAPS_WORK.md` - Technical explanation
- `WHY_WRAPPED_TOKENS.md` - Design decisions

### Backend (Keep - Active)
- `backend/server.py` - Main backend server
- `backend/eip7702_routes.py` - EIP-7702 API routes
- `backend/requirements.txt` - Python dependencies
- `backend/.env.example` - Environment template
- `backend/pyth_rest_oracle.py` - Oracle service
- `backend/token_registry.py` - Token management
- `backend/route_client.py` - Route planning
- `backend/web3_tx_builder.py` - Transaction builder
- `backend/dex_swap_service.py` - DEX integration
- `backend/blockchain_service.py` - Blockchain service

### Frontend (Keep - Active)
- `frontend/src/` - All source code
- `frontend/package.json` - Dependencies
- `frontend/.env.example` - Environment template
- `frontend/README.md` - Frontend docs
- `frontend/test-eip7702-*.mjs` - **LATEST** EIP-7702 tests (working)
- `frontend/test-check-liquidity.mjs` - Utility
- `frontend/test-fund-adapter.mjs` - Utility
- `frontend/check-adapter-owner.mjs` - Utility
- `frontend/return-wpol-to-adapter.mjs` - Utility

### Packages (Keep - Core)
- `packages/contracts/` - Smart contracts
- `packages/relayer/` - Relayer service
- `packages/ai/` - AI features
- `packages/subgraph/` - Subgraph

---

## 🗑️ Files to DELETE

### Obsolete Documentation (Delete - Superseded)
**Reason: Replaced by EIP7702_GASLESS_SUCCESS.md**

1. `AMOY_ORACLE_FIX.md` - Old oracle debugging
2. `BUNDLER_SETUP.md` - Old bundler setup (not using custom bundler)
3. `BUNDLER_SETUP_GUIDE.md` - Duplicate
4. `CLEANUP_SUMMARY.md` - Old cleanup notes
5. `CRITICAL_BUGFIXES_ROUND2.md` - Old bug fixes
6. `DEBUGGING_REPORT_NOV9.md` - Old debugging session
7. `DEBUGGING_SUMMARY.md` - Old debugging notes
8. `DEBUGGING_VERIFICATION.md` - Old verification
9. `EIP7702_CUSTOM_SIGNING.md` - Old implementation attempt
10. `EIP7702_IMPLEMENTATION_COMPLETE.md` - Old completion claim
11. `EIP7702_IMPLEMENTATION_PLAN.md` - Old plan
12. `EIP7702_IMPLEMENTATION_STATUS.md` - Old status
13. `EIP7702_QUICKSTART.md` - Superseded by SUCCESS doc
14. `EIP7702_TESTING_GUIDE.md` - Old testing guide
15. `FILE_CLEANUP_ANALYSIS.md` - Old cleanup analysis
16. `GASLESS_MUST_WORK_CHECKLIST.md` - Old checklist
17. `GASLESS_QUICKSTART.md` - Old quickstart
18. `GASLESS_SPECIFICATION.md` - Old spec
19. `GASLESS_UX_FIXES.md` - Old fixes
20. `LIVE_TEST_GUIDE.md` - Old test guide
21. `METAMASK 7702.md` - Old MetaMask notes
22. `MIGRATION_COMPLETE.md` - Old migration notes
23. `NATIVE_TOKEN_SOLUTION.md` - Old solution doc
24. `PAYMASTER_STRATEGY.md` - Old strategy
25. `PHASE_1_DEPLOYMENT.md` - Old deployment notes
26. `PHASE_2_DEPLOYMENT.md` - Old deployment notes
27. `PHASE_2_TEST_RESULTS.md` - Old test results
28. `PHASE3_COMPLETE.md` - Old phase notes
29. `PHASE3_PROGRESS.md` - Old progress notes
30. `PHASE4_COMPLETE.md` - Old phase notes
31. `SCRIPTS_COMPLETE.md` - Old script notes
32. `TESTING_GASLESS_FIXES.md` - Old testing notes
33. `ZERO_HARDCODE_AUDIT_FINAL.md` - Old audit
34. `CROSS_CHAIN_STRATEGY.md` - Future feature (not implemented)
35. `COMMANDS.md` - Redundant with QUICK_REFERENCE.md
36. `VSCode_WSL_Optimization.md` - Personal setup notes

### Obsolete Scripts (Delete - Not Used)
**Reason: Using Pimlico bundler, not custom bundler**

37. `live-test.sh` - Old test script
38. `test-amoy-fix.sh` - Old fix script
39. `verify-gasless-implementation.js` - Old verification

### Obsolete Test Files (Delete - Superseded)
**Reason: Replaced by test-eip7702-*.mjs files**

40. `frontend/test-bundler-direct.mjs` - Old bundler test
41. `frontend/test-debug-swap.mjs` - Old debug
42. `frontend/test-debug-swap-v2.mjs` - Old debug
43. `frontend/test-debug.mjs` - Old debug
44. `frontend/test-delegation.mjs` - Old delegation test
45. `frontend/test-gasless.mjs` - Old gasless test
46. `frontend/test-gasless-v2.mjs` - Old version
47. `frontend/test-gasless-v3.mjs` - Old version
48. `frontend/test-gasless-v4.mjs` - Old version
49. `frontend/test-gasless-v5.mjs` - Old version
50. `frontend/test-gasless-final.mjs` - Old final (superseded by eip7702 tests)
51. `frontend/test-gasless-swap-v2.mjs` - Old swap test
52. `frontend/test-gasless-swap-v3.mjs` - Old swap test
53. `frontend/test-gasless-swap-v4.mjs` - Old swap test
54. `frontend/test-gasless-transfer.mjs` - Old transfer test
55. `frontend/test-simple-account.mjs` - Old account test
56. `frontend/test-swap-debug.mjs` - Old debug
57. `frontend/check-account.mjs` - Old check (use check-adapter-owner.mjs)
58. `frontend/test-check-contracts.mjs` - Redundant with check-liquidity

### Obsolete Backend Files (Delete - Not Used)
**Reason: Old debugging/testing files**

59. `backend/analyze_failed_txs.py` - Old analysis
60. `backend/analyze_formula_v2.py` - Old analysis
61. `backend/check_adapter_balance.py` - Old check
62. `backend/check_cctp_recovery.py` - Old check
63. `backend/check_failed_quotes.py` - Old check
64. `backend/decode_amoy_minout.py` - Old decode
65. `backend/decode_failed_tx.py` - Old decode
66. `backend/decode_internal_txs.py` - Old decode
67. `backend/direct_swap_test.py` - Old test
68. `backend/test_adapter_quote.py` - Old test
69. `backend/test_amoy_oracle.py` - Old test
70. `backend/test_amoy_pyth.py` - Old test
71. `backend/test_getquote_formula.py` - Old test
72. `backend/test_oracle_direct.py` - Old test
73. `backend/test_quote_pyth.py` - Old test
74. `backend/update_amoy_prices.py` - Old update script
75. `backend/pyth_price_service_old.py` - Old service
76. `backend/real_blockchain_service.py` - Duplicate of blockchain_service.py
77. `backend/simple_swap_service.py` - Not used
78. `backend/dex_integration_service.py` - Not used
79. `backend/.env.eip7702` - Old env file

### Obsolete Scripts Folder (Delete - Old Debugging)
**Reason: Old debugging scripts**

80. `scripts/analyze-tx-pattern.js` - Old analysis
81. `scripts/check-allowances.js` - Old check
82. `scripts/check-approval-history.js` - Old check
83. `scripts/check-balances.sh` - Old check
84. `scripts/debug-approval-mechanism.js` - Old debug
85. `scripts/debug-oracle-and-adapter.js` - Old debug
86. `scripts/decode-minout.js` - Old decode
87. `scripts/decode-revert-reason.js` - Old decode
88. `scripts/decode-tx-properly.js` - Old decode
89. `scripts/fix-checksums.js` - Old fix
90. `scripts/fund-sepolia-adapter-weth.js` - Old funding
91. `scripts/manual-decode.js` - Old decode
92. `scripts/test-correct-adapters.js` - Old test
93. `scripts/test-gasless-7702.js` - Duplicate (use .mjs version)
94. `scripts/test-gasless-7702.mjs` - Old test (use frontend tests)
95. `scripts/test-pimlico.py` - Old test
96. `scripts/update-contract-addresses.js` - Old update

### Bundler Infinitism (Delete - Not Used)
**Reason: Using Pimlico bundler instead of custom bundler**

97. `bundler-infinitism/` - **ENTIRE FOLDER** - Not using custom bundler

### Log Files (Delete - Temporary)
**Reason: Temporary runtime files**

98. `backend/backend.log` - Runtime log
99. `backend/backend.pid` - Runtime PID
100. `backend/server.log` - Runtime log
101. `backend/uvicorn.log` - Runtime log
102. `frontend/frontend.log` - Runtime log
103. `bundler-infinitism/bundler.log` - Runtime log

---

## 📊 Summary

- **Total Files to Delete:** ~103 files/folders
- **Disk Space to Recover:** ~500MB+ (mostly bundler-infinitism)
- **Reason:** Obsolete documentation, old test files, unused bundler

## 🎯 Cleanup Benefits

1. **Cleaner Repository** - Easier to navigate
2. **Less Confusion** - No outdated docs
3. **Faster Operations** - Less files to scan
4. **Clear History** - Only current implementation visible

## ⚠️ Before Deleting

1. Ensure all tests pass with current files
2. Backup if needed (already in git history)
3. Delete in batches to verify nothing breaks
