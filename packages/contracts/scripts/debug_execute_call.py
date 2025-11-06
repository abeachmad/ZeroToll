#!/usr/bin/env python3
import os
import sys
from web3 import Web3
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / '.env')
load_dotenv()

RPC = os.getenv('RPC_SEPOLIA', 'https://ethereum-sepolia-rpc.publicnode.com')
ROUTER = os.getenv('SEPOLIA_ROUTERHUB', '0x19091A6c655704c8fb55023635eE3298DcDf66FF')
FROM = os.getenv('RELAYER_ADDRESS', '0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A')

if len(sys.argv) < 2:
    print('Usage: debug_execute_call.py <input_hex>')
    sys.exit(1)

input_hex = sys.argv[1]
if input_hex.startswith('0x'):
    data = input_hex
else:
    data = '0x' + input_hex

w3 = Web3(Web3.HTTPProvider(RPC))
print('RPC:', RPC)
print('RouterHub:', ROUTER)
print('From:', FROM)

tx = {
    'to': Web3.to_checksum_address(ROUTER),
    'from': Web3.to_checksum_address(FROM),
    'data': data,
}

try:
    # Use eth_call to simulate and capture revert reason
    res = w3.provider.make_request('eth_call', [tx, 'latest'])
    if 'result' in res:
        print('Call returned (no revert). Raw result:', res['result'])
    else:
        print('Result object:', res)
        if 'error' in res:
            err = res['error']
            print('Error message:', err.get('message'))
            # Try to parse data
            errdata = err.get('data')
            if errdata:
                print('Error data:', errdata)
                # If data is dict, get first value
                if isinstance(errdata, dict):
                    first = list(errdata.values())[0]
                    errdata = first
                # decode revert string if present
                if isinstance(errdata, str) and errdata.startswith('0x'):
                    try:
                        bytes_data = Web3.toBytes(hexstr=errdata)
                        # standard revert ABI: 0x08c379a0 + offset + length + msg
                        if bytes_data[:4] == Web3.toBytes(hexstr='0x08c379a0'):
                            # skip selector + 4 words header = 4 + 32*2 = 68 bytes? handle generically
                            # find ASCII in bytes
                            ascii_message = bytes_data[4:]
                            # try to extract printable tail
                            msg = ascii_message.decode(errors='ignore')
                            print('Decoded error payload (raw):', msg)
                    except Exception as e:
                        print('Failed to decode error data:', e)
except Exception as e:
    # web3.py might raise ValueError with revert data
    print('Exception during eth_call:', repr(e))
    try:
        # try to extract data attribute
        if hasattr(e, 'args') and e.args:
            print('Exception args[0]:', e.args[0])
    except Exception:
        pass

print('\nFinished')
