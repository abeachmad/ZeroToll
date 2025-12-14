#!/usr/bin/env python3
"""
Test Pimlico API connection for EIP-7702 gasless swaps.
"""

import httpx
import json
import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv('.env.credentials')

PIMLICO_API_KEY = os.getenv("PIMLICO_API_KEY")
if not PIMLICO_API_KEY:
    print("ERROR: Missing PIMLICO_API_KEY in environment")
    exit(1)

CHAINS = {
    80002: "Polygon Amoy",
    11155111: "Ethereum Sepolia",
}

def test_pimlico_health(chain_id: int, chain_name: str):
    """Test Pimlico bundler health for a specific chain."""
    url = f"https://api.pimlico.io/v2/{chain_id}/rpc?apikey={PIMLICO_API_KEY}"
    
    print(f"\n🔍 Testing {chain_name} (Chain ID: {chain_id})...")
    print(f"   URL: {url[:60]}...")
    
    try:
        response = httpx.post(
            url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "eth_supportedEntryPoints",
                "params": [],
            },
            timeout=10.0,
        )
        
        data = response.json()
        
        if "result" in data and len(data["result"]) > 0:
            print(f"   ✅ Pimlico AVAILABLE")
            print(f"   📍 Entry Points: {data['result']}")
            return True
        elif "error" in data:
            print(f"   ❌ Error: {data['error'].get('message', 'Unknown error')}")
            return False
        else:
            print(f"   ⚠️ Unexpected response: {data}")
            return False
            
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        return False


def test_gas_price(chain_id: int, chain_name: str):
    """Test Pimlico gas price estimation."""
    url = f"https://api.pimlico.io/v2/{chain_id}/rpc?apikey={PIMLICO_API_KEY}"
    
    print(f"\n💰 Testing gas price for {chain_name}...")
    
    try:
        response = httpx.post(
            url,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "pimlico_getUserOperationGasPrice",
                "params": [],
            },
            timeout=10.0,
        )
        
        data = response.json()
        
        if "result" in data:
            result = data["result"]
            if "fast" in result:
                fast = result["fast"]
                print(f"   ✅ Gas prices available")
                print(f"   ⚡ Fast: maxFeePerGas={fast.get('maxFeePerGas')}, maxPriorityFeePerGas={fast.get('maxPriorityFeePerGas')}")
            return True
        elif "error" in data:
            print(f"   ❌ Error: {data['error'].get('message', 'Unknown error')}")
            return False
        else:
            print(f"   ⚠️ Unexpected response: {data}")
            return False
            
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        return False


def main():
    print("=" * 60)
    print("🚀 Pimlico API Connection Test")
    print("=" * 60)
    print(f"API Key: {PIMLICO_API_KEY[:10]}...{PIMLICO_API_KEY[-4:]}")
    
    all_passed = True
    
    for chain_id, chain_name in CHAINS.items():
        if not test_pimlico_health(chain_id, chain_name):
            all_passed = False
        if not test_gas_price(chain_id, chain_name):
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ All tests PASSED! Pimlico is ready for EIP-7702 gasless swaps.")
    else:
        print("⚠️ Some tests failed. Check the errors above.")
    print("=" * 60)


if __name__ == "__main__":
    main()
