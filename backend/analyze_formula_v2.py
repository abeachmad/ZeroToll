#!/usr/bin/env python3
"""
CORRECT test of MockDEXAdapter getQuote formula
"""

# UNDERSTANDING THE PROBLEM:
# Pyth prices are in format: price * 1e8 (8 decimals)
# Example: $1.00 = 100,000,000 (1e8)
#          $0.55 = 55,000,000 (0.55 * 1e8)

# AMOY: 1 USDC → WMATIC
amountIn = 1_000_000  # 1 USDC (6 decimals)
priceIn_usd = 1.00  # $1 per USDC
priceOut_usd = 0.55  # $0.55 per WMATIC

# Pyth format (8 decimals):
priceIn = int(priceIn_usd * 1e8)  # 100,000,000
priceOut = int(priceOut_usd * 1e8)  # 55,000,000

decimalsIn = 6  # USDC
decimalsOut = 18  # WMATIC

print("🧪 TEST AMOY SWAP: 1 USDC → WMATIC")
print(f"Input: {amountIn:,} units (6 decimals) = {amountIn/1e6} USDC")
print(f"USDC price: ${priceIn_usd} = {priceIn:,} (Pyth 8-decimal format)")
print(f"WMATIC price: ${priceOut_usd} = {priceOut:,} (Pyth 8-decimal format)")
print()

# CURRENT FORMULA in MockDEXAdapter.sol (WRONG):
# if (decimalsOut >= decimalsIn) {
#     amountOut = (amountIn * priceIn * (10 ** (decimalsOut - decimalsIn))) / priceOut;
# }

decimal_adjustment = 10 ** (decimalsOut - decimalsIn)  # 10^12

print("❌ CURRENT (BUGGY) FORMULA:")
print(f"   amountOut = (amountIn * priceIn * 10^({decimalsOut}-{decimalsIn})) / priceOut")
print(f"   amountOut = ({amountIn:,} * {priceIn:,} * {decimal_adjustment:,}) / {priceOut:,}")

numerator = amountIn * priceIn * decimal_adjustment
print(f"   Numerator: {numerator:,}")
print(f"   Denominator: {priceOut:,}")

wrong_amountOut = numerator // priceOut
print(f"   Result: {wrong_amountOut:,} wei = {wrong_amountOut / 1e18:.9f} WMATIC")

# Apply slippage
slippage_bps = 30
wrong_with_slippage = (wrong_amountOut * (10000 - slippage_bps)) // 10000
print(f"   After 0.3% slippage: {wrong_with_slippage / 1e18:.9f} WMATIC")
print()

# EXPLANATION OF WHY IT'S WRONG:
print("🔍 WHY THIS IS WRONG:")
print("   The formula treats priceIn and priceOut as if they're in base units,")
print("   but they're actually in 8-decimal format (1 USD = 1e8)")
print("   So the result is 1e8 times too large!")
print()

# CORRECT FORMULA:
# We need to divide by 1e8 to convert from Pyth's 8-decimal format
print("✅ CORRECT FORMULA:")
print("   Prices are in 8-decimal format, so we need to normalize:")
print(f"   amountOut = (amountIn * priceIn * 10^({decimalsOut}-{decimalsIn})) / (priceOut * 10^8)")

price_decimals = 8
correct_amountOut = numerator // (priceOut * (10 ** price_decimals))
print(f"   Result: {correct_amountOut:,} wei = {correct_amountOut / 1e18:.9f} WMATIC")

correct_with_slippage = (correct_amountOut * (10000 - slippage_bps)) // 10000
print(f"   After 0.3% slippage: {correct_with_slippage / 1e18:.9f} WMATIC")
print()

# VERIFICATION
expected_exact = amountIn / 1e6 / priceOut_usd
print(f"💰 EXPECTED (no slippage): {expected_exact:.9f} WMATIC")
expected_with_slippage = expected_exact * (1 - slippage_bps/10000)
print(f"💰 EXPECTED (with slippage): {expected_with_slippage:.9f} WMATIC")
print()

print("="*70)
print("📊 COMPARISON WITH ONCHAIN DATA:")
print()
print(f"   Current buggy formula:  {wrong_with_slippage:>20,} wei")
print(f"                         = {wrong_with_slippage / 1e18:>20.9f} WMATIC")
print()
print(f"   Corrected formula:      {correct_with_slippage:>20,} wei") 
print(f"                         = {correct_with_slippage / 1e18:>20.9f} WMATIC")
print()
print(f"   From onchain trace:     {'997000000000000000':>20} wei")
print(f"                         = {'0.997000000':>20} WMATIC")
print()

print("🎯 CONCLUSION:")
print(f"   Current formula gives:  {wrong_with_slippage / 1e18:.4f} WMATIC")
print(f"   Onchain actually gave:  0.9970 WMATIC")
print()
print("   ❓ Wait, these DON'T match!")
print("   🤔 Need to check what prices the Amoy adapter is actually using...")
print()
print("   💡 HYPOTHESIS: Amoy adapter (0x0560672...) uses HARDCODED prices,")
print("      not Pyth oracle! That's why we only deployed Pyth adapter to Sepolia!")
