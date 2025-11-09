#!/usr/bin/env python3
"""
Check if RouterHub transferred WETH to MockDEXAdapter before calling swap
"""

from web3 import Web3

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

# Transaction details
tx_hash = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"
receipt = w3.eth.get_transaction_receipt(tx_hash)

print(f"Checking internal transactions and logs for: {tx_hash}")
print(f"Status: {'✅ Success' if receipt['status'] == 1 else '❌ Failed'}")
print(f"\n{'='*80}")
print(f"TRANSACTION LOGS (ERC20 Transfers)")
print(f"{'='*80}")

# ERC20 Transfer event signature
transfer_topic = Web3.keccak(text="Transfer(address,address,uint256)").hex()
print(f"Transfer topic: {transfer_topic}")

weth_address = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14".lower()
routerhub_address = "0x15dbf63c4b3df4cf6cfd31701c1d373c6640dadd".lower()
adapter_address = "0x2ed51974196ec8787a74c00c5847f03664d66dc5".lower()
user_address = "0x5a87a3c738cf99db95787d51b627217b6de12f62".lower()

print(f"\nAddresses to watch:")
print(f"  WETH: {weth_address}")
print(f"  RouterHub: {routerhub_address}")
print(f"  MockDEXAdapter: {adapter_address}")
print(f"  User: {user_address}")

if receipt['logs']:
    transfer_count = 0
    for i, log in enumerate(receipt['logs']):
        # Check if it's a Transfer event
        if log['topics'][0].hex() == transfer_topic:
            transfer_count += 1
            token = log['address'].lower()
            from_addr = '0x' + log['topics'][1].hex()[-40:]
            to_addr = '0x' + log['topics'][2].hex()[-40:]
            
            # Decode amount from data
            from eth_abi import decode
            amount = decode(['uint256'], log['data'])[0]
            
            print(f"\nTransfer #{transfer_count}:")
            print(f"  Token: {token}")
            if token == weth_address:
                print(f"    ✅ WETH!")
            print(f"  From: {from_addr}")
            if from_addr.lower() == user_address:
                print(f"    → User")
            elif from_addr.lower() == routerhub_address:
                print(f"    → RouterHub")
            print(f"  To: {to_addr}")
            if to_addr.lower() == adapter_address:
                print(f"    → MockDEXAdapter")
            elif to_addr.lower() == routerhub_address:
                print(f"    → RouterHub")
            print(f"  Amount: {amount} ({amount / 1e18} WETH)")
    
    if transfer_count == 0:
        print("\n❌ NO TRANSFER EVENTS FOUND!")
        print("   This means the transaction reverted BEFORE any tokens were transferred")
        print("   The RouterHub probably never called safeTransfer to the adapter")
else:
    print("❌ NO LOGS! Transaction reverted early")

print(f"\n{'='*80}")
print(f"ALL LOGS (including non-Transfer)")
print(f"{'='*80}")
for i, log in enumerate(receipt['logs']):
    print(f"\nLog {i}:")
    print(f"  Address: {log['address']}")
    print(f"  Topics: {[t.hex() for t in log['topics']]}")
