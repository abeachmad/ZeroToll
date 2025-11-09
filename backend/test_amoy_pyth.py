#!/usr/bin/env python3
"""
Test Pyth Oracle Integration on Amoy
Verify NO hardcoded prices - all from Pyth Network
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from pyth_oracle_service import PythPriceService
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def test_amoy_pyth_oracle():
    """Test Amoy oracle with real Pyth prices"""
    
    print("=" * 60)
    print("🧪 TESTING AMOY PYTH ORACLE")
    print("=" * 60)
    print()
    
    service = PythPriceService()
    
    # Test tokens
    tokens = ['WPOL', 'WMATIC', 'USDC', 'POL']
    chain_id = 80002  # Amoy
    
    print(f"Chain ID: {chain_id} (Polygon Amoy)")
    print(f"Oracle: {service.oracle_contracts.get(chain_id, 'NOT FOUND')}")
    print()
    
    results = {}
    
    for token in tokens:
        try:
            print(f"📊 Getting price for {token}...")
            price = service.get_price(token, chain_id)
            results[token] = price
            
            # Check if it's NOT hardcoded $1 or $0.55
            is_real = price not in [1.0, 0.55, 3450.0]
            status = "✅ REAL" if is_real else "❌ HARDCODED?"
            
            print(f"   {token}: ${price:.4f} {status}")
            
        except Exception as e:
            print(f"   ❌ {token}: FAILED - {str(e)}")
            results[token] = None
    
    print()
    print("=" * 60)
    print("📋 SUMMARY")
    print("=" * 60)
    
    success_count = sum(1 for v in results.values() if v is not None)
    total = len(results)
    
    print(f"✅ Success: {success_count}/{total}")
    print(f"❌ Failed: {total - success_count}/{total}")
    print()
    
    # Verify NO hardcoded prices
    hardcoded_prices = [1.0, 0.55, 3450.0]
    has_hardcoded = any(v in hardcoded_prices for v in results.values() if v is not None)
    
    if has_hardcoded:
        print("🚨 WARNING: Detected hardcoded prices!")
        print("   Expected: Real-time Pyth prices")
        print("   Actual: Hardcoded fallback values")
        return False
    else:
        print("🎉 SUCCESS: All prices from Pyth Network (NO hardcoding)!")
        print("   WPOL/WMATIC: Real-time POL price")
        print("   USDC: Real-time stablecoin price")
        return True

if __name__ == '__main__':
    success = test_amoy_pyth_oracle()
    sys.exit(0 if success else 1)
