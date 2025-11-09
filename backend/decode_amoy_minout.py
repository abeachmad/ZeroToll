#!/usr/bin/env python3
"""
Decode the exact minOut value from Amoy transaction input
"""
from web3 import Web3

# From Amoy TX input data you provided:
# Position of minDy parameter in swap() call
tx_input = "0xe60269c600000000000000000000000000000000000000000000000000000000000000600000000000000000000000007cafe27c7367fa0e929d4e83578cec838e3ceec700000000000000000000000000000000000000000000000000000000000002000000000000000000000000005a87a3c738cf99db95787d51b627217b6de12f6200000000000000000000000041e94eb019c0762f9bfcf9fb1e58725bfb0e758200000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf900000000000000000000000000000000000000000000000017d8ea52fd50e800000000000000000000000000000000000000000000000000000000000001388200000000000000000000000000000000000000000000000000000000690f228e00000000000000000000000041e94eb019c0762f9bfcf9fb1e58725bfb0e75820000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000690f2036000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c49908fc8b00000000000000000000000041e94eb019c0762f9bfcf9fb1e58725bfb0e7582000000000000000000000000360ad4f9a9a8efe9a8dcb5f461c4cc1047e1dcf900000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000017d8ea52fd50e8000000000000000000000000005335f887e69f4b920bb037062382b9c17aa52ec600000000000000000000000000000000000000000000000000000000690f228e00000000000000000000000000000000000000000000000000000000"

w3 = Web3()

# Decode executeIntent parameters
# struct Intent {
#     address sender;
#     address tokenIn;
#     uint256 amountIn;
#     address tokenOut;
#     uint256 minAmountOut;
#     uint256 maxGasFee;
#     uint256 deadline;
#     address recipient;
#     uint8 feeMode;
#     uint256 feeAmount;
#     bytes routeData;
#     uint256 timestamp;
#     bytes signature;
# }

data = bytes.fromhex(tx_input[2+8:])  # Skip method ID

# Read intent struct from offset 0x60
intent_offset = int.from_bytes(data[0:32], byteorder='big')
print(f"Intent offset: {intent_offset}")

# Navigate to intent data
intent_data = data[intent_offset:]

sender = '0x' + intent_data[12:32].hex()
tokenIn = '0x' + intent_data[32+12:64].hex()
amountIn = int.from_bytes(intent_data[64:96], byteorder='big')
tokenOut = '0x' + intent_data[96+12:128].hex()
minAmountOut = int.from_bytes(intent_data[128:160], byteorder='big')
maxGasFee = int.from_bytes(intent_data[160:192], byteorder='big')
deadline = int.from_bytes(intent_data[192:224], byteorder='big')
recipient = '0x' + intent_data[224+12:256].hex()

print(f"\n📋 DECODED INTENT:")
print(f"Sender: {sender}")
print(f"Token In: {tokenIn}")
print(f"Amount In: {amountIn} = {amountIn / 1e6:.6f} USDC")
print(f"Token Out: {tokenOut}")
print(f"Min Amount Out: {minAmountOut} wei")
print(f"               = {minAmountOut / 1e18:.9f} WMATIC")
print(f"Max Gas Fee: {maxGasFee}")
print(f"Deadline: {deadline}")
print(f"Recipient: {recipient}")

print(f"\n🔍 ANALYSIS:")
print(f"Backend requested minOut: {minAmountOut / 1e18:.6f} WMATIC")
print(f"Adapter quoted: 0.997 WMATIC (from internal trace)")
print(f"Shortfall: {(minAmountOut / 1e18) - 0.997:.6f} WMATIC")
print(f"\n💡 This minOut value is WRONG!")
print(f"   For 1 USDC → WMATIC at $1/$0.55:")
print(f"   Expected: ~1.818 WMATIC")
print(f"   With slippage: ~1.727 WMATIC")
print(f"   Backend calculated: {minAmountOut / 1e18:.6f} WMATIC (!!)")
print(f"\n🎯 Backend multiplied by 10^18 instead of using proper decimal conversion!")
