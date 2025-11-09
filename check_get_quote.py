#!/usr/bin/env python3
"""
Check if MockDEXAdapter.getQuote works for WETH→USDC
"""

from web3 import Web3
import json

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

# Load MockDEXAdapter ABI
with open('/home/abeachmad/ZeroToll/packages/contracts/artifacts/contracts/adapters/MockDEXAdapter.sol/MockDEXAdapter.json') as f:
    adapter_abi = json.load(f)['abi']

adapter_address = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
adapter = w3.eth.contract(
    address=Web3.to_checksum_address(adapter_address),
    abi=adapter_abi
)

weth_address = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"
usdc_address = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"
amt_in = 1000000000000000  # 0.001 WETH

print(f"Checking MockDEXAdapter.getQuote()")
print(f"{'='*80}")
print(f"Adapter: {adapter_address}")
print(f"TokenIn (WETH): {weth_address}")
print(f"TokenOut (USDC): {usdc_address}")
print(f"AmountIn: {amt_in} ({amt_in / 1e18} WETH)")
print()

try:
    result = adapter.functions.getQuote(
        Web3.to_checksum_address(weth_address),
        Web3.to_checksum_address(usdc_address),
        amt_in
    ).call()
    
    amount_out = result[0]
    price = result[1]
    
    print(f"✅ Quote successful!")
    print(f"   AmountOut: {amount_out} ({amount_out / 1e6} USDC)")
    print(f"   Price: {price}")
    
    # Check if this meets the minOut requirement
    min_out = 3506262
    print(f"\n   MinOut required: {min_out} ({min_out / 1e6} USDC)")
    
    if amount_out >= min_out:
        print(f"   ✅ Output meets minimum!")
    else:
        print(f"   ❌ Output BELOW minimum!")
        print(f"   🚨 THIS IS WHY THE SWAP FAILS!")
        print(f"   Expected: {min_out / 1e6} USDC")
        print(f"   Got: {amount_out / 1e6} USDC")
        print(f"   Shortfall: {(min_out - amount_out) / 1e6} USDC")
        
except Exception as e:
    print(f"❌ getQuote failed!")
    print(f"Error: {e}")
    print(f"\n🚨 THIS IS WHY THE SWAP FAILS!")
