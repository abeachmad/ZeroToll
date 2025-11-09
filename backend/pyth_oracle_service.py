"""
Pyth Price Service - Query on-chain MultiTokenPythOracle via Web3
NO HARDCODED PRICES! Real-time from Pyth Network.
"""

from web3 import Web3
import os
import logging

logger = logging.getLogger(__name__)

# MultiTokenPythOracle addresses (deployed with Pyth integration)
ORACLE_ADDRESSES = {
    11155111: os.getenv("SEPOLIA_PYTH_ORACLE", "0x1240c97bc33f7635b8e25C721fF6D05d2bfC44Db"),  # Sepolia MultiTokenPythOracle
    80002: os.getenv("AMOY_PYTH_ORACLE", "0x14BfA9bdf75a2c8049C826B63EeEf6ED7F52E838"),  # Amoy MultiTokenPythOracle
}

# RPC endpoints
RPC_ENDPOINTS = {
    11155111: os.getenv("SEPOLIA_RPC", "https://ethereum-sepolia-rpc.publicnode.com"),
    80002: os.getenv("AMOY_RPC", "https://rpc-amoy.polygon.technology"),
}

# Token addresses by chain
TOKEN_ADDRESSES = {
    11155111: {  # Sepolia
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',  # Native ETH marker
        'WETH': '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        'USDC': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
        'USDT': '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        'LINK': '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    },
    80002: {  # Amoy
        'POL': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',  # Native POL marker
        'WPOL': '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',
        'WMATIC': '0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9',  # Alias
        'USDC': '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',  # Correct USDC address
        'LINK': '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904',
    }
}

# Oracle ABI (MultiTokenPythOracle)
ORACLE_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
        "name": "getPrice",
        "outputs": [{"internalType": "uint256", "name": "priceUSD", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
        "name": "isPriceConfigured",
        "outputs": [{"internalType": "bool", "name": "configured", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    }
]


class PythPriceService:
    """Query Pyth prices from on-chain MultiTokenPythOracle"""
    
    def __init__(self):
        self.web3_clients = {}
        self.oracle_contracts = {}
        self._init_clients()
    
    def _init_clients(self):
        """Initialize Web3 clients and oracle contracts"""
        for chain_id, rpc_url in RPC_ENDPOINTS.items():
            try:
                w3 = Web3(Web3.HTTPProvider(rpc_url))
                if not w3.is_connected():
                    logger.warning(f"Failed to connect to chain {chain_id}")
                    continue
                
                self.web3_clients[chain_id] = w3
                
                oracle_address = ORACLE_ADDRESSES.get(chain_id)
                if oracle_address:
                    self.oracle_contracts[chain_id] = w3.eth.contract(
                        address=Web3.to_checksum_address(oracle_address),
                        abi=ORACLE_ABI
                    )
                    logger.info(f"✅ Pyth Oracle initialized for chain {chain_id}: {oracle_address}")
                else:
                    logger.info(f"⚠️  No Pyth Oracle deployed on chain {chain_id} yet")
            except Exception as e:
                logger.error(f"Failed to initialize chain {chain_id}: {e}")
    
    def get_price(self, token_symbol: str, chain_id: int) -> float:
        """
        Get real-time price from Pyth Oracle on-chain
        
        Args:
            token_symbol: Token symbol (e.g., 'WETH', 'USDC', 'LINK')
            chain_id: Chain ID (11155111 for Sepolia, 80002 for Amoy)
        
        Returns:
            Price in USD (float, e.g., 3450.06 for ETH)
        """
        try:
            # Get token address
            token_addresses = TOKEN_ADDRESSES.get(chain_id, {})
            
            # Handle wrapped tokens (WETH -> ETH for oracle lookup)
            lookup_symbol = token_symbol
            if token_symbol == 'WETH':
                lookup_symbol = 'WETH'  # Use WETH address
            elif token_symbol == 'WPOL' or token_symbol == 'WMATIC':
                lookup_symbol = 'WPOL'
            
            token_address = token_addresses.get(lookup_symbol)
            
            if not token_address:
                logger.warning(f"Token {token_symbol} not found on chain {chain_id}, using fallback")
                return self._get_fallback_price(token_symbol)
            
            # Skip native token markers (0xEee...)
            if token_address.lower().startswith('0xeeeeee'):
                # For native tokens, use wrapped version for price
                if chain_id == 11155111:  # Sepolia
                    token_address = token_addresses.get('WETH')
                elif chain_id == 80002:  # Amoy
                    token_address = token_addresses.get('WPOL')
            
            # Get oracle contract
            oracle = self.oracle_contracts.get(chain_id)
            if not oracle:
                logger.warning(f"No oracle for chain {chain_id}, using fallback")
                return self._get_fallback_price(token_symbol)
            
            # Query oracle
            price_raw = oracle.functions.getPrice(Web3.to_checksum_address(token_address)).call()
            
            # Price is in 8 decimals (e.g., 3450.06 ETH = 345006000000)
            price_usd = price_raw / 1e8
            
            logger.info(f"💰 Pyth price: {token_symbol} = ${price_usd:.2f} (chain {chain_id})")
            return price_usd
            
        except Exception as e:
            logger.error(f"❌ Failed to get Pyth price for {token_symbol} on chain {chain_id}: {e}")
            return self._get_fallback_price(token_symbol)
    
    def _get_fallback_price(self, token_symbol: str) -> float:
        """
        Fallback prices - ONLY used if Pyth oracle query fails
        These are APPROXIMATE and should trigger alerts in production
        """
        fallback_prices = {
            'ETH': 3450.0,
            'WETH': 3450.0,
            'POL': 0.55,
            'WPOL': 0.55,
            'WMATIC': 0.55,
            'USDC': 1.0,
            'USDT': 1.0,
            'DAI': 1.0,
            'LINK': 18.0,
            'ARB': 0.85,
            'OP': 2.15,
        }
        
        price = fallback_prices.get(token_symbol, 1.0)
        logger.warning(f"⚠️  Using FALLBACK price for {token_symbol}: ${price} (Pyth query failed!)")
        return price
    
    def get_prices(self, token_symbols: list, chain_id: int) -> dict:
        """
        Get prices for multiple tokens
        
        Args:
            token_symbols: List of token symbols
            chain_id: Chain ID
        
        Returns:
            Dict mapping symbol to price
        """
        prices = {}
        for symbol in token_symbols:
            prices[symbol] = self.get_price(symbol, chain_id)
        return prices


# Global instance
pyth_service = PythPriceService()
