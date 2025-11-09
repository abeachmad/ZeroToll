#!/usr/bin/env python3
"""
Analisis transaksi gagal vs berhasil
"""

# Data dari backend log

failed_txs = {
    "sepolia_1": {
        "tx": "0xc9d4e0cb8695b07f2ec120f0beb36cf277e43093b713e5e203d2096cc88b19c7",
        "chain": 11155111,  # Sepolia
        "tokenIn": "WETH",
        "tokenOut": "USDC",
        "amtIn": 0.001,
        "minOut": 3.2576012999999997,  # From log
        "eth_price": 3445.77,  # From Pyth log
        "usdc_price": 1.00,
        "feeMode": "INPUT",
        "error": "Gas estimation failed: execution reverted: Adapter call failed"
    },
    "amoy_1": {
        "tx": "0x5dfaa7ca768b9e7cf7b36bc424920cd69ff9558fcc985ed6ab04a8d9d9d9c8e4",
        "chain": 80002,  # Amoy
        "tokenIn": "USDC",
        "tokenOut": "WMATIC",
        "amtIn": 1.0,
        "minOut": 1.7183808999999999,  # From log
        "usdc_price": 1.0,  # Fallback
        "wmatic_price": 0.55,  # Fallback
        "feeMode": "INPUT",
        "error": "Gas estimation failed: execution reverted: Adapter call failed"
    }
}

successful_txs = {
    "sepolia_usdc_to_weth_1": {
        "tx": "0x6f8412dc2dadcc304858abe50db7a9755d9c8c5f048f318468e7930c376cc552",
        "chain": 11155111,
        "tokenIn": "USDC",
        "tokenOut": "WETH",
        "amtIn": 3.0,
        "minOut": 0.0008227,  # 822700000000000 wei
        "eth_price": 3445.77,  # From Pyth
        "usdc_price": 1.00,
        "feeMode": "INPUT"
    },
    "sepolia_usdc_to_weth_2": {
        "tx": "0xb83b36f19c6a6f37ebaa0322e3e351d439ba9fb40a1b3096b740f8e2e9a6ccea",
        "chain": 11155111,
        "tokenIn": "USDC",
        "tokenOut": "WETH",
        "amtIn": 4.0,
        "minOut": 0.0010982,  # 1098199999999999 wei
        "eth_price": 3443.01,  # From Pyth
        "usdc_price": 1.00,
        "feeMode": "OUTPUT"
    },
    "amoy_wmatic_to_usdc_1": {
        "tx": "0xde89d3870880e9fd575e2f3a5ce4cacfbedf3b1d0990da4e60edd70f38f5a818",
        "chain": 80002,
        "tokenIn": "WMATIC",
        "tokenOut": "USDC",
        "amtIn": 2.0,
        "minOut": 1.039775,  # 1039774 (6 decimals)
        "wmatic_price": 0.55,  # Fallback
        "usdc_price": 1.0,
        "feeMode": "INPUT"
    },
    "amoy_wmatic_to_usdc_2": {
        "tx": "0x52526a3015323f6da29cd995dc7ba9692005cffe80b6952218e4217746777bf4",
        "chain": 80002,
        "tokenIn": "WMATIC",
        "tokenOut": "USDC",
        "amtIn": 1.0,
        "minOut": 0.5198875,  # 519887 (6 decimals)
        "wmatic_price": 0.55,  # Fallback
        "usdc_price": 1.0,
        "feeMode": "OUTPUT"
    }
}

print("=" * 80)
print("ANALISIS TRANSAKSI GAGAL VS BERHASIL")
print("=" * 80)

# Analisis SEPOLIA
print("\n🔴 SEPOLIA - GAGAL:")
failed_sep = failed_txs["sepolia_1"]
print(f"  Direction: {failed_sep['tokenIn']} → {failed_sep['tokenOut']}")
print(f"  Amount In: {failed_sep['amtIn']} {failed_sep['tokenIn']}")
print(f"  Min Out: {failed_sep['minOut']} {failed_sep['tokenOut']}")
print(f"  Price: ETH=${failed_sep['eth_price']}, USDC=${failed_sep['usdc_price']}")

# Expected output calculation
usd_value = failed_sep['amtIn'] * failed_sep['eth_price']
expected_usdc_out = usd_value / failed_sep['usdc_price']
print(f"  Expected output: {expected_usdc_out:.6f} USDC")
print(f"  With 0.5% slippage: {expected_usdc_out * 0.995:.6f} USDC")
print(f"  Min Out Required: {failed_sep['minOut']:.6f} USDC")

