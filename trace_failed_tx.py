#!/usr/bin/env python3
"""
Deep trace of failed Sepolia transaction
"""

from web3 import Web3
import json

SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

TX_HASH = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"

# Get transaction
tx = w3.eth.get_transaction(TX_HASH)
receipt = w3.eth.get_transaction_receipt(TX_HASH)

print("=" * 70)
print("🔍 TRANSACTION TRACE: Sepolia Swap Failed")
print("=" * 70)

print(f"\n📋 Basic Info:")
print(f"  TX: {TX_HASH}")
print(f"  From: {tx['from']}")
print(f"  To: {tx['to']}")
print(f"  Value: {tx['value']} wei ({Web3.from_wei(tx['value'], 'ether')} ETH)")
print(f"  Gas Limit: {tx['gas']}")
print(f"  Gas Used: {receipt['gasUsed']}")
print(f"  Status: {'✅ Success' if receipt['status'] == 1 else '❌ Failed'}")

print(f"\n📊 Gas Analysis:")
print(f"  Gas Used: {receipt['gasUsed']} / {tx['gas']}")
print(f"  Percentage: {(receipt['gasUsed'] / tx['gas']) * 100:.1f}%")
print(f"  → Early revert (used {receipt['gasUsed']} gas)")

print(f"\n📝 Events/Logs:")
print(f"  Logs Count: {len(receipt['logs'])}")
if len(receipt['logs']) == 0:
    print("  ❌ NO LOGS! Transaction reverted before emitting events")
else:
    for i, log in enumerate(receipt['logs']):
        print(f"  Log {i}: {log['address']}")

# Try to decode input data
input_data = tx['input']
print(f"\n📦 Input Data:")
print(f"  Length: {len(input_data)} chars")
print(f"  Method: {input_data[:10]}")

# Load RouterHub ABI
with open('/home/abeachmad/ZeroToll/packages/contracts/artifacts/contracts/RouterHub.sol/RouterHub.json', 'r') as f:
    router_abi = json.load(f)['abi']

router = w3.eth.contract(address=Web3.to_checksum_address(tx['to']), abi=router_abi)

try:
    func_obj, func_params = router.decode_function_input(input_data)
    
    print(f"\n✅ Decoded Function: {func_obj.fn_name}")
    print(f"\n📋 Parameters:")
    
    if 'intent' in func_params:
        intent = func_params['intent']
        print(f"\n  Intent Structure:")
        print(f"    senderEOA: {intent[0]}")
        print(f"    tokenIn: {intent[1]}")
        print(f"    amtIn: {intent[2]} wei ({Web3.from_wei(intent[2], 'ether')} tokens)")
        print(f"    tokenOut: {intent[3]}")
        print(f"    amtOutMin: {intent[4]} wei")
        print(f"    chaindId: {intent[5]}")
        print(f"    recipient: {intent[6]}")
        print(f"    deadline: {intent[7]}")
        print(f"    nonce: {intent[8]}")
        
        # Identify tokens
        WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
        USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
        
        if intent[1].lower() == WETH.lower():
            print(f"\n    → TokenIn: WETH ✅")
        else:
            print(f"\n    → TokenIn: {intent[1]} ⚠️ NOT WETH!")
            
        if intent[3].lower() == USDC.lower():
            print(f"    → TokenOut: USDC ✅")
        else:
            print(f"    → TokenOut: {intent[3]} ⚠️ NOT USDC!")
    
    if 'signature' in func_params:
        sig = func_params['signature']
        print(f"\n  Signature: {sig.hex()[:20]}... (length: {len(sig)} bytes)")
        
    if 'adapter' in func_params:
        adapter = func_params['adapter']
        print(f"\n  Adapter: {adapter}")
        MOCK_DEX = "0x2Ed51974196EC8787a74c00C5847F03664d66Dc5"
        if adapter.lower() == MOCK_DEX.lower():
            print(f"    → MockDEXAdapter ✅")
        else:
            print(f"    → ⚠️ NOT MockDEXAdapter!")

except Exception as e:
    print(f"\n❌ Decode failed: {e}")
    print(f"\nRaw input: {input_data[:200]}...")

print("\n" + "=" * 70)
print("🎯 CONCLUSION:")
print("-" * 70)
print("Transaction reverted with:")
print("  • 0 logs/events")
print("  • Early gas usage (110k / 500k)")
print("  • No successful token transfers")
print()
print("This suggests revert in MockDEXAdapter.swap() BEFORE transfer")
print("=" * 70)
