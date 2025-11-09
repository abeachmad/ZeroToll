#!/usr/bin/env python3
"""
Test routeData encoding/decoding to find the bug
"""

from web3 import Web3
from eth_abi import encode, decode
from datetime import datetime

# Set up deadline (10 minutes from now)
deadline = int(datetime.now().timestamp()) + 600
print(f"Current timestamp: {int(datetime.now().timestamp())}")
print(f"Deadline: {deadline}")
print(f"Expires in: {deadline - int(datetime.now().timestamp())} seconds")

# Test parameters (from Sepolia failed swap)
token_in = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"  # WETH
token_out = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"  # USDC
amt_in_wei = 1000000000000000  # 0.001 WETH
min_out_wei = 3506262  # ~3.506 USDC
router_hub_address = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd"

print(f"\nEncoding parameters:")
print(f"  tokenIn: {token_in}")
print(f"  tokenOut: {token_out}")
print(f"  amountIn: {amt_in_wei}")
print(f"  minAmountOut: {min_out_wei}")
print(f"  recipient: {router_hub_address}")
print(f"  deadline: {deadline}")

# Build swap selector
swap_selector = Web3.keccak(text="swap(address,address,uint256,uint256,address,uint256)")[:4]
print(f"\nSwap selector: {swap_selector.hex()}")

# Encode parameters (EXACTLY as server.py does)
route_data_params = encode(
    ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
    [
        Web3.to_checksum_address(token_in),
        Web3.to_checksum_address(token_out),
        int(amt_in_wei),
        int(min_out_wei),
        Web3.to_checksum_address(router_hub_address),
        deadline
    ]
)

route_data = swap_selector + route_data_params
print(f"\nEncoded route_data: {route_data.hex()}")
print(f"Length: {len(route_data)} bytes")

# Now decode to verify
print("\n" + "="*80)
print("DECODING TO VERIFY:")
print("="*80)

# Skip first 4 bytes (selector)
params_hex = route_data[4:]

decoded = decode(
    ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
    params_hex
)

print(f"\nDecoded parameters:")
print(f"  tokenIn: {decoded[0]}")
print(f"  tokenOut: {decoded[1]}")
print(f"  amountIn: {decoded[2]} ({decoded[2] / 1e18} WETH)")
print(f"  minAmountOut: {decoded[3]} ({decoded[3] / 1e6} USDC)")
print(f"  recipient: {decoded[4]}")
print(f"  deadline: {decoded[5]}")

# Check if deadline is valid
current_time = int(datetime.now().timestamp())
if decoded[5] >= current_time:
    print(f"\n✅ Deadline is VALID (expires in {decoded[5] - current_time} seconds)")
else:
    print(f"\n❌ Deadline is EXPIRED (expired {current_time - decoded[5]} seconds ago)")

# Compare with failed transaction's routeData
print("\n" + "="*80)
print("FAILED TRANSACTION ANALYSIS:")
print("="*80)
print("According to summary, failed transaction had:")
print("  deadline: 26961 (EXPIRED)")
print("  amountIn: 62500000000000 (0.0000625 WETH) - WRONG!")
print("  recipient: 0x0000000000000000000000000000000000000000 - WRONG!")
print("\nThis suggests the backend did NOT use the code from server.py!")
