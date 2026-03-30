#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Use test mnemonic - bundler wallet needs to be funded separately
# Bundler address from test mnemonic: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

yarn bundler \
  --network https://ethereum-sepolia-rpc.publicnode.com \
  --entryPoint 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
  --beneficiary 0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A \
  --minBalance 0.01 \
  --mnemonic "$SCRIPT_DIR/bundler.mnemonic" \
  --unsafe \
  --port 3000 \
  --auto
