#!/usr/bin/env python3
"""
Decode transaction input data to see actual parameters used
"""

from web3 import Web3
from eth_abi import decode

# Sepolia RPC
SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

TX_HASH = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"

# Get transaction
tx = w3.eth.get_transaction(TX_HASH)
input_data = tx['input']

print("=" * 80)
print("🔍 DECODING TRANSACTION INPUT DATA")
print("=" * 80)
print()

# Method ID
method_id = input_data[:10]
print(f"Method ID: {method_id}")
print()

# Decode parameters (RouterHub.executeIntent signature)
# function executeIntent(Intent calldata intent, bytes calldata routeData, address relayer, bytes calldata relayerSig)

# Remove method ID (first 4 bytes = 10 chars including 0x)
params_data = input_data[10:]

print(f"Parameters length: {len(params_data)} hex chars")
print()

# Manual decoding since we know the structure
params_hex = params_data.hex()

# Parse Intent struct
print("📋 INTENT STRUCT (from transaction):")
print("-" * 80)

# Intent has these fields:
# - user (address)
# - tokenIn (address)  
# - amtIn (uint256)
# - tokenOut (address)
# - minOut (uint256)
# - dstChainId (uint256)
# - feeMode (uint8)
# - feeCap (uint256)
# - deadline (uint256)
# - nonce (uint256)

try:
    # Offset to Intent struct start (skip dynamic type offsets)
    offset = 0
    
    # Skip first offset (points to Intent struct)
    offset += 64  # 32 bytes = 64 hex chars
    
    # Skip second offset (points to routeData)
    offset += 64
    
    # Skip third parameter (relayer address, padded to 32 bytes)
    relayer_hex = params_hex[offset:offset+64]
    relayer = "0x" + relayer_hex[-40:]
    print(f"Relayer: {relayer}")
    offset += 64
    
    # Skip fourth offset (points to relayerSig)
    offset += 64
    
    # Now read Intent struct data
    # First: length of Intent
    intent_offset = int(params_hex[0:64], 16) * 2  # Convert to hex char offset
    
    print()
    print("Intent struct data:")
    
    # User address (offset 32 bytes)
    user_hex = params_hex[intent_offset+64:intent_offset+128]
    user = "0x" + user_hex[-40:]
    print(f"  User: {user}")
    
    # TokenIn address
    tokenin_hex = params_hex[intent_offset+128:intent_offset+192]
    tokenin = "0x" + tokenin_hex[-40:]
    print(f"  TokenIn: {tokenin}")
    
    # Check which WETH this is
    if tokenin.lower() == "0xfff9976782d46cc05630d1f6ebab18b2324d6b14":
        print(f"    ✅ CORRECT WETH address!")
    elif tokenin.lower() == "0x7b79995e5f793a07bc00c21412e50ecae098e7f9":
        print(f"    ❌ WRONG WETH address (old/incorrect)")
    else:
        print(f"    ❓ Unknown token address")
    
    # AmtIn
    amtin_hex = params_hex[intent_offset+192:intent_offset+256]
    amtin = int(amtin_hex, 16)
    amtin_eth = amtin / 1e18
    print(f"  AmtIn: {amtin} wei ({amtin_eth} WETH)")
    
    # TokenOut address
    tokenout_hex = params_hex[intent_offset+256:intent_offset+320]
    tokenout = "0x" + tokenout_hex[-40:]
    print(f"  TokenOut: {tokenout}")
    
    # Check if USDC
    if tokenout.lower() == "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238":
        print(f"    ✅ Correct USDC address")
    
    # MinOut
    minout_hex = params_hex[intent_offset+320:intent_offset+384]
    minout = int(minout_hex, 16)
    minout_usdc = minout / 1e6
    print(f"  MinOut: {minout} wei ({minout_usdc} USDC)")
    
    # DstChainId
    chainid_hex = params_hex[intent_offset+384:intent_offset+448]
    chainid = int(chainid_hex, 16)
    print(f"  DstChainId: {chainid}")
    
    if chainid == 11155111:
        print(f"    ✅ Sepolia (same-chain swap)")
    
    print()
    
except Exception as e:
    print(f"Error decoding: {e}")
    import traceback
    traceback.print_exc()

print("=" * 80)
