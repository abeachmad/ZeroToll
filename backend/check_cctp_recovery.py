#!/usr/bin/env python3
"""
Try to recover CCTP burned tokens by fetching attestation and completing mint
"""

import requests
import time

# Burn transactions
TX1 = "0xd6d73fb8d2db67873de5da2ad82198fed26fbb44a9d9ebaea216655db645319c"  # 6334 USDC
TX2 = "0x3b807f70208af8ae75a1a3f6df58b219eea7e33dba58bfa8c300b26064957b64"  # 100 USDC

# Circle CCTP Attestation API
# Testnet: https://iris-api-sandbox.circle.com
ATTESTATION_API = "https://iris-api-sandbox.circle.com"

def get_attestation(tx_hash):
    """
    Get attestation from Circle API for a burn transaction
    """
    print(f"\n🔍 Fetching attestation for: {tx_hash}")
    print("=" * 70)
    
    # Circle API endpoint
    url = f"{ATTESTATION_API}/attestations/{tx_hash}"
    
    try:
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Attestation found!")
            print(f"   Status: {data.get('status', 'unknown')}")
            
            if 'attestation' in data:
                attestation = data['attestation']
                print(f"   Attestation: {attestation[:100]}...")
                return attestation
            else:
                print("⚠️  Attestation not ready yet")
                print(f"   Response: {data}")
                return None
                
        elif response.status_code == 404:
            print("❌ Attestation not found")
            print("   Possible reasons:")
            print("   - Transaction too old (attestation expired)")
            print("   - Wrong network (Sepolia vs Mainnet)")
            print("   - Attestation service didn't index this tx")
            return None
            
        else:
            print(f"❌ API error: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return None

def main():
    print("🔥 CCTP BURN RECOVERY ATTEMPT")
    print("=" * 70)
    print("\n📋 Burned Transactions:")
    print(f"   TX1: {TX1}")
    print(f"   Amount: 6334.034127 USDC")
    print(f"   TX2: {TX2}")
    print(f"   Amount: 100.0 USDC")
    print(f"\n   Total Burned: 6434.034127 USDC")
    
    # Try to get attestations
    att1 = get_attestation(TX1)
    time.sleep(1)
    att2 = get_attestation(TX2)
    
    print("\n" + "=" * 70)
    print("📊 RECOVERY STATUS")
    print("=" * 70)
    
    if att1 or att2:
        print("\n✅ Some attestations found!")
        print("\n🔧 NEXT STEPS:")
        print("   1. Use the attestation to call receiveMessage() on destination chain")
        print("   2. This will mint USDC on Amoy")
        print("   3. Tokens will be recovered!")
        
        if att1:
            print(f"\n   TX1 Attestation ready - can recover 6334 USDC")
        if att2:
            print(f"\n   TX2 Attestation ready - can recover 100 USDC")
            
    else:
        print("\n❌ NO ATTESTATIONS FOUND")
        print("\n⚠️  TOKENS ARE LIKELY LOST")
        print("\n💡 Possible reasons:")
        print("   1. Wrong CCTP network (Sepolia testnet may not be supported)")
        print("   2. Transactions too old (attestations expire)")
        print("   3. Destination chain not supported by CCTP")
        print("   4. Attestation service failure")
        
        print("\n🔧 WHAT TO DO:")
        print("   1. Check if CCTP supports Sepolia → Amoy")
        print("      Visit: https://developers.circle.com/stablecoins/docs/cctp-protocol-contract")
        print("   2. Check supported chains and domains")
        print("   3. If Amoy not supported, tokens are PERMANENTLY LOST")
        print("   4. Contact Circle support (unlikely to help for testnet)")
        
        print("\n💸 FINANCIAL IMPACT:")
        print("   - This is TESTNET USDC (no real value)")
        print("   - No financial loss")
        print("   - Learning experience about CCTP risks")
        
        print("\n📚 LESSONS LEARNED:")
        print("   ✅ Always verify destination chain is supported BEFORE burning")
        print("   ✅ Test with small amounts first")
        print("   ✅ Check CCTP documentation for supported routes")
        print("   ✅ For testnet, use bridges with refund mechanisms")

if __name__ == "__main__":
    main()
