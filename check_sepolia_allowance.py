#!/usr/bin/env python3
"""
Check WETH allowance and balance on Sepolia for failed transaction debugging
"""

from web3 import Web3
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Sepolia RPC - Use public RPC
SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
print(f"Using RPC: {SEPOLIA_RPC}")
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

# Addresses
USER = "0x5a87A3c738cf99DB95787D51B627217B6dE12F62"
ROUTERHUB = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd"
# CORRECT WETH address from Etherscan!
WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"  # FIXED!
USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

# ERC20 ABI (minimal)
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function"
    },
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
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    }
]

print("=" * 60)
print("🔍 SEPOLIA FAILED TRANSACTION DEBUGGING")
print("=" * 60)
print()

# Check connection
if not w3.is_connected():
    print("❌ Failed to connect to Sepolia RPC")
    exit(1)

print(f"✅ Connected to Sepolia")
print(f"   Block: {w3.eth.block_number}")
print()

# WETH Contract
weth = w3.eth.contract(address=Web3.to_checksum_address(WETH), abi=ERC20_ABI)
usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC), abi=ERC20_ABI)

print("📋 TOKEN INFORMATION:")
print("-" * 60)
try:
    weth_symbol = weth.functions.symbol().call()
    weth_decimals = weth.functions.decimals().call()
    print(f"WETH: {WETH}")
    print(f"  Symbol: {weth_symbol}")
    print(f"  Decimals: {weth_decimals}")
except Exception as e:
    print(f"❌ Error reading WETH info: {e}")

print()

try:
    usdc_symbol = usdc.functions.symbol().call()
    usdc_decimals = usdc.functions.decimals().call()
    print(f"USDC: {USDC}")
    print(f"  Symbol: {usdc_symbol}")
    print(f"  Decimals: {usdc_decimals}")
except Exception as e:
    print(f"❌ Error reading USDC info: {e}")

print()
print("=" * 60)
print("🔍 USER BALANCES:")
print("-" * 60)

# Check WETH balance
try:
    weth_balance = weth.functions.balanceOf(Web3.to_checksum_address(USER)).call()
    weth_balance_human = weth_balance / (10 ** weth_decimals)
    print(f"WETH Balance: {weth_balance_human:.6f} WETH")
    print(f"  Raw: {weth_balance} wei")
    
    swap_amount = 1000000000000000  # 0.001 WETH
    swap_amount_human = swap_amount / (10 ** weth_decimals)
    
    if weth_balance >= swap_amount:
        print(f"  ✅ Sufficient for 0.001 WETH swap")
    else:
        print(f"  ❌ INSUFFICIENT! Need {swap_amount_human} WETH, have {weth_balance_human}")
except Exception as e:
    print(f"❌ Error checking WETH balance: {e}")

print()

# Check USDC balance
try:
    usdc_balance = usdc.functions.balanceOf(Web3.to_checksum_address(USER)).call()
    usdc_balance_human = usdc_balance / (10 ** usdc_decimals)
    print(f"USDC Balance: {usdc_balance_human:.6f} USDC")
    print(f"  Raw: {usdc_balance} wei")
except Exception as e:
    print(f"❌ Error checking USDC balance: {e}")

print()
print("=" * 60)
print("🔍 ALLOWANCES TO ROUTERHUB:")
print("-" * 60)

# Check WETH allowance
try:
    weth_allowance = weth.functions.allowance(
        Web3.to_checksum_address(USER), 
        Web3.to_checksum_address(ROUTERHUB)
    ).call()
    weth_allowance_human = weth_allowance / (10 ** weth_decimals)
    
    print(f"WETH Allowance to RouterHub:")
    print(f"  {weth_allowance_human:.18f} WETH")
    print(f"  Raw: {weth_allowance} wei")
    
    swap_amount = 1000000000000000  # 0.001 WETH
    
    if weth_allowance == 0:
        print(f"  🔴 ZERO ALLOWANCE! This is likely the issue!")
        print(f"  ❌ User needs to approve WETH to RouterHub")
    elif weth_allowance < swap_amount:
        print(f"  ⚠️ INSUFFICIENT ALLOWANCE!")
        print(f"  ❌ Need: 0.001 WETH ({swap_amount} wei)")
        print(f"  ❌ Have: {weth_allowance_human} WETH ({weth_allowance} wei)")
    else:
        print(f"  ✅ Sufficient allowance for 0.001 WETH swap")
        
except Exception as e:
    print(f"❌ Error checking WETH allowance: {e}")

print()

# Check USDC allowance (informational)
try:
    usdc_allowance = usdc.functions.allowance(
        Web3.to_checksum_address(USER), 
        Web3.to_checksum_address(ROUTERHUB)
    ).call()
    usdc_allowance_human = usdc_allowance / (10 ** usdc_decimals)
    
    print(f"USDC Allowance to RouterHub (for reference):")
    print(f"  {usdc_allowance_human:.6f} USDC")
    print(f"  Raw: {usdc_allowance} wei")
except Exception as e:
    print(f"❌ Error checking USDC allowance: {e}")

print()
print("=" * 60)
print("📊 DIAGNOSIS:")
print("-" * 60)

# Diagnosis
if weth_balance >= swap_amount and weth_allowance == 0:
    print("🔴 ROOT CAUSE IDENTIFIED:")
    print("   - User HAS sufficient WETH balance ✅")
    print("   - User has ZERO allowance to RouterHub ❌")
    print()
    print("💡 SOLUTION:")
    print("   1. User must approve WETH to RouterHub on Sepolia")
    print("   2. Use frontend 'Approve WETH' button")
    print("   3. Or run manual approval transaction")
    print()
    print("   Manual Approval Command:")
    print(f"   w3.eth.send_transaction({{")
    print(f"     'from': '{USER}',")
    print(f"     'to': '{WETH}',")
    print(f"     'data': weth.encodeABI(fn_name='approve',")
    print(f"             args=['{ROUTERHUB}', {swap_amount}])")
    print(f"   }})")
elif weth_balance < swap_amount:
    print("❌ ROOT CAUSE: Insufficient WETH balance")
    print(f"   Need: 0.001 WETH")
    print(f"   Have: {weth_balance_human} WETH")
elif weth_allowance < swap_amount:
    print("⚠️ ROOT CAUSE: Insufficient allowance")
    print(f"   Need: 0.001 WETH allowance")
    print(f"   Have: {weth_allowance_human} WETH allowance")
else:
    print("🤔 Balance and allowance are OK")
    print("   Issue might be elsewhere:")
    print("   - Contract deployment")
    print("   - Token pair not supported")
    print("   - Gas limit")
    print("   - Other contract logic")

print("=" * 60)
