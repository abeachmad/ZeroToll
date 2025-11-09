#!/usr/bin/env python3
"""
Test if backend quote matches MockDEXAdapter quote after price sync
"""

from web3 import Web3
import json
import requests

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

# Load MockDEXAdapter ABI
with open('/home/abeachmad/ZeroToll/packages/contracts/artifacts/contracts/adapters/MockDEXAdapter.sol/MockDEXAdapter.json') as f:
    adapter_abi = json.load(f)['abi']

# New adapter address (with synced prices)
adapter_address = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301"
adapter = w3.eth.contract(
    address=Web3.to_checksum_address(adapter_address),
    abi=adapter_abi
)

weth_address = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"
usdc_address = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"
amt_in = 1000000000000000  # 0.001 WETH

print(f"Testing Quote Sync")
print(f"{'='*80}")
print(f"Input: 0.001 WETH → USDC")
print()

# 1. Get quote from MockDEXAdapter (on-chain)
print(f"1. MockDEXAdapter.getQuote() (on-chain)")
print(f"   Address: {adapter_address}")
adapter_quote = adapter.functions.getQuote(
    Web3.to_checksum_address(weth_address),
    Web3.to_checksum_address(usdc_address),
    amt_in
).call()
adapter_amount_out = adapter_quote[0]
print(f"   Output: {adapter_amount_out} ({adapter_amount_out / 1e6:.6f} USDC)")

# 2. Get quote from backend /api/quote
print(f"\n2. Backend /api/quote")
backend_response = requests.post('http://localhost:8000/api/quote', json={
    "intent": {
        "user": "0x5a87a3c738cf99db95787d51b627217b6de12f62",
        "tokenIn": "WETH",
        "amtIn": 0.001,
        "tokenOut": "USDC",
        "minOut": 0.5,  # Dummy value, just to pass validation
        "srcChainId": 11155111,
        "dstChainId": 11155111,
        "feeMode": "INPUT",
        "feeCap": 0.1,
        "deadline": 9999999999,
        "nonce": 1
    }
})

backend_data = backend_response.json()
if backend_data.get('success') and backend_data.get('netOut'):
    backend_amount_out = backend_data['netOut']
    print(f"   Output: {backend_amount_out:.6f} USDC")
else:
    print(f"   ❌ Backend quote failed: {backend_data}")
    backend_amount_out = 0

# 3. Compare
print(f"\n{'='*80}")
print(f"COMPARISON:")
print(f"{'='*80}")
print(f"Adapter quote:  {adapter_amount_out / 1e6:.6f} USDC")
print(f"Backend quote:  {backend_amount_out:.6f} USDC")

diff = abs(adapter_amount_out / 1e6 - backend_amount_out)
diff_pct = (diff / (adapter_amount_out / 1e6)) * 100 if adapter_amount_out > 0 else 0

print(f"\nDifference: {diff:.6f} USDC ({diff_pct:.2f}%)")

if diff_pct < 1.0:
    print(f"\n✅ QUOTES MATCH! (< 1% difference)")
    print(f"   Slippage protection should now work correctly")
else:
    print(f"\n❌ QUOTES STILL MISMATCH! (> 1% difference)")
    print(f"   Need to debug further")

# 4. Calculate expected minOut for swap
min_out_with_slippage = (adapter_amount_out / 1e6) * 0.95  # 5% slippage tolerance
print(f"\n📋 For swap execution:")
print(f"   Expected output: {adapter_amount_out / 1e6:.6f} USDC")
print(f"   MinOut (5% slippage): {min_out_with_slippage:.6f} USDC")
print(f"   MinOut (wei): {int(min_out_with_slippage * 1e6)}")
