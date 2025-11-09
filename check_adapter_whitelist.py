#!/usr/bin/env python3
"""
Check if MockDEXAdapter is whitelisted in RouterHub
"""

from web3 import Web3
import json

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

routerhub_address = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd"
adapter_address = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"

# Load RouterHub ABI
with open('/home/abeachmad/ZeroToll/packages/contracts/artifacts/contracts/RouterHub.sol/RouterHub.json') as f:
    routerhub_abi = json.load(f)['abi']

routerhub = w3.eth.contract(
    address=Web3.to_checksum_address(routerhub_address),
    abi=routerhub_abi
)

print(f"Checking if MockDEXAdapter is whitelisted in RouterHub")
print(f"{'='*80}")
print(f"RouterHub: {routerhub_address}")
print(f"Adapter: {adapter_address}")
print()

try:
    is_whitelisted = routerhub.functions.whitelistedAdapter(Web3.to_checksum_address(adapter_address)).call()
    
    if is_whitelisted:
        print(f"✅ Adapter IS whitelisted!")
    else:
        print(f"❌ Adapter is NOT whitelisted!")
        print(f"\n🚨 THIS IS THE BUG!")
        print(f"   The RouterHub requires adapters to be whitelisted")
        print(f"   But the MockDEXAdapter was never added to the whitelist")
        print(f"\n💡 SOLUTION:")
        print(f"   Call RouterHub.setAdapter({adapter_address}, true)")
except Exception as e:
    print(f"Error checking whitelist: {e}")
