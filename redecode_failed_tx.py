#!/usr/bin/env python3
"""
Re-fetch and decode the ACTUAL failed transaction from Sepolia
"""

from web3 import Web3
from eth_abi import decode
import json

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

# Failed transaction hash
tx_hash = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"

print(f"Fetching transaction: {tx_hash}")
tx = w3.eth.get_transaction(tx_hash)
receipt = w3.eth.get_transaction_receipt(tx_hash)

print(f"\n{'='*80}")
print(f"TRANSACTION DETAILS")
print(f"{'='*80}")
print(f"From: {tx['from']}")
print(f"To: {tx['to']} (RouterHub)")
print(f"Status: {'✅ Success' if receipt['status'] == 1 else '❌ Failed'}")
print(f"Gas Used: {receipt['gasUsed']}")
print(f"Block: {receipt['blockNumber']}")

# Decode input data
input_data = tx['input']
print(f"\nInput data length: {len(input_data)} bytes")
print(f"Input data: {input_data.hex()[:200]}...")

# RouterHub.executeRoute signature
# function executeRoute(Intent memory intent, address adapter, bytes calldata routeData)
selector = input_data[:4]
print(f"\nFunction selector: {selector.hex()}")

# Expected selector for executeRoute
expected_selector = Web3.keccak(text="executeRoute((address,address,uint256,address,uint256,uint256,uint256,address,uint8,uint256,bytes,uint256),address,bytes)")[:4]
print(f"Expected selector: {expected_selector.hex()}")

if selector != expected_selector:
    print("❌ SELECTOR MISMATCH!")
else:
    print("✅ Selector matches")

# Decode the parameters
# Struct Intent {
#   address user;
#   address tokenIn;
#   uint256 amtIn;
#   address tokenOut;
#   uint256 minOut;
#   uint256 dstChainId;
#   uint256 deadline;
#   address feeToken;
#   FeeMode feeMode;
#   uint256 feeCapToken;
#   bytes routeHint;
#   uint256 nonce;
# }
# Then: address adapter
# Then: bytes routeData

params = input_data[4:]

try:
    # Decode the top-level parameters
    # (tuple, address, bytes)
    decoded = decode(
        ['(address,address,uint256,address,uint256,uint256,uint256,address,uint8,uint256,bytes,uint256)', 'address', 'bytes'],
        params
    )
    
    intent_tuple = decoded[0]
    adapter_address = decoded[1]
    route_data = decoded[2]
    
    print(f"\n{'='*80}")
    print(f"DECODED INTENT STRUCT")
    print(f"{'='*80}")
    print(f"user: {intent_tuple[0]}")
    print(f"tokenIn: {intent_tuple[1]}")
    print(f"amtIn: {intent_tuple[2]} ({intent_tuple[2] / 1e18} tokens)")
    print(f"tokenOut: {intent_tuple[3]}")
    print(f"minOut: {intent_tuple[4]} ({intent_tuple[4] / 1e6} USDC)")
    print(f"dstChainId: {intent_tuple[5]}")
    print(f"deadline: {intent_tuple[6]}")
    print(f"feeToken: {intent_tuple[7]}")
    print(f"feeMode: {intent_tuple[8]}")
    print(f"feeCapToken: {intent_tuple[9]}")
    print(f"routeHint: {intent_tuple[10].hex()}")
    print(f"nonce: {intent_tuple[11]}")
    
    print(f"\n{'='*80}")
    print(f"ADAPTER AND ROUTE DATA")
    print(f"{'='*80}")
    print(f"Adapter: {adapter_address}")
    print(f"RouteData length: {len(route_data)} bytes")
    print(f"RouteData: {route_data.hex()}")
    
    # Decode routeData (should be swap() call)
    if len(route_data) >= 4:
        swap_selector = route_data[:4]
        swap_params = route_data[4:]
        
        print(f"\nSwap selector: {swap_selector.hex()}")
        expected_swap_selector = Web3.keccak(text="swap(address,address,uint256,uint256,address,uint256)")[:4]
        print(f"Expected swap selector: {expected_swap_selector.hex()}")
        
        if swap_selector == expected_swap_selector:
            print("✅ Swap selector matches")
            
            # Decode swap parameters
            swap_decoded = decode(
                ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
                swap_params
            )
            
            print(f"\n{'='*80}")
            print(f"DECODED SWAP PARAMETERS")
            print(f"{'='*80}")
            print(f"tokenIn: {swap_decoded[0]}")
            print(f"tokenOut: {swap_decoded[1]}")
            print(f"amountIn: {swap_decoded[2]} ({swap_decoded[2] / 1e18} WETH)")
            print(f"minAmountOut: {swap_decoded[3]} ({swap_decoded[3] / 1e6} USDC)")
            print(f"recipient: {swap_decoded[4]}")
            print(f"deadline: {swap_decoded[5]}")
            
            # Check if deadline is valid
            import time
            current_time = int(time.time())
            if swap_decoded[5] >= current_time:
                print(f"\n⚠️ Deadline is VALID NOW (but may have been expired at tx time)")
                print(f"  Current time: {current_time}")
                print(f"  Deadline: {swap_decoded[5]}")
                print(f"  Diff: {swap_decoded[5] - current_time} seconds")
            else:
                print(f"\n❌ Deadline is EXPIRED")
                print(f"  Current time: {current_time}")
                print(f"  Deadline: {swap_decoded[5]}")
                print(f"  Expired: {current_time - swap_decoded[5]} seconds ago")
                
                # If deadline is a small number like 26961, it's clearly wrong
                if swap_decoded[5] < 100000:
                    print(f"\n🚨 DEADLINE VALUE TOO SMALL! ({swap_decoded[5]})")
                    print(f"   This is clearly NOT a Unix timestamp!")
                    print(f"   Expected value: ~1762594450 (current time)")
                    print(f"   Actual value: {swap_decoded[5]}")
        else:
            print("❌ Swap selector doesn't match!")
    
except Exception as e:
    print(f"Error decoding: {e}")
    import traceback
    traceback.print_exc()
