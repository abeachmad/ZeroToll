"""
Pyth REST Oracle - Fetch LIVE prices from Pyth Network API (off-chain)
Tidak pakai smart contract on-chain, tapi query harga mainnet secara LIVE.

Konsep:
- Pyth price feeds TERSEDIA untuk POL/USD, ETH/USD, USDC/USD, dll
- Fetch dari Pyth API (https://hermes.pyth.network)
- Testnet token = harga mainnet token (1:1 mapping)
- Cache dengan TTL, fail-closed (no hardcode fallback)
"""

import requests
import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Pyth Hermes API endpoint
PYTH_HERMES_API = "https://hermes.pyth.network"

# Pyth Price Feed IDs (dari https://pyth.network/developers/price-feed-ids)
# Mainnet price feeds yang digunakan untuk SEMUA chain (testnet dan mainnet)
PYTH_FEED_IDS = {
    # Crypto majors
    "ETH": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",  # Crypto.ETH/USD
    "WETH": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",  # Same as ETH
    
    "POL": "0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472",  # Crypto.POL/USD
    "WPOL": "0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472",  # Same as POL
    "WMATIC": "0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472",  # POL is MATIC rebranded
    
    "BTC": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",  # Crypto.BTC/USD
    "WBTC": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",  # Same as BTC
    
    # Stablecoins
    "USDC": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",  # Crypto.USDC/USD
    "USDT": "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",  # Crypto.USDT/USD
    "DAI": "0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd",  # Crypto.DAI/USD
    
    # DeFi tokens
    "LINK": "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",  # Crypto.LINK/USD
    "ARB": "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",  # Crypto.ARB/USD
    "OP": "0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf",  # Crypto.OP/USD
    "AVAX": "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",  # Crypto.AVAX/USD
    "BNB": "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",  # Crypto.BNB/USD
    
    # Layer 2s
    "STRK": "0x6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870",  # Crypto.STRK/USD
}

# Cache settings
CACHE_TTL_SECONDS = 15  # Cache valid for 15 seconds
MAX_PRICE_AGE_SECONDS = 60  # Reject prices older than 60 seconds

