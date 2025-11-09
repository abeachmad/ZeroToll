#!/usr/bin/env python3
"""
Decode failed transaction input data to see what parameters were sent
"""

from web3 import Web3
from eth_abi import decode

# Failed Sepolia TX
TX_HASH = "0xc9d4e0cb8695b07f2ec120f0beb36cf277e43093b713e5e203d2096cc88b19c7"
SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"

w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

print("=" * 80)
print(f"DECODING FAILED TRANSACTION: {TX_HASH}")
print("=" * 80)

tx = w3.eth.get_transaction(TX_HASH)

print(f"\nFrom: {tx['from']}")
print(f"To (RouterHub): {tx['to']}")
print(f"Value: {tx['value']} wei")
print(f"Gas: {tx['gas']}")
print(f"Gas Price: {tx['gasPrice']} wei")

# Decode input data
input_data = tx['input']
print(f"\nInput data length: {len(input_data)} bytes")
print(f"Method ID: {input_data[:10]}")  # First 4 bytes

# executeIntent function signature: 0xe60269c6
if input_data[:10] == '0xe60269c6':
    print("✅ Method: executeIntent(Intent calldata intent)")
    
    # Intent struct breakdown (from logs):
    # user: 0x5a87A3c738cf99DB95787D51B627217B6dE12F62
    # tokenIn: WETH (0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14)
    # amtIn: 0.001 WETH = 1000000000000000 wei
    # tokenOut: USDC (0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
    # minOut: 3.257601 USDC = 3257601 (6 decimals)
    
    print("\nExpected Intent from logs:")
    print("  user: 0x5a87A3c738cf99DB95787D51B627217B6dE12F62")
    print("  tokenIn: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14 (WETH)")
    print("  amtIn: 1000000000000000 (0.001 WETH)")
    print("  tokenOut: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (USDC)")
    print("  minOut: 3257601 (3.257601 USDC with 6 decimals)")
    print("  dstChainId: 11155111 (Sepolia)")
    print("  deadline: 1762599260")
    print("  feeMode: INPUT")
    print("  feeToken: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14 (WETH)")

    # Check transaction receipt for revert reason
    receipt = w3.eth.get_transaction_receipt(TX_HASH)
    print(f"\n📊 Transaction Receipt:")
    print(f"  Status: {receipt['status']}")  # 0 = failed
    print(f"  Gas Used: {receipt['gasUsed']}")
    print(f"  Logs: {len(receipt['logs'])} events")
    
    if receipt['status'] == 0:
        print("\n❌ Transaction REVERTED")
        print(f"  Gas used: {receipt['gasUsed']} / {tx['gas']}")
        
        # Try to get revert reason
        try:
            w3.eth.call({
                'from': tx['from'],
                'to': tx['to'],
                'data': tx['input'],
                'value': tx['value']
            }, tx['blockNumber'] - 1)
        except Exception as e:
            print(f"\n🔴 Revert reason: {str(e)}")
            
            # Check if it's a slippage issue
            if "Insufficient output" in str(e):
                print("\n💡 CAUSE: Slippage check failed in adapter!")
                print("   Adapter returned less than minOut")
            elif "Adapter call failed" in str(e):
                print("\n💡 CAUSE: Adapter call failed!")
                print("   Something went wrong inside the adapter")
            elif "ERC20: transfer amount exceeds balance" in str(e):
                print("\n💡 CAUSE: Insufficient balance!")
            elif "ERC20: transfer amount exceeds allowance" in str(e):
                print("\n💡 CAUSE: Insufficient allowance!")

print("\n" + "=" * 80)
