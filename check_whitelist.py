#!/usr/bin/env python3
"""
Check if MockDEXAdapter is whitelisted in RouterHub on Sepolia
"""

from web3 import Web3
import json

SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

ROUTER_HUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd"
MOCK_DEX = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"

# Load RouterHub ABI
with open('/home/abeachmad/ZeroToll/packages/contracts/artifacts/contracts/RouterHub.sol/RouterHub.json', 'r') as f:
    router_abi = json.load(f)['abi']

router = w3.eth.contract(address=Web3.to_checksum_address(ROUTER_HUB), abi=router_abi)

print("=" * 60)
print("🔍 CHECKING ADAPTER WHITELIST (Sepolia)")
print("=" * 60)
print()
print(f"RouterHub: {ROUTER_HUB}")
print(f"MockDEXAdapter: {MOCK_DEX}")
print()

# Check if adapter is whitelisted
is_whitelisted = router.functions.whitelistedAdapter(Web3.to_checksum_address(MOCK_DEX)).call()

print(f"Whitelisted: {is_whitelisted}")

if is_whitelisted:
    print("  ✅ MockDEXAdapter IS whitelisted")
    print("  ✅ Can use this adapter for swaps")
else:
    print("  ❌ MockDEXAdapter NOT whitelisted!")
    print("  ❌ RouterHub will reject all swaps using this adapter!")
    print()
    print("  🎯 ROOT CAUSE FOUND!")
    print("  → Transaction fails at line 44: require(whitelistedAdapter[adapter])")
    print()
    print("  SOLUTION: Whitelist the adapter")
    print("  Command: await routerHub.setAdapterWhitelist(mockDEX.address, true)")

print()
print("=" * 60)
