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
