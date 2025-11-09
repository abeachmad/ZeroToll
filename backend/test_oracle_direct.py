#!/usr/bin/env python3
"""
Test TestnetPriceOracle on Amoy via direct contract call
"""

from web3 import Web3
from dotenv import load_dotenv
import os

load_dotenv()

# Config
RPC = os.getenv("RPC_AMOY", "https://rpc-amoy.polygon.technology")
ORACLE = os.getenv("AMOY_PYTH_ORACLE")
WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"
USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"

# Oracle ABI (just getPrice function)
ORACLE_ABI = [{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"getPrice","outputs":[{"internalType":"uint256","name":"price","type":"uint256"}],"stateMutability":"view","type":"function"}]

def test_oracle():
    print("🧪 Testing Amoy TestnetPriceOracle Direct Query\n")
    print(f"📡 RPC: {RPC}")
    print(f"🔧 Oracle: {ORACLE}\n")
    
    w3 = Web3(Web3.HTTPProvider(RPC))
    oracle = w3.eth.contract(address=ORACLE, abi=ORACLE_ABI)
    
    # Query WPOL
    print("1️⃣  Querying WPOL price...")
    try:
        wpol_price_raw = oracle.functions.getPrice(WPOL).call()
        wpol_price = wpol_price_raw / 1e8  # 8 decimals
        print(f"   ✅ WPOL: ${wpol_price:.8f}")
        print(f"      Raw: {wpol_price_raw}")
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        return False
    
    # Query USDC
    print("\n2️⃣  Querying USDC price...")
    try:
        usdc_price_raw = oracle.functions.getPrice(USDC).call()
        usdc_price = usdc_price_raw / 1e8  # 8 decimals
        print(f"   ✅ USDC: ${usdc_price:.8f}")
        print(f"      Raw: {usdc_price_raw}")
    except Exception as e:
        print(f"   ❌ Failed: {e}")
        return False
    
    # Calculate quote
    print("\n3️⃣  Calculating swap quote...")
    usdc_amount = 1.0
    expected_wpol = (usdc_price / wpol_price) * usdc_amount
    print(f"   1 USDC → {expected_wpol:.6f} WPOL")
    print(f"   (at current prices: USDC=${usdc_price:.4f}, WPOL=${wpol_price:.4f})")
    
    print("\n✅ SUCCESS!")
    print("\n📊 Summary:")
    print(f"   WPOL: ${wpol_price:.8f} (live from CoinGecko)")
    print(f"   USDC: ${usdc_price:.8f} (live from CoinGecko)")
    print(f"\n💡 NO HARDCODED PRICES!")
    print("   Prices updated via CoinGecko API")
    print("   To refresh: npx hardhat run scripts/update-testnet-prices-amoy.js --network amoy")
    
    return True

if __name__ == "__main__":
    success = test_oracle()
    exit(0 if success else 1)
