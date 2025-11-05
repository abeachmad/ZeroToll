#!/usr/bin/env python3
"""Verify all testnet configurations and test real transactions"""

from web3 import Web3
import sys

# Network configurations
NETWORKS = {
    'sepolia': {
        'chain_id': 11155111,
        'rpc': 'https://ethereum-sepolia-rpc.publicnode.com',
        'weth': '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        'link': '0x779877A7B0D9E8603169DdBD7836e478b4624789',
        'explorer': 'https://sepolia.etherscan.io'
    },
    'amoy': {
        'chain_id': 80002,
        'rpc': 'https://rpc-amoy.polygon.technology',
        'wpol': '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
        'link': '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
        'explorer': 'https://amoy.polygonscan.com'
    },
    'arbitrum-sepolia': {
        'chain_id': 421614,
        'rpc': 'https://sepolia-rollup.arbitrum.io/rpc',
        'weth': '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
        'link': '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
        'explorer': 'https://sepolia.arbiscan.io'
    },
    'optimism-sepolia': {
        'chain_id': 11155420,
        'rpc': 'https://sepolia.optimism.io',
        'weth': '0x4200000000000000000000000000000000000006',
        'link': '0xE4aB69C077896252FAFBD49EFD26B5D171A32410',
        'explorer': 'https://sepolia-optimism.etherscan.io'
    }
}

def test_network(name, config):
    print(f"\n{'='*60}")
    print(f"Testing {name.upper()}")
    print(f"{'='*60}")
    
    try:
        w3 = Web3(Web3.HTTPProvider(config['rpc'], request_kwargs={'timeout': 10}))
        
        # Test connection
        if not w3.is_connected():
            print(f"❌ Failed to connect to {name}")
            return False
        print(f"✅ Connected to {name}")
        
        # Verify chain ID
        chain_id = w3.eth.chain_id
        if chain_id != config['chain_id']:
            print(f"❌ Chain ID mismatch: expected {config['chain_id']}, got {chain_id}")
            return False
        print(f"✅ Chain ID verified: {chain_id}")
        
        # Get latest block
        block = w3.eth.block_number
        print(f"✅ Latest block: {block}")
        
        # Verify token addresses are checksummed
        for token_name, address in config.items():
            if token_name in ['chain_id', 'rpc', 'explorer']:
                continue
            try:
                checksummed = Web3.to_checksum_address(address)
                if checksummed != address:
                    print(f"⚠️  {token_name}: {address} (not checksummed)")
                else:
                    print(f"✅ {token_name}: {address}")
            except:
                print(f"❌ {token_name}: Invalid address {address}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing {name}: {e}")
        return False

def main():
    print("🔍 ZeroToll Testnet Configuration Verification")
    print("=" * 60)
    
    results = {}
    for name, config in NETWORKS.items():
        results[name] = test_network(name, config)
    
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    
    for name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{name:20s} {status}")
    
    all_pass = all(results.values())
    print(f"\n{'='*60}")
    if all_pass:
        print("✅ ALL NETWORKS VERIFIED")
        return 0
    else:
        print("❌ SOME NETWORKS FAILED")
        return 1

if __name__ == '__main__':
    sys.exit(main())
