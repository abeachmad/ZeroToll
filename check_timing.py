#!/usr/bin/env python3
"""
Check transaction timing to see why deadline expired
"""

from web3 import Web3
from datetime import datetime

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

# Failed transaction
tx_hash = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"
tx = w3.eth.get_transaction(tx_hash)
receipt = w3.eth.get_transaction_receipt(tx_hash)
block = w3.eth.get_block(receipt['blockNumber'])

print(f"Transaction: {tx_hash}")
print(f"\nTiming Analysis:")
print(f"{'='*80}")

# Decode deadline from transaction
from eth_abi import decode
input_data = tx['input']
params = input_data[4:]
decoded = decode(
    ['(address,address,uint256,address,uint256,uint256,uint256,address,uint8,uint256,bytes,uint256)', 'address', 'bytes'],
    params
)
intent_tuple = decoded[0]
route_data = decoded[2]

# Get deadline from routeData
swap_params = route_data[4:]
swap_decoded = decode(
    ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
    swap_params
)
deadline = swap_decoded[5]
intent_deadline = intent_tuple[6]

block_timestamp = block['timestamp']

print(f"Intent deadline: {intent_deadline} ({datetime.fromtimestamp(intent_deadline)})")
print(f"RouteData deadline: {deadline} ({datetime.fromtimestamp(deadline)})")
print(f"Block timestamp: {block_timestamp} ({datetime.fromtimestamp(block_timestamp)})")
print(f"Block number: {receipt['blockNumber']}")

time_diff = block_timestamp - deadline
print(f"\n⏰ Deadline vs Block Time:")
if time_diff > 0:
    print(f"   Deadline EXPIRED by {time_diff} seconds ({time_diff / 60:.1f} minutes)")
    print(f"   ❌ Transaction was mined AFTER deadline")
else:
    print(f"   Deadline was {abs(time_diff)} seconds in the future")
    print(f"   ✅ Transaction was mined BEFORE deadline")

# Check if deadlines match
if intent_deadline == deadline:
    print(f"\n✅ Intent deadline matches routeData deadline")
else:
    print(f"\n❌ MISMATCH!")
    print(f"   Intent deadline: {intent_deadline}")
    print(f"   RouteData deadline: {deadline}")
    print(f"   Difference: {abs(intent_deadline - deadline)} seconds")

# When was the transaction created?
print(f"\n📊 Deadline window:")
print(f"   Created at: ~{datetime.fromtimestamp(deadline - 600)} (estimated)")
print(f"   Deadline: {datetime.fromtimestamp(deadline)}")
print(f"   Mined at: {datetime.fromtimestamp(block_timestamp)}")
print(f"   Window: 600 seconds (10 minutes)")
print(f"   Time from creation to mining: {block_timestamp - (deadline - 600)} seconds")

if (block_timestamp - (deadline - 600)) > 600:
    print(f"\n❌ Transaction took TOO LONG to mine!")
    print(f"   It should have been mined within 10 minutes")
    print(f"   But it took ~{(block_timestamp - (deadline - 600)) / 60:.1f} minutes")
