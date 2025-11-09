#!/usr/bin/env python3
"""
Try to simulate the failed transaction to get the actual revert reason
"""

from web3 import Web3
from eth_abi import decode, encode
import json

# Connect to Sepolia
w3 = Web3(Web3.HTTPProvider('https://ethereum-sepolia-rpc.publicnode.com'))

# Load RouterHub ABI
with open('/home/abeachmad/ZeroToll/packages/contracts/artifacts/contracts/RouterHub.sol/RouterHub.json') as f:
    routerhub_abi = json.load(f)['abi']

routerhub_address = "0x15dbf63c4B3Df4CF6Cfd31701C1D373c6640DADd"
routerhub = w3.eth.contract(
    address=Web3.to_checksum_address(routerhub_address),
    abi=routerhub_abi
)

# Transaction details from the failed TX
user_address = "0x5a87a3c738cf99db95787d51b627217b6de12f62"
token_in = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14"  # WETH
amt_in = 1000000000000000  # 0.001 WETH
token_out = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"  # USDC
min_out = 3506262
dst_chain_id = 11155111
deadline = int(w3.eth.get_block('latest')['timestamp']) + 600  # Fresh deadline
fee_token = token_in
fee_mode = 1
fee_cap_token = 10000000000000000
route_hint = b''
nonce = 1762591867

adapter_address = "0x2ed51974196ec8787a74c00c5847f03664d66dc5"

# Build routeData (swap call)
swap_selector = Web3.keccak(text="swap(address,address,uint256,uint256,address,uint256)")[:4]
route_data_params = encode(
    ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
    [
        Web3.to_checksum_address(token_in),
        Web3.to_checksum_address(token_out),
        amt_in,
        min_out,
        Web3.to_checksum_address(routerhub_address),
        deadline
    ]
)
route_data = swap_selector + route_data_params

# Build intent tuple
intent_tuple = (
    Web3.to_checksum_address(user_address),
    Web3.to_checksum_address(token_in),
    amt_in,
    Web3.to_checksum_address(token_out),
    min_out,
    dst_chain_id,
    deadline,
    Web3.to_checksum_address(fee_token),
    fee_mode,
    fee_cap_token,
    route_hint,
    nonce
)

print(f"Attempting to simulate executeRoute call...")
print(f"User: {user_address}")
print(f"Adapter: {adapter_address}")
print(f"Deadline: {deadline}")
print()

# Try to call (not send) to get revert reason
try:
    # Check allowance first
    weth_abi = [{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]
    weth = w3.eth.contract(address=Web3.to_checksum_address(token_in), abi=weth_abi)
    allowance = weth.functions.allowance(
        Web3.to_checksum_address(user_address),
        Web3.to_checksum_address(routerhub_address)
    ).call()
    print(f"User allowance to RouterHub: {allowance} ({allowance / 1e18} WETH)")
    
    if allowance < amt_in:
        print(f"❌ INSUFFICIENT ALLOWANCE!")
        print(f"   Need: {amt_in} ({amt_in / 1e18} WETH)")
        print(f"   Have: {allowance} ({allowance / 1e18} WETH)")
        print(f"\n🚨 THIS IS THE BUG!")
        print(f"   The user approved only {allowance / 1e18} WETH")
        print(f"   But the swap requires {amt_in / 1e18} WETH")
    else:
        print(f"✅ Allowance is sufficient")
        
        # Now try the actual call
        result = routerhub.functions.executeRoute(
            intent_tuple,
            Web3.to_checksum_address(adapter_address),
            route_data
        ).call({'from': '0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A'})  # Relayer address
        
        print(f"✅ Call succeeded! Output: {result}")
        print(f"\nThis is unexpected - the transaction should have succeeded on-chain too.")
        print(f"Possible reasons:")
        print(f"1. Gas limit was too low")
        print(f"2. State changed between simulation and actual TX")
        print(f"3. Deadline expired between submission and mining")
        
except Exception as e:
    error_msg = str(e)
    print(f"\n❌ Call failed with error:")
    print(f"{'='*80}")
    print(error_msg)
    print(f"{'='*80}")
    
    if 'ERC20: insufficient allowance' in error_msg:
        print(f"\n🎯 ROOT CAUSE: Insufficient allowance!")
    elif 'Adapter not whitelisted' in error_msg:
        print(f"\n🎯 ROOT CAUSE: Adapter not whitelisted!")
    elif 'Intent expired' in error_msg:
        print(f"\n🎯 ROOT CAUSE: Intent deadline expired!")
    elif 'ERC20: transfer amount exceeds balance' in error_msg:
        print(f"\n🎯 ROOT CAUSE: Insufficient balance!")
