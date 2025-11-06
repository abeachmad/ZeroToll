"""
Direct swap test via Uniswap V2 Router on Sepolia
Quick proof-of-life for buildathon demo
"""
import os
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

load_dotenv()

# Config
RPC_URL = os.getenv("RPC_SEPOLIA", "https://ethereum-sepolia-rpc.publicnode.com")
PRIVATE_KEY = os.getenv("RELAYER_PRIVATE_KEY")

# Contracts (Sepolia)
UNISWAP_V2_ROUTER = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"  # Sepolia Uniswap V2 Router
USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
LINK = "0x779877A7B0D9E8603169DdbD7836e478b4624789"
WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"

# Initialize
w3 = Web3(Web3.HTTPProvider(RPC_URL))
account = Account.from_key(PRIVATE_KEY)
print(f"🔑 Using account: {account.address}")

# ERC20 ABI (minimal)
ERC20_ABI = [
    {
        "constant": False,
        "inputs": [
            {"name": "_spender", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]

# Uniswap V2 Router ABI (minimal)
ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [
            {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
        ],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

def main():
    print("\n" + "="*70)
    print("🚀 DIRECT SWAP TEST - Sepolia Uniswap V2")
    print("="*70)
    
    # Get contracts
    usdc = w3.eth.contract(address=Web3.to_checksum_address(USDC), abi=ERC20_ABI)
    link = w3.eth.contract(address=Web3.to_checksum_address(LINK), abi=ERC20_ABI)
    router = w3.eth.contract(address=Web3.to_checksum_address(UNISWAP_V2_ROUTER), abi=ROUTER_ABI)
    
    # Check balances
    usdc_balance = usdc.functions.balanceOf(account.address).call()
    link_balance_before = link.functions.balanceOf(account.address).call()
    
    print(f"\n📊 Initial Balances:")
    print(f"  USDC: {usdc_balance / 1e6:.6f}")
    print(f"  LINK: {link_balance_before / 1e18:.6f}")
    
    # Swap params
    amount_in = int(0.01 * 1e6)  # 0.01 USDC
    amount_out_min = 0  # Accept any amount for testnet (no slippage protection)
    path = [
        Web3.to_checksum_address(USDC),
        Web3.to_checksum_address(WETH),  # Route through WETH
        Web3.to_checksum_address(LINK)
    ]
    deadline = w3.eth.get_block('latest')['timestamp'] + 600  # 10 minutes
    
    print(f"\n📋 Swap Parameters:")
    print(f"  Amount In: {amount_in / 1e6:.6f} USDC")
    print(f"  Path: USDC → WETH → LINK")
    print(f"  Deadline: {deadline}")
    
    # Step 1: Approve router
    print(f"\n1️⃣  Approving Uniswap Router...")
    approve_tx = usdc.functions.approve(
        Web3.to_checksum_address(UNISWAP_V2_ROUTER),
        2**256 - 1  # MAX approval
    ).build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 100000,
        'maxFeePerGas': w3.eth.gas_price,
        'maxPriorityFeePerGas': w3.eth.max_priority_fee,
    })
    
    signed_approve = account.sign_transaction(approve_tx)
    approve_hash = w3.eth.send_raw_transaction(signed_approve.raw_transaction)
    print(f"  📤 Approve TX: {approve_hash.hex()}")
    
    approve_receipt = w3.eth.wait_for_transaction_receipt(approve_hash)
    if approve_receipt['status'] == 1:
        print(f"  ✅ Approved!")
    else:
        print(f"  ❌ Approve failed!")
        return
    
    # Step 2: Execute swap
    print(f"\n2️⃣  Executing swap...")
    swap_tx = router.functions.swapExactTokensForTokens(
        amount_in,
        amount_out_min,
        path,
        account.address,
        deadline
    ).build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 700000,
        'maxFeePerGas': w3.eth.gas_price,
        'maxPriorityFeePerGas': w3.eth.max_priority_fee,
    })
    
    signed_swap = account.sign_transaction(swap_tx)
    swap_hash = w3.eth.send_raw_transaction(signed_swap.raw_transaction)
    print(f"  📤 Swap TX: {swap_hash.hex()}")
    print(f"  ⏳ Waiting for confirmation...")
    
    swap_receipt = w3.eth.wait_for_transaction_receipt(swap_hash)
    
    print("\n" + "="*70)
    if swap_receipt['status'] == 1:
        print("🎉 SWAP SUCCESSFUL!")
    else:
        print("❌ SWAP FAILED!")
    print("="*70)
    
    print(f"\n📋 Transaction Details:")
    print(f"  TX Hash: {swap_hash.hex()}")
    print(f"  Block: {swap_receipt['blockNumber']}")
    print(f"  Gas Used: {swap_receipt['gasUsed']:,}")
    print(f"  Status: {'✅ SUCCESS' if swap_receipt['status'] == 1 else '❌ FAILED'}")
    
    # Check final balances
    link_balance_after = link.functions.balanceOf(account.address).call()
    link_received = (link_balance_after - link_balance_before) / 1e18
    
    print(f"\n📊 Final Balances:")
    print(f"  LINK received: {link_received:.6f}")
    
    print(f"\n🔗 View on Sepolia Explorer:")
    print(f"  https://sepolia.etherscan.io/tx/{swap_hash.hex()}")
    
    print("\n" + "="*70)
    print("✅ PROOF-OF-LIFE COMPLETE!")
    print("="*70)

if __name__ == "__main__":
    main()
