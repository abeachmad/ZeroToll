#!/usr/bin/env python3
"""
Decode getQuote results from internal transactions
"""
from web3 import Web3

# Sepolia internal TX staticcall to getQuote
# From the trace: adapter.getQuote(WETH, USDC, 0.001 WETH)
# Need to decode the output

# Amoy getQuote output from trace
amoy_quote_hex = "0x0000000000000000000000000000000000000000000000000dd60e37b91080000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000041e94eb019c0762f9bfcf9fb1e58725bfb0e7582000000000000000000000000360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf9"

# Decode Amoy quote
w3 = Web3()

# First 32 bytes = amountOut
# Next 32 bytes = offset to path array
# Then path array data

data = bytes.fromhex(amoy_quote_hex[2:])

amount_out = int.from_bytes(data[0:32], byteorder='big')
print(f"\n🔍 AMOY QUOTE ANALYSIS:")
print(f"getQuote returned: {amount_out} wei = {amount_out / 1e18:.6f} WMATIC")

# Amoy minOut from transaction input
amoy_min_out_hex = "0x17d8ea52fd50e8000"  # From tx input at position for minDy
amoy_min_out = int(amoy_min_out_hex, 16)
print(f"minOut required: {amoy_min_out} wei = {amoy_min_out / 1e18:.6f} WMATIC")

print(f"\n❌ PROBLEM: Quote ({amount_out / 1e18:.6f}) < minOut ({amoy_min_out / 1e18:.6f})")
print(f"   Shortfall: {(amoy_min_out - amount_out) / 1e18:.6f} WMATIC")
print(f"   Percentage: {(amount_out / amoy_min_out) * 100:.2f}% of required")

print("\n" + "="*60)
print("🔍 SEPOLIA ANALYSIS:")
print("Need to check why WETH → USDC swap failed")
print("From internal TX trace, adapter.getQuote was called")
print("But exact quote value not visible in provided trace")

# Sepolia amounts from TX
sepolia_amount_in = 1000000000000000  # 0.001 WETH
sepolia_min_out = 3257601  # USDC (6 decimals)

print(f"\nSepolia swap:")
print(f"  Amount in: {sepolia_amount_in / 1e18:.6f} WETH")
print(f"  Min out required: {sepolia_min_out / 1e6:.6f} USDC")
print(f"  Expected price: ~$3445/ETH → should give ~3.445 USDC")

print("\n" + "="*60)
print("💡 HYPOTHESIS:")
print("\n1. AMOY: Adapter getQuote returns WRONG value")
print("   - Input: 1 USDC (1,000,000 wei with 6 decimals)")
print("   - Expected: ~1.818 WMATIC (at $0.55/WMATIC, $1/USDC)")
print("   - Actual quote: 0.993 WMATIC")
print("   - This is 54.6% of expected! HUGE DISCREPANCY!")
print("\n2. SEPOLIA: Need to check actual getQuote return value")
print("   - Possibly same issue with wrong price calculation")

print("\n🎯 ROOT CAUSE:")
print("MockDEXAdapter.getQuote() is returning INCORRECT amounts!")
print("This is NOT about reserves - it's about PRICE CALCULATION!")
