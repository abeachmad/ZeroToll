#!/usr/bin/env python3
"""
Check adapter quote vs minOut for failed transactions
"""

from web3 import Web3

# Sepolia
SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
SEPOLIA_ADAPTER = "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"
WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"

# Amoy
AMOY_RPC = "https://rpc-amoy.polygon.technology"
AMOY_ADAPTER = "0x0560672dF3b2c9B3deA56B2B0b1AD6cFf8DB4301"  # Old adapter
USDC_AMOY = "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"
WMATIC_ADDRESS = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"

ADAPTER_ABI = [
    {
        "inputs": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"}
        ],
        "name": "getQuote",
        "outputs": [{"name": "amountOut", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

print("=" * 80)
print("CHECKING ADAPTER QUOTES FOR FAILED TRANSACTIONS")
print("=" * 80)

# Check Sepolia - WETH to USDC
print("\n🔍 SEPOLIA: 0.001 WETH → USDC (FAILED)")
print("-" * 80)

w3_sep = Web3(Web3.HTTPProvider(SEPOLIA_RPC))
adapter_sep = w3_sep.eth.contract(address=Web3.to_checksum_address(SEPOLIA_ADAPTER), abi=ADAPTER_ABI)
usdc_sep = w3_sep.eth.contract(address=Web3.to_checksum_address(USDC_SEPOLIA), abi=ERC20_ABI)

try:
    # Check adapter USDC balance
    usdc_balance = usdc_sep.functions.balanceOf(Web3.to_checksum_address(SEPOLIA_ADAPTER)).call()
    print(f"Adapter USDC balance: {usdc_balance / 1e6:.6f} USDC")
    
    # Get quote
    amount_in_wei = w3_sep.to_wei(0.001, 'ether')
    amount_out = adapter_sep.functions.getQuote(
        Web3.to_checksum_address(WETH_ADDRESS),
        Web3.to_checksum_address(USDC_SEPOLIA),
        amount_in_wei
    ).call()
    
    amount_out_usdc = amount_out / 1e6
    print(f"Input: 0.001 WETH")
    print(f"Adapter quote: {amount_out_usdc:.6f} USDC")
    print(f"Min Out (from log): 3.257601 USDC")
    
    if amount_out_usdc >= 3.257601:
        print(f"✅ Adapter quote ({amount_out_usdc:.6f}) >= minOut (3.257601)")
        print(f"   Transaction SHOULD succeed!")
    else:
        print(f"❌ Adapter quote ({amount_out_usdc:.6f}) < minOut (3.257601)")
        shortfall = 3.257601 - amount_out_usdc
        print(f"   Shortfall: {shortfall:.6f} USDC ({shortfall/3.257601*100:.2f}%)")
        print(f"   This explains why it failed!")
        
except Exception as e:
    print(f"❌ Error: {e}")

# Check Amoy - USDC to WMATIC
print("\n" + "=" * 80)
print("\n🔍 AMOY: 1 USDC → WMATIC (FAILED)")
print("-" * 80)

w3_amoy = Web3(Web3.HTTPProvider(AMOY_RPC))
adapter_amoy = w3_amoy.eth.contract(address=Web3.to_checksum_address(AMOY_ADAPTER), abi=ADAPTER_ABI)
wmatic = w3_amoy.eth.contract(address=Web3.to_checksum_address(WMATIC_ADDRESS), abi=ERC20_ABI)

try:
    # Check adapter WMATIC balance
    wmatic_balance = wmatic.functions.balanceOf(Web3.to_checksum_address(AMOY_ADAPTER)).call()
    print(f"Adapter WMATIC balance: {wmatic_balance / 1e18:.6f} WMATIC")
    
    # Get quote
    amount_in = 1_000_000  # 1 USDC (6 decimals)
    amount_out = adapter_amoy.functions.getQuote(
        Web3.to_checksum_address(USDC_AMOY),
        Web3.to_checksum_address(WMATIC_ADDRESS),
        amount_in
    ).call()
    
    amount_out_wmatic = amount_out / 1e18
    print(f"Input: 1.0 USDC")
    print(f"Adapter quote: {amount_out_wmatic:.6f} WMATIC")
    print(f"Min Out (from log): 1.718381 WMATIC")
    
    if amount_out_wmatic >= 1.718381:
        print(f"✅ Adapter quote ({amount_out_wmatic:.6f}) >= minOut (1.718381)")
        print(f"   Transaction SHOULD succeed!")
    else:
        print(f"❌ Adapter quote ({amount_out_wmatic:.6f}) < minOut (1.718381)")
        shortfall = 1.718381 - amount_out_wmatic
        print(f"   Shortfall: {shortfall:.6f} WMATIC ({shortfall/1.718381*100:.2f}%)")
        print(f"   This explains why it failed!")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 80)
print("DIAGNOSIS:")
print("=" * 80)
print("""
If adapter quote < minOut:
  → Backend calculated wrong quote (too optimistic)
  → Or frontend applied wrong slippage multiplier
  → Or adapter uses different price source than backend

Next step: Compare backend quote with actual adapter quote
""")
