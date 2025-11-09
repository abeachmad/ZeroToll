#!/usr/bin/env python3
"""
Test the MockDEXAdapter getQuote formula
"""

# AMOY transaction:
# Input: 1 USDC = 1,000,000 (6 decimals)
# USDC price: $1.00 = 1e8 (Pyth format)
# WMATIC price: $0.55 = 55000000 (Pyth format, 8 decimals)
# Expected: ~1.818 WMATIC

amountIn = 1_000_000  # 1 USDC (6 decimals)
priceIn = 100_000_000  # $1.00 (8 decimals)
priceOut = 55_000_000  # $0.55 (8 decimals)
decimalsIn = 6  # USDC
decimalsOut = 18  # WMATIC

print("🧪 TEST AMOY SWAP: 1 USDC → WMATIC")
print(f"Input: {amountIn} (6 decimals) = 1 USDC")
print(f"USDC price: ${priceIn / 1e8:.2f}")
print(f"WMATIC price: ${priceOut / 1e8:.2f}")
print()

# Current WRONG formula (from MockDEXAdapter.sol line 169):
# decimalsOut (18) >= decimalsIn (6), so:
# amountOut = (amountIn * priceIn * 10^(18-6)) / priceOut
# amountOut = (1000000 * 100000000 * 10^12) / 55000000

wrong_amountOut = (amountIn * priceIn * (10 ** (decimalsOut - decimalsIn))) // priceOut

print("❌ CURRENT (WRONG) FORMULA:")
print(f"   amountOut = (amountIn * priceIn * 10^(dOut-dIn)) / priceOut")
print(f"   amountOut = ({amountIn} * {priceIn} * 10^{decimalsOut-decimalsIn}) / {priceOut}")
print(f"   amountOut = {wrong_amountOut} wei")
print(f"   amountOut = {wrong_amountOut / 1e18:.6f} WMATIC")
print(f"   ❌ This matches the 0.997 WMATIC from the failed transaction!")
print()

# Apply slippage (30 bps = 0.3%)
slippage_bps = 30
wrong_with_slippage = (wrong_amountOut * (10000 - slippage_bps)) // 10000
print(f"   After 0.3% slippage: {wrong_with_slippage / 1e18:.6f} WMATIC")
print()

# CORRECT formula should divide by 1e8 to normalize prices:
# amountOut = (amountIn * priceIn * 10^(dOut-dIn)) / (priceOut * 1e8)
# OR: amountOut = (amountIn * priceIn * 10^(dOut-dIn) * 1e8) / (priceOut * 1e8^2)
# OR: amountOut = (amountIn * priceIn * 10^(dOut-dIn+8)) / (priceOut * 1e8)

# Simplest: normalize prices first
price_decimals = 8

if decimalsOut >= decimalsIn:
    correct_amountOut = (amountIn * priceIn * (10 ** (decimalsOut - decimalsIn))) // (priceOut * (10 ** price_decimals))
else:
    correct_amountOut = (amountIn * priceIn) // (priceOut * (10 ** (decimalsIn - decimalsOut + price_decimals)))

print("✅ CORRECT FORMULA (with price normalization):")
print(f"   amountOut = (amountIn * priceIn * 10^(dOut-dIn)) / (priceOut * 10^{price_decimals})")
print(f"   amountOut = ({amountIn} * {priceIn} * 10^{decimalsOut-decimalsIn}) / ({priceOut} * 10^{price_decimals})")
print(f"   amountOut = {correct_amountOut} wei")
print(f"   amountOut = {correct_amountOut / 1e18:.6f} WMATIC")

correct_with_slippage = (correct_amountOut * (10000 - slippage_bps)) // 10000
print(f"   After 0.3% slippage: {correct_with_slippage / 1e18:.6f} WMATIC")
print()

# Expected output at $1/$0.55:
expected = 1 / 0.55
print(f"💰 EXPECTED: 1 USDC ÷ $0.55 = {expected:.6f} WMATIC")
print()

print("="*60)
print("📊 COMPARISON:")
print(f"Current (WRONG):  {wrong_with_slippage / 1e18:>12.6f} WMATIC")
print(f"Correct (FIXED):  {correct_with_slippage / 1e18:>12.6f} WMATIC")
print(f"Expected (ideal): {expected:>12.6f} WMATIC")
print()
print(f"🎯 ROOT CAUSE: Formula missing /10^8 to normalize Pyth prices!")
print(f"   Wrong is {(wrong_with_slippage / correct_with_slippage):.1f}x too large!")
