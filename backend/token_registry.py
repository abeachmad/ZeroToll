"""
Token Registry - Centralized token address lookup
Loads from token_addresses.json for maintainability
"""
import json
from pathlib import Path

# Load token addresses from JSON file
_token_file = Path(__file__).parent / "token_addresses.json"
with open(_token_file, 'r') as f:
    _token_data = json.load(f)

# Convert to old format for backward compatibility
NETWORKS = {}
for chain_id, data in _token_data.items():
    NETWORKS[int(chain_id)] = data["tokens"]

# Legacy format (kept for compatibility)
SEPOLIA = NETWORKS[11155111]
AMOY = NETWORKS[80002]
ARB_SEPOLIA = NETWORKS[421614]
OP_SEPOLIA = NETWORKS[11155420]


def get_token_address(symbol: str, chain_id: int) -> str:
    """
    Get token address from symbol and chain ID
    
    Args:
        symbol: Token symbol (ETH, USDC, etc.)
        chain_id: Chain ID (11155111, 80002, etc.)
    
    Returns:
        Token address or raises ValueError if not found
    """
    chain_tokens = NETWORKS.get(chain_id, {})
    address = chain_tokens.get(symbol.upper())
    
    if not address:
        raise ValueError(f"Token {symbol} not found on chain {chain_id}")
    
    return address


def symbol_to_address(symbol: str, chain_id: int) -> str:
    """Alias for get_token_address"""
    return get_token_address(symbol, chain_id)


def address_to_symbol(address: str, chain_id: int) -> str:
    """
    Get token symbol from address and chain ID
    
    Args:
        address: Token address (0x...)
        chain_id: Chain ID (11155111, 80002, etc.)
    
    Returns:
        Token symbol or the address itself if not found
    """
    chain_tokens = NETWORKS.get(chain_id, {})
    address_lower = address.lower()
    
    for symbol, token_addr in chain_tokens.items():
        if token_addr.lower() == address_lower:
            return symbol
    
    # Return address if not found (for unknown tokens)
    return address


def get_token_decimals(symbol: str, chain_id: int = None) -> int:
    """
    Get token decimals for a symbol
    
    Args:
        symbol: Token symbol
        chain_id: Chain ID (optional, not used currently)
    
    Returns:
        Token decimals (default 18)
    """
    # Standard decimals for known tokens
    decimals_map = {
        "USDC": 6,
        "USDT": 6,
        "PYUSD": 6,
        "ZUSDC": 6,  # zUSDC mirrors USDC
        "ETH": 18,
        "WETH": 18,
        "ZETH": 18,  # zETH mirrors ETH
        "POL": 18,
        "WPOL": 18,
        "WMATIC": 18,
        "ZPOL": 18,  # zPOL mirrors POL
        "LINK": 18,
        "ZLINK": 18,  # zLINK mirrors LINK
        "BTC": 8,
        "WBTC": 8,
    }
    
    return decimals_map.get(symbol.upper(), 18)
