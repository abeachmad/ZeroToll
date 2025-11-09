#!/usr/bin/env python3
"""
Analyze failed Sepolia transaction in detail
TX: 0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b
"""

from web3 import Web3
import json

# Sepolia RPC
SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

TX_HASH = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"

print("=" * 60)
print("🔍 ANALYZING FAILED SEPOLIA TRANSACTION")
print("=" * 60)
print()

# Get transaction
try:
    tx = w3.eth.get_transaction(TX_HASH)
    print("📋 TRANSACTION DETAILS:")
    print("-" * 60)
    print(f"Hash: {TX_HASH}")
    print(f"From: {tx['from']}")
    print(f"To: {tx['to']}")
    print(f"Value: {Web3.from_wei(tx['value'], 'ether')} ETH")
    print(f"Gas: {tx['gas']}")
    print(f"Gas Price: {Web3.from_wei(tx['gasPrice'], 'gwei')} Gwei")
    print(f"Nonce: {tx['nonce']}")
    print(f"Block: {tx['blockNumber']}")
    print()
    
    # Decode input data
    print("📝 INPUT DATA:")
    print("-" * 60)
    input_data = tx['input']
    print(f"Length: {len(input_data)} bytes")
    print(f"Method ID: {input_data[:10]}")
    print(f"Full data (first 200 chars): {input_data[:200]}...")
    print()
    
except Exception as e:
    print(f"❌ Error getting transaction: {e}")
    exit(1)

# Get transaction receipt
try:
    receipt = w3.eth.get_transaction_receipt(TX_HASH)
    print("📊 TRANSACTION RECEIPT:")
    print("-" * 60)
    print(f"Status: {'✅ Success' if receipt['status'] == 1 else '❌ Failed (Reverted)'}")
    print(f"Gas Used: {receipt['gasUsed']:,}")
    print(f"Effective Gas Price: {Web3.from_wei(receipt['effectiveGasPrice'], 'gwei')} Gwei")
    print(f"Cumulative Gas Used: {receipt['cumulativeGasUsed']:,}")
    print()
    
    # Events/Logs
    print(f"📜 EVENTS ({len(receipt['logs'])} total):")
    print("-" * 60)
    if len(receipt['logs']) == 0:
        print("  ⚠️ NO EVENTS EMITTED (indicates early revert)")
    else:
        for i, log in enumerate(receipt['logs']):
            print(f"  Event {i+1}:")
            print(f"    Address: {log['address']}")
            print(f"    Topics: {len(log['topics'])}")
            if len(log['topics']) > 0:
                print(f"      Topic[0]: {log['topics'][0].hex()}")
    print()
    
except Exception as e:
    print(f"❌ Error getting receipt: {e}")
    exit(1)

# Try to get revert reason
print("🔍 ATTEMPTING TO GET REVERT REASON:")
print("-" * 60)

try:
    # Replay transaction to get revert reason
    call_data = {
        'from': tx['from'],
        'to': tx['to'],
        'data': tx['input'],
        'value': tx['value'],
        'gas': tx['gas']
    }
    
    result = w3.eth.call(call_data, tx['blockNumber'] - 1)
    print(f"  Call result: {result.hex()}")
    
except Exception as e:
    error_msg = str(e)
    print(f"  Revert detected: {error_msg}")
    
    # Try to extract revert reason
    if "execution reverted" in error_msg.lower():
        print()
        print("  🔴 REVERT REASON:")
        # Try to decode error message
        if "0x" in error_msg:
            # Extract hex data
            import re
            hex_match = re.search(r'0x[0-9a-fA-F]+', error_msg)
            if hex_match:
                hex_data = hex_match.group()
                print(f"    Raw: {hex_data}")
                
                # Try to decode as string
                try:
                    if len(hex_data) > 10:
                        # Skip first 4 bytes (function selector) and decode rest
                        decoded = bytes.fromhex(hex_data[10:]).decode('utf-8', errors='ignore')
                        print(f"    Decoded: {decoded}")
                except:
                    pass
        else:
            print(f"    {error_msg}")

print()
print("=" * 60)
print("🎯 ANALYSIS:")
print("-" * 60)

if receipt['status'] == 0:
    print("Transaction FAILED (reverted)")
    print()
    print("Possible causes:")
    print("1. ❓ Token address mismatch")
    print("2. ❓ Insufficient allowance")
    print("3. ❓ Insufficient balance")
    print("4. ❓ Router/Adapter not configured")
    print("5. ❓ Gas limit too low")
    print("6. ❓ Contract logic error")
    print()
    print("We verified:")
    print("✅ User has 0.005982 WETH balance")
    print("✅ User has 0.001 WETH allowance to RouterHub")
    print("✅ Config has correct WETH address")
    print()
    print("Need to check:")
    print("❓ What WETH address was used in THIS transaction?")
    print("❓ Is RouterHub properly deployed on Sepolia?")
    print("❓ Is MockDEXAdapter configured for WETH/USDC pair?")
    
print("=" * 60)
