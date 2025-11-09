#!/usr/bin/env python3
"""
Test /api/quote endpoint to verify Pyth Oracle integration
Expected: Should return REAL-TIME prices from Pyth, NOT hardcoded values
"""

import requests
import json

# Test quote request
quote_request = {
    "intent": {
        "user": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",  # Valid checksum address
        "srcChainId": 11155111,  # Sepolia
        "dstChainId": 11155111,
        "tokenIn": "WETH",
        "tokenOut": "USDC",
        "amtIn": 0.001,  # 0.001 WETH
        "minOut": 0.001,  # Minimum output (will be overridden by real quote)
        "feeMode": "INPUT",
        "feeCap": 0.0001,
        "deadline": 1800,
        "nonce": 1
    }
}

print("🧪 Testing /api/quote with Pyth Oracle")
print("=" * 60)
print(f"Request: {json.dumps(quote_request, indent=2)}")
print("=" * 60)

try:
    response = requests.post(
        "http://localhost:8000/api/quote",
        json=quote_request,
        timeout=10
    )
    
    if response.status_code == 200:
        quote = response.json()
        print("\n✅ Quote SUCCESS!")
        print(f"Amount In: {quote_request['intent']['amtIn']} WETH")
        
        amt_out = quote.get('amountOut', 0)
        net_out = quote.get('netOut', 0)
        fee_token = quote.get('feeToken', 'N/A')
        est_fee = quote.get('estimatedFee', 0)
        
        # Handle both float and string types
        if isinstance(amt_out, str):
            amt_out = float(amt_out) if amt_out else 0
        if isinstance(net_out, str):
            net_out = float(net_out) if net_out else 0
        if isinstance(est_fee, str):
            est_fee = float(est_fee) if est_fee else 0
        
        print(f"Amount Out: {amt_out:.6f} USDC")
        print(f"Net Out: {net_out:.6f} USDC")
        print(f"Fee Token: {fee_token}")
        print(f"Estimated Fee: {est_fee:.6f}")
        
        # Calculate implied ETH price
        amt_in = quote_request['intent']['amtIn']
        if net_out > 0:
            # netOut already includes 0.5% slippage, so divide by 0.995 to get original
            implied_eth_price = (net_out / 0.995) / amt_in
            print(f"\n💰 Implied ETH price: ${implied_eth_price:.2f}")
            
            # Compare with expected range
            if 3400 <= implied_eth_price <= 3600:
                print("✅ Price matches Pyth Oracle range ($3400-$3600)")
            elif 3690 <= implied_eth_price <= 3730:
                print("❌ Price still using OLD HARDCODED value (~$3709.35)!")
            else:
                print(f"⚠️  Price ${implied_eth_price:.2f} outside expected range")
        
        print("\nFull response:")
        print(json.dumps(quote, indent=2))
    else:
        print(f"❌ Quote FAILED with status {response.status_code}")
        print(f"Response: {response.text}")

except Exception as e:
    print(f"❌ Request failed: {e}")
