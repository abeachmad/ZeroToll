#!/usr/bin/env python3
from eth_account import Account
import os

# Generate new account for testnet
account = Account.create()

print("🔑 TESTNET ACCOUNT GENERATED")
print("=" * 40)
print(f"Address: {account.address}")
print(f"Private Key: {account.key.hex()}")
print()
print("⚠️  TESTNET ONLY - DO NOT USE IN PRODUCTION")
print()
print("📝 To use this account:")
print("1. Add to backend/.env:")
print(f"   RELAYER_PRIVATE_KEY={account.key.hex()}")
print()
print("2. Fund with testnet tokens:")
print(f"   • Sepolia ETH: https://sepoliafaucet.com/")
print(f"   • Amoy POL: https://faucet.polygon.technology/")
print()
print("3. Restart backend:")
print("   cd backend && venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000")