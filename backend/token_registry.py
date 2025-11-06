"""
Token Registry - Maps token symbols to addresses per chain
"""

# Token addresses per chain
TOKEN_REGISTRY = {
    11155111: {  # Sepolia
        "ETH": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # Native ETH
        "WETH": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        "USDC": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        "PYUSD": "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9",
        "LINK": "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    },
    80002: {  # Amoy
        "POL": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",  # Native POL
        "WMATIC": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
        "USDC": "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
        "LINK": "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
    },
    421614: {  # Arbitrum Sepolia
        "ETH": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "WETH": "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
        "USDC": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        "LINK": "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
    },
    11155420: {  # Optimism Sepolia
        "ETH": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        "WETH": "0x4200000000000000000000000000000000000006",
        "USDC": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
        "LINK": "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    },
}


def get_token_address(symbol: str, chain_id: int) -> str:
    """
    Get token address from symbol and chain ID
    
    Args:
        symbol: Token symbol (ETH, USDC, etc.)
        chain_id: Chain ID (11155111, 80002, etc.)
    
    Returns:
        Token address or raises ValueError if not found
    """
    chain_tokens = TOKEN_REGISTRY.get(chain_id, {})
    address = chain_tokens.get(symbol.upper())
    
    if not address:
        raise ValueError(f"Token {symbol} not found on chain {chain_id}")
    
    return address


def symbol_to_address(symbol: str, chain_id: int) -> str:
    """Alias for get_token_address"""
    return get_token_address(symbol, chain_id)
