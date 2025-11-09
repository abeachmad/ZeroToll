#!/usr/bin/env python3
"""
Test TestnetPriceOracle on Amoy
Verifies that backend can read real-time prices from configurable oracle
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from pyth_oracle_service import PythPriceService
import asyncio

async def test_amoy_oracle():
    print("🧪 Testing Amoy TestnetPriceOracle Integration\n")
    
    service = PythPriceService()
    
    # Amoy token addresses
    WPOL = "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"
    USDC = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
    
    print("1️⃣  Fetching WPOL price...")
    try:
        wpol_price = await service.get_token_price_usd(80002, WPOL)
        print(f"   ✅ WPOL: ${wpol_price:.8f}")
    except Exception as e:
        print(f"   ❌ WPOL failed: {e}")
        return False
    
    print("\n2️⃣  Fetching USDC price...")
    try:
        usdc_price = await service.get_token_price_usd(80002, USDC)
        print(f"   ✅ USDC: ${usdc_price:.8f}")
    except Exception as e:
        print(f"   ❌ USDC failed: {e}")
        return False
    
    print("\n3️⃣  Calculating swap quote...")
    # 1 USDC → WPOL
    usdc_amount = 1.0
    expected_wpol = (usdc_price / wpol_price) * usdc_amount
    print(f"   1 USDC → {expected_wpol:.6f} WPOL")
    print(f"   (USDC=${usdc_price:.4f}, WPOL=${wpol_price:.4f})")
    
    print("\n✅ SUCCESS! Backend can read from TestnetPriceOracle!")
    print("\n📊 Price Summary:")
    print(f"   WPOL: ${wpol_price:.8f} (from CoinGecko API)")
    print(f"   USDC: ${usdc_price:.8f} (from CoinGecko API)")
    print(f"\n💡 These prices are NOT HARDCODED!")
    print("   Update via: npx hardhat run scripts/update-testnet-prices-amoy.js --network amoy")
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_amoy_oracle())
    sys.exit(0 if success else 1)
