"""
Pyth Network Price Feed Integration
Price Feed IDs: https://pyth.network/developers/price-feed-ids
"""

# Pyth Price Feed IDs (Mainnet & Testnet)
PYTH_PRICE_FEEDS = {
    'ETH': {
        'id': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'symbol': 'Crypto.ETH/USD',
        'decimals': 8
    },
    'POL': {
        'id': '0xffd11c5a1cfd42f80afb2df4d9f264c15f956d68153335374ec10722edd70472',
        'symbol': 'Crypto.MATIC/USD',  # POL was formerly MATIC
        'decimals': 8
    },
    'LINK': {
        'id': '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
        'symbol': 'Crypto.LINK/USD',
        'decimals': 8
    },
    'ARB': {
        'id': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
        'symbol': 'Crypto.ARB/USD',
        'decimals': 8
    },
    'OP': {
        'id': '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
        'symbol': 'Crypto.OP/USD',
        'decimals': 8
    }
}

# Pyth Hermes API endpoints
PYTH_ENDPOINTS = {
    'mainnet': 'https://hermes.pyth.network',
    'testnet': 'https://hermes.pyth.network'  # Same endpoint for testnet
}

def get_price_feed_id(token_symbol):
    """Get Pyth price feed ID for token"""
    token = token_symbol.replace('W', '')  # WETH -> ETH, WPOL -> POL
    return PYTH_PRICE_FEEDS.get(token, {}).get('id')

def get_all_price_feed_ids():
    """Get all price feed IDs"""
    return [feed['id'] for feed in PYTH_PRICE_FEEDS.values()]

async def fetch_pyth_prices(token_symbols):
    """
    Fetch real-time prices from Pyth Network
    
    Args:
        token_symbols: List of token symbols (e.g., ['ETH', 'LINK', 'ARB'])
    
    Returns:
        Dict of {symbol: price}
    """
    import httpx
    
    # Get price feed IDs
    feed_ids = []
    for symbol in token_symbols:
        feed_id = get_price_feed_id(symbol)
        if feed_id:
            feed_ids.append(feed_id)
    
    if not feed_ids:
        return {}
    
    # Fetch from Pyth Hermes API
    try:
        async with httpx.AsyncClient() as client:
            url = f"{PYTH_ENDPOINTS['mainnet']}/api/latest_price_feeds"
            params = {'ids[]': feed_ids}
            response = await client.get(url, params=params, timeout=5.0)
            
            if response.status_code == 200:
                data = response.json()
                prices = {}
                
                for feed in data:
                    price_data = feed.get('price', {})
                    price = int(price_data.get('price', 0))
                    expo = int(price_data.get('expo', 0))
                    
                    # Convert to USD price
                    usd_price = price * (10 ** expo)
                    
                    # Find symbol for this feed
                    for symbol, feed_info in PYTH_PRICE_FEEDS.items():
                        if feed['id'] == feed_info['id']:
                            prices[symbol] = usd_price
                            prices[f'W{symbol}'] = usd_price  # Add wrapped version
                            break
                
                return prices
    except Exception as e:
        print(f"Pyth price fetch failed: {e}")
    
    # Fallback to mock prices
    return {
        'ETH': 3709.35,
        'WETH': 3709.35,
        'POL': 0.179665,
        'WPOL': 0.179665,
        'LINK': 23.45,
        'ARB': 0.85,
        'OP': 2.15
    }
