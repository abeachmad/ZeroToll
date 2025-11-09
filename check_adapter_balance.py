#!/usr/bin/env python3
"""
Check MockDEXAdapter token balances on Sepolia
"""

from web3 import Web3

# Sepolia RPC
SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

ADAPTER = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

# ERC20 ABI
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]

print("=" * 60)
print("🔍 MOCK DEX ADAPTER TOKEN BALANCES (Sepolia)")
print("=" * 60)
print()

weth = w3.eth.contract(address=Web3.to_checksum_address(WETH), abi=ERC20_ABI)
usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC), abi=ERC20_ABI)

# Check balances
weth_balance = weth.functions.balanceOf(Web3.to_checksum_address(ADAPTER)).call()
usdc_balance = usdc.functions.balanceOf(Web3.to_checksum_address(ADAPTER)).call()

weth_decimals = weth.functions.decimals().call()
usdc_decimals = usdc.functions.decimals().call()

weth_balance_human = weth_balance / (10 ** weth_decimals)
usdc_balance_human = usdc_balance / (10 ** usdc_decimals)

print(f"MockDEXAdapter: {ADAPTER}")
print()
print(f"WETH Balance: {weth_balance_human:.6f} WETH")
print(f"  Raw: {weth_balance} wei")
if weth_balance == 0:
    print(f"  ❌ ZERO BALANCE!")
else:
    print(f"  ✅ Has WETH")

print()
print(f"USDC Balance: {usdc_balance_human:.6f} USDC")
print(f"  Raw: {usdc_balance} wei")
if usdc_balance == 0:
    print(f"  ❌ ZERO BALANCE! This is why swap failed!")
    print(f"  ❌ Adapter can't transfer USDC it doesn't have!")
else:
    print(f"  ✅ Has USDC")

print()
print("=" * 60)
print("🎯 ROOT CAUSE:")
print("-" * 60)
if usdc_balance == 0:
    print("MockDEXAdapter has 0 USDC!")
    print()
    print("When user swaps WETH → USDC:")
    print("1. RouterHub transfers WETH to Adapter ✅")
    print("2. Adapter calls swap() ✅")
    print("3. Adapter tries to transfer USDC to user ❌")
    print("4. REVERT: Adapter has no USDC! ❌")
    print()
    print("SOLUTION: Fund MockDEXAdapter with USDC")
else:
    print("MockDEXAdapter has USDC ✅")
    print("Issue must be elsewhere")

print("=" * 60)
