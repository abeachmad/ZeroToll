#!/usr/bin/env python3
"""
Try to get the revert reason from the failed transaction
"""

from web3 import Web3

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

# Failed transaction
tx_hash = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"

print(f"Getting revert reason for: {tx_hash}")

try:
    # Try to replay the transaction to get the revert reason
    tx = w3.eth.get_transaction(tx_hash)
    
    # Build a call with the same parameters
    call_params = {
        'from': tx['from'],
        'to': tx['to'],
        'data': tx['input'],
        'value': tx['value'],
        'gas': tx['gas'],
        'gasPrice': tx['gasPrice'],
    }
    
    # Try to call it at the block it was mined
    receipt = w3.eth.get_transaction_receipt(tx_hash)
    block_number = receipt['blockNumber']
    
    print(f"Replaying at block {block_number}...")
    
    try:
        result = w3.eth.call(call_params, block_number)
        print(f"Call succeeded (unexpected!): {result.hex()}")
    except Exception as e:
        error_msg = str(e)
        print(f"\nRevert reason:")
        print(f"{'='*80}")
        print(error_msg)
        print(f"{'='*80}")
        
        # Try to extract the revert string if it's there
        if 'revert' in error_msg.lower():
            print(f"\n🔍 Extracted: {error_msg}")
        
except Exception as e:
    print(f"Error: {e}")

# Also check the logs to see if there's any event data
print(f"\nTransaction Logs:")
print(f"{'='*80}")
receipt = w3.eth.get_transaction_receipt(tx_hash)
if receipt['logs']:
    for i, log in enumerate(receipt['logs']):
        print(f"Log {i}:")
        print(f"  Address: {log['address']}")
        print(f"  Topics: {[t.hex() for t in log['topics']]}")
        print(f"  Data: {log['data'].hex()}")
else:
    print("No logs emitted (transaction reverted)")
