#!/usr/bin/env python3
"""
Decode failed Sepolia transaction to find exact root cause
TX: 0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b
"""

from web3 import Web3
from eth_abi import decode

# Sepolia RPC
SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))

FAILED_TX = "0x1613ce4fb0ccf4a36da42ba0101f74bb8719603145d62c720f172ba555196e5b"

print("=" * 70)
print("🔍 DECODING FAILED SEPOLIA TRANSACTION")
print("=" * 70)
print()

# Get transaction
tx = w3.eth.get_transaction(FAILED_TX)
receipt = w3.eth.get_transaction_receipt(FAILED_TX)

print("📋 TRANSACTION BASIC INFO:")
print("-" * 70)
print(f"From:        {tx['from']}")
print(f"To:          {tx['to']} (RouterHub)")
print(f"Value:       {Web3.from_wei(tx['value'], 'ether')} ETH")
print(f"Gas Limit:   {tx['gas']:,}")
print(f"Gas Used:    {receipt['gasUsed']:,}")
print(f"Status:      {'✅ Success' if receipt['status'] == 1 else '❌ Failed'}")
print(f"Gas Price:   {Web3.from_wei(tx['gasPrice'], 'gwei')} Gwei")
print()

# Decode input
print("📝 DECODING INPUT DATA:")
print("-" * 70)
input_data = tx['input'].hex() if isinstance(tx['input'], bytes) else tx['input']
if input_data.startswith('0x'):
    input_data = input_data[2:]
    
print(f"Input length: {len(input_data)} hex chars ({len(input_data)//2} bytes)")
print(f"First 10 chars: {input_data[:10]}")

# Function selector
selector = input_data[:8]
print(f"Function selector: 0x{selector}")

# RouterHub.executeRoute function signature
# function executeRoute(Intent calldata intent, bytes calldata routeData, bytes calldata signature)
print()
print("🔍 DECODING PARAMETERS:")
print("-" * 70)

# Remove selector (4 bytes = 8 hex chars)
params_hex = input_data[8:]

# Intent struct:
# struct Intent {
#     address user;
#     address tokenIn;
#     uint256 amtIn;
#     address tokenOut;
#     uint256 minOut;
#     uint256 dstChainId;
#     uint8 feeMode;
#     uint256 feeCap;
#     uint256 deadline;
#     uint256 nonce;
# }

try:
    # Parse manually since it's complex struct
    offset = 0
    
    # Get offsets for the three calldata params (intent, routeData, signature)
    intent_offset = int(params_hex[offset:offset+64], 16) * 2
    offset += 64
    routedata_offset = int(params_hex[offset:offset+64], 16) * 2
    offset += 64
    sig_offset = int(params_hex[offset:offset+64], 16) * 2
    
    print(f"Intent offset:     {intent_offset}")
    print(f"RouteData offset:  {routedata_offset}")
    print(f"Signature offset:  {sig_offset}")
    print()
    
    # Decode Intent struct
    print("📦 INTENT STRUCT:")
    print("-" * 70)
    
    intent_data = params_hex[intent_offset:]
    i = 0
    
    # user (address) - 32 bytes but address is last 20 bytes
    user_hex = intent_data[i+24:i+64]
    user = "0x" + user_hex
    i += 64
    print(f"user:        {user}")
    
    # tokenIn (address)
    token_in_hex = intent_data[i+24:i+64]
    token_in = "0x" + token_in_hex
    i += 64
    print(f"tokenIn:     {token_in}")
    
    # amtIn (uint256)
    amt_in_hex = intent_data[i:i+64]
    amt_in = int(amt_in_hex, 16)
    i += 64
    print(f"amtIn:       {amt_in} wei ({amt_in / 1e18} tokens)")
    
    # tokenOut (address)
    token_out_hex = intent_data[i+24:i+64]
    token_out = "0x" + token_out_hex
    i += 64
    print(f"tokenOut:    {token_out}")
    
    # minOut (uint256)
    min_out_hex = intent_data[i:i+64]
    min_out = int(min_out_hex, 16)
    i += 64
    print(f"minOut:      {min_out} wei ({min_out / 1e6} tokens)")
    
    # dstChainId (uint256)
    chain_id_hex = intent_data[i:i+64]
    chain_id = int(chain_id_hex, 16)
    i += 64
    print(f"dstChainId:  {chain_id}")
    
    # feeMode (uint8)
    fee_mode_hex = intent_data[i:i+64]
    fee_mode = int(fee_mode_hex, 16)
    i += 64
    print(f"feeMode:     {fee_mode}")
    
    # feeCap (uint256)
    fee_cap_hex = intent_data[i:i+64]
    fee_cap = int(fee_cap_hex, 16)
    i += 64
    print(f"feeCap:      {fee_cap}")
    
    # deadline (uint256)
    deadline_hex = intent_data[i:i+64]
    deadline = int(deadline_hex, 16)
    i += 64
    print(f"deadline:    {deadline}")
    
    # nonce (uint256)
    nonce_hex = intent_data[i:i+64]
    nonce = int(nonce_hex, 16)
    i += 64
    print(f"nonce:       {nonce}")
    
    print()
    print("=" * 70)
    print("🔍 CHECKING BALANCES AND ALLOWANCES:")
    print("=" * 70)
    print()
    
    # ERC20 ABI
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
        }
    ]
    
    token_in_contract = w3.eth.contract(
        address=Web3.to_checksum_address(token_in), 
        abi=ERC20_ABI
    )
    
    # Check user balance
    user_balance = token_in_contract.functions.balanceOf(Web3.to_checksum_address(user)).call()
    print(f"User balance of tokenIn:  {user_balance} wei ({user_balance / 1e18} tokens)")
    
    # Check allowance
    routerhub = Web3.to_checksum_address(tx['to'])
    allowance = token_in_contract.functions.allowance(
        Web3.to_checksum_address(user),
        routerhub
    ).call()
    print(f"User allowance to RouterHub: {allowance} wei ({allowance / 1e18} tokens)")
    
    print()
    print("=" * 70)
    print("🎯 ROOT CAUSE ANALYSIS:")
    print("=" * 70)
    
    if user_balance < amt_in:
        print(f"❌ INSUFFICIENT BALANCE!")
        print(f"   User has: {user_balance / 1e18} tokens")
        print(f"   Swap needs: {amt_in / 1e18} tokens")
        print(f"   Deficit: {(amt_in - user_balance) / 1e18} tokens")
    elif allowance < amt_in:
        print(f"❌ INSUFFICIENT ALLOWANCE!")
        print(f"   Allowance: {allowance / 1e18} tokens")
        print(f"   Swap needs: {amt_in / 1e18} tokens")
        print(f"   Deficit: {(amt_in - allowance) / 1e18} tokens")
    else:
        print(f"✅ Balance and allowance are sufficient")
        print(f"   User balance: {user_balance / 1e18} >= {amt_in / 1e18} ✅")
        print(f"   Allowance: {allowance / 1e18} >= {amt_in / 1e18} ✅")
        print()
        print(f"⚠️ Issue must be elsewhere:")
        print(f"   - MockDEXAdapter logic")
        print(f"   - Token compatibility")
        print(f"   - Gas limit")
        print(f"   - Contract state")
    
    print("=" * 70)
    
except Exception as e:
    print(f"❌ Error decoding: {e}")
    import traceback
    traceback.print_exc()
