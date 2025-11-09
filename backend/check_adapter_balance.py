#!/usr/bin/env python3
"""
Check MockDEXAdapter USDC reserves
"""

from web3 import Web3

SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
ADAPTER_ADDRESS = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"
USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))
usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC_ADDRESS), abi=ERC20_ABI)

balance_raw = usdc.functions.balanceOf(Web3.to_checksum_address(ADAPTER_ADDRESS)).call()
balance = balance_raw / 1e6  # USDC has 6 decimals

print(f"MockDEXAdapter USDC Balance: {balance:.6f} USDC")

if balance >= 10:
    print(f"✅ Sufficient reserves ({balance:.2f} USDC)")
else:
    print(f"⚠️  Low reserves ({balance:.2f} USDC) - may need to fund adapter")