if failed_sep['minOut'] > expected_usdc_out * 0.995:
    print(f"  ❌ PROBLEM: minOut ({failed_sep['minOut']:.6f}) > expected ({expected_usdc_out * 0.995:.6f})")
    diff = failed_sep['minOut'] - (expected_usdc_out * 0.995)
    print(f"  ❌ Shortfall: {diff:.6f} USDC ({diff/failed_sep['minOut']*100:.2f}%)")

print("\n✅ SEPOLIA - BERHASIL:")
for name, tx in successful_txs.items():
    if tx['chain'] != 11155111:
        continue
    print(f"\n  {name}:")
    print(f"    Direction: {tx['tokenIn']} → {tx['tokenOut']}")
    print(f"    Amount In: {tx['amtIn']} {tx['tokenIn']}")
    print(f"    Min Out: {tx['minOut']} {tx['tokenOut']}")
    
    if tx['tokenIn'] == 'USDC':
        # USDC to WETH
        usd_value = tx['amtIn'] * tx['usdc_price']
        expected_weth = usd_value / tx['eth_price']
        print(f"    Expected: {expected_weth:.8f} WETH")
        print(f"    With 0.5% slippage: {expected_weth * 0.995:.8f} WETH")
        print(f"    Min Out: {tx['minOut']:.8f} WETH")
        
        if tx['minOut'] > expected_weth * 0.995:
            print(f"    ⚠️  minOut > expected (should fail but succeeded?)")

# Analisis AMOY
print("\n" + "=" * 80)
print("\n🔴 AMOY - GAGAL:")
failed_amoy = failed_txs["amoy_1"]
print(f"  Direction: {failed_amoy['tokenIn']} → {failed_amoy['tokenOut']}")
print(f"  Amount In: {failed_amoy['amtIn']} {failed_amoy['tokenIn']}")
print(f"  Min Out: {failed_amoy['minOut']} {failed_amoy['tokenOut']}")
print(f"  Price: USDC=${failed_amoy['usdc_price']}, WMATIC=${failed_amoy['wmatic_price']}")

# Expected output calculation
usd_value = failed_amoy['amtIn'] * failed_amoy['usdc_price']
expected_wmatic_out = usd_value / failed_amoy['wmatic_price']
print(f"  Expected output: {expected_wmatic_out:.6f} WMATIC")
print(f"  With 0.5% slippage: {expected_wmatic_out * 0.995:.6f} WMATIC")
print(f"  Min Out Required: {failed_amoy['minOut']:.6f} WMATIC")

if failed_amoy['minOut'] > expected_wmatic_out * 0.995:
    print(f"  ❌ PROBLEM: minOut ({failed_amoy['minOut']:.6f}) > expected ({expected_wmatic_out * 0.995:.6f})")
    diff = failed_amoy['minOut'] - (expected_wmatic_out * 0.995)
    print(f"  ❌ Shortfall: {diff:.6f} WMATIC ({diff/failed_amoy['minOut']*100:.2f}%)")

print("\n✅ AMOY - BERHASIL:")
for name, tx in successful_txs.items():
    if tx['chain'] != 80002:
        continue
    print(f"\n  {name}:")
    print(f"    Direction: {tx['tokenIn']} → {tx['tokenOut']}")
    print(f"    Amount In: {tx['amtIn']} {tx['tokenIn']}")
    print(f"    Min Out: {tx['minOut']} {tx['tokenOut']}")
    
    # WMATIC to USDC
    usd_value = tx['amtIn'] * tx['wmatic_price']
    expected_usdc = usd_value / tx['usdc_price']
    print(f"    Expected: {expected_usdc:.6f} USDC")
    print(f"    With 0.5% slippage: {expected_usdc * 0.995:.6f} USDC")
    print(f"    Min Out: {tx['minOut']:.6f} USDC")

print("\n" + "=" * 80)
print("ROOT CAUSE ANALYSIS:")
print("=" * 80)
print("""
Pattern yang terlihat:
1. GAGAL: WETH → USDC (Sepolia), USDC → WMATIC (Amoy)
2. BERHASIL: USDC → WETH (Sepolia), WMATIC → USDC (Amoy)

Kemungkinan:
- Backend menghitung quote dengan slippage 0.5% (0.995)
- Frontend menerapkan slippage LAGI (misal 5%) di atas quote backend
- Adapter tidak punya slippage yang sama dengan backend calculation

Cek:
1. Apakah frontend menerapkan slippage tambahan?
2. Apakah adapter menghitung output dengan slippage berbeda?
3. Apakah adapter punya reserves yang cukup?
""")
