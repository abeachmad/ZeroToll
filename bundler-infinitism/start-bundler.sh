#!/bin/bash

# Start Infinitism Bundler for ZeroToll
# Network: Amoy Testnet

cd "$(dirname "$0")"

echo "=== ZEROTOLL BUNDLER (Infinitism) ==="
echo "Network: Amoy Testnet (Chain ID: 80002)"
echo "EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032"
echo "Bundler Address: 0xd4aB7C32fCe0d28882052a83De467b9BE2DBFC8e"
echo "Port: 3000"
echo ""

# Start bundler
yarn run bundler \
  --network https://rpc-amoy.polygon.technology \
  --mnemonic bundler-new.mnemonic \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --beneficiary 0x330A86eE67bA0Da0043EaD201866A32d362C394c \
  --minBalance 0.1 \
  --unsafe \
  --port 3000 \
  --auto
