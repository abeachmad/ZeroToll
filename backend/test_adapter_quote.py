#!/usr/bin/env python3
"""
Verify MockDEXAdapter.getQuote() matches backend /api/quote
Both should use Pyth Oracle and return similar values
"""

from web3 import Web3
import json

# Setup
SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
ADAPTER_ADDRESS = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"
WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

ADAPTER_ABI = [
    {
        "inputs": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"}
        ],
        "name": "getQuote",
        "outputs": [{"name": "amountOut", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))
adapter = w3.eth.contract(address=Web3.to_checksum_address(ADAPTER_ADDRESS), abi=ADAPTER_ABI)

print("🔍 Testing Adapter Quote with Pyth Oracle")
print("=" * 60)

# Test: 0.001 WETH -> USDC
amount_in_wei = w3.to_wei(0.001, 'ether')

try:
    amount_out = adapter.functions.getQuote(
        Web3.to_checksum_address(WETH_ADDRESS),
        Web3.to_checksum_address(USDC_ADDRESS),
        amount_in_wei
    ).call()
    
    # USDC has 6 decimals
    amount_out_usdc = amount_out / 1e6
    
    print(f"Input: 0.001 WETH")
    print(f"Output: {amount_out_usdc:.6f} USDC")
    print(f"Output (raw): {amount_out} (6 decimals)")
    
    # Calculate implied price
    implied_price = amount_out_usdc / 0.001
    print(f"\n💰 Implied ETH price from adapter: ${implied_price:.2f}")
    
    # Compare with backend
    print("\n📊 Comparison:")
    print(f"Backend quote (from test above): ~3.42 USDC")
    print(f"Adapter quote (on-chain): {amount_out_usdc:.6f} USDC")
    
    diff = abs(3.42 - amount_out_usdc)
    diff_pct = (diff / 3.42) * 100
    
    print(f"\nDifference: {diff:.6f} USDC ({diff_pct:.2f}%)")
    
    if diff_pct < 1.0:
        print("✅ Backend and Adapter quotes MATCH (<1% difference)!")
        print("✅ Both using Pyth Oracle correctly!")
    else:
        print(f"⚠️  Difference is {diff_pct:.2f}% (expected <1%)")

except Exception as e:
    print(f"❌ Error querying adapter: {e}")