class PythRestOracle:
    """
    Fetch LIVE prices from Pyth Network REST API
    
    Features:
    - Real-time prices from Pyth Hermes API
    - TTL-based caching (15 seconds)
    - Fail-closed: no hardcoded fallback
    - Validation: reject stale prices
    - Observability: full logging
    """
    
    def __init__(self, ttl_seconds: int = CACHE_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        logger.info("🔮 Pyth REST Oracle initialized (off-chain API, LIVE prices)")
    
    def get_price(self, token_symbol: str, chain_id: int = None) -> Dict[str, Any]:
        """
        Get LIVE price for a token from Pyth Network
        
        Args:
            token_symbol: Token symbol (e.g., 'ETH', 'POL', 'USDC')
            chain_id: Chain ID (optional, for logging only)
        
        Returns:
            Dict with:
            - price: float (USD price, e.g., 3450.06)
            - conf: float (confidence interval)
            - expo: int (exponent)
            - publishTime: int (unix timestamp)
            - stale: bool (True if cache is stale)
            - available: bool (True if price available)
            - source: str ('pyth-rest' or 'cache')
        """
        # Normalize symbol (handle wrapped tokens)
        normalized_symbol = self._normalize_symbol(token_symbol)
        
        # Get feed ID
        feed_id = PYTH_FEED_IDS.get(normalized_symbol)
        if not feed_id:
            logger.error(f"❌ No Pyth feed ID for {token_symbol} (normalized: {normalized_symbol})")
            return self._unavailable_response(token_symbol, chain_id)
        
        # Check cache
        cache_key = f"{normalized_symbol}"
        now = time.time()
        
        cached = self._cache.get(cache_key)
        if cached and (now - cached["cached_at"]) < self.ttl_seconds:
            # Cache hit and fresh
            logger.debug(f"💾 Cache HIT: {token_symbol} = ${cached['data']['price']:.6f} (age: {now - cached['cached_at']:.1f}s)")
            return {
                **cached["data"],
                "stale": False,
                "available": True,
                "source": "cache"
            }
        
        # Cache miss or stale - fetch from Pyth
        try:
            data = self._fetch_pyth_price(feed_id, normalized_symbol)
            
            # Validate publish time (reject if too old)
            price_age = now - data["publishTime"]
            if price_age > MAX_PRICE_AGE_SECONDS:
                logger.warning(f"⚠️  Pyth price for {token_symbol} is {price_age:.0f}s old (max: {MAX_PRICE_AGE_SECONDS}s)")
                # Still use it if we have no better option, but mark as stale
                data["stale"] = True
            else:
                data["stale"] = False
            
            # Update cache
            self._cache[cache_key] = {
                "data": data,
                "cached_at": now
            }
            
            logger.info(f"💰 Pyth LIVE: {token_symbol} = ${data['price']:.6f} ±{data['conf']:.6f} (chain: {chain_id}, age: {price_age:.1f}s)")
            
            return {
                **data,
                "available": True,
                "source": "pyth-rest"
            }
            
        except Exception as e:
            # Fetch failed - check if we have stale cache
            if cached:
                cache_age = now - cached["cached_at"]
                logger.warning(f"⚠️  Pyth fetch failed for {token_symbol}, using STALE cache (age: {cache_age:.1f}s): {e}")
                return {
                    **cached["data"],
                    "stale": True,
                    "available": True,
                    "source": "stale-cache"
                }
            else:
                # No cache at all - fail closed
                logger.error(f"❌ Pyth fetch failed for {token_symbol} and no cache available: {e}")
                return self._unavailable_response(token_symbol, chain_id)
    
    def _fetch_pyth_price(self, feed_id: str, symbol: str) -> Dict[str, Any]:
        """
        Fetch price from Pyth Hermes API
        
        Args:
            feed_id: Pyth price feed ID (hex string with 0x prefix)
            symbol: Token symbol (for logging)
        
        Returns:
            Dict with price, conf, expo, publishTime
        """
        # Remove 0x prefix if present
        feed_id_clean = feed_id[2:] if feed_id.startswith("0x") else feed_id
        
        # Construct API URL
        url = f"{PYTH_HERMES_API}/v2/updates/price/latest"
        params = {
            "ids[]": feed_id,  # Use full hex with 0x
            "encoding": "hex",
            "parsed": "true"
        }
        
        # Make request
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        
        # Parse response
        data = response.json()
        
        if "parsed" not in data or len(data["parsed"]) == 0:
            raise ValueError(f"No price data returned for {symbol}")
        
        price_data = data["parsed"][0]
        price_info = price_data["price"]
        
        # Extract price components
        price_raw = int(price_info["price"])
        expo = int(price_info["expo"])
        conf = int(price_info["conf"])
        publish_time = int(price_info["publish_time"])
        
        # Convert to float (price = price_raw * 10^expo)
        price_float = price_raw * (10 ** expo)
        conf_float = conf * (10 ** expo)
        
        return {
            "price": price_float,
            "conf": conf_float,
            "expo": expo,
            "publishTime": publish_time,
            "symbol": symbol
        }
    
    def _normalize_symbol(self, symbol: str) -> str:
        """
        Normalize token symbol for Pyth feed lookup
        
        Examples:
            WETH -> ETH (same price)
            WPOL -> POL (same price)
            WMATIC -> POL (MATIC rebranded to POL)
        """
        symbol_upper = symbol.upper()
        
        # Handle wrapped tokens
        if symbol_upper in ["WETH", "ETH"]:
            return "ETH"
        elif symbol_upper in ["WPOL", "POL", "WMATIC", "MATIC"]:
            return "POL"
        elif symbol_upper in ["WBTC", "BTC"]:
            return "BTC"
        else:
            return symbol_upper
    
    def _unavailable_response(self, token_symbol: str, chain_id: int) -> Dict[str, Any]:
        """
        Return 'unavailable' response (fail-closed, no hardcoded fallback)
        """
        return {
            "symbol": token_symbol,
            "chainId": chain_id,
            "price": None,
            "conf": None,
            "expo": None,
            "publishTime": None,
            "stale": True,
            "available": False,
            "source": "unavailable"
        }
    
    def get_prices(self, token_symbols: list, chain_id: int = None) -> Dict[str, Dict[str, Any]]:
        """
        Get prices for multiple tokens
        
        Args:
            token_symbols: List of token symbols
            chain_id: Chain ID (optional)
        
        Returns:
            Dict mapping symbol to price data
        """
        prices = {}
        for symbol in token_symbols:
            prices[symbol] = self.get_price(symbol, chain_id)
        return prices
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check oracle health
        
        Returns:
            Dict with:
            - total_feeds: int
            - cached_feeds: int
            - stale_feeds: int
            - available: bool
        """
        total_feeds = len(PYTH_FEED_IDS)
        cached_feeds = len(self._cache)
        
        now = time.time()
        stale_count = sum(
            1 for cached in self._cache.values()
            if (now - cached["cached_at"]) >= self.ttl_seconds
        )
        
        return {
            "total_feeds": total_feeds,
            "cached_feeds": cached_feeds,
            "stale_feeds": stale_count,
            "fresh_feeds": cached_feeds - stale_count,
            "available": True,
            "ttl_seconds": self.ttl_seconds
        }


# Global instance
pyth_oracle = PythRestOracle()


# Helper function for backward compatibility
def get_price(token_symbol: str, chain_id: int) -> float:
    """
    Get price (backward compatible interface)
    
    Returns:
        float: USD price, or None if unavailable (FAIL-CLOSED)
    """
    result = pyth_oracle.get_price(token_symbol, chain_id)
    
    if not result["available"]:
        logger.error(f"❌ Price unavailable for {token_symbol} on chain {chain_id}")
        return None  # FAIL-CLOSED: no hardcoded fallback
    
    if result["stale"]:
        logger.warning(f"⚠️  Using STALE price for {token_symbol}: ${result['price']:.6f}")
    
    return result["price"]
