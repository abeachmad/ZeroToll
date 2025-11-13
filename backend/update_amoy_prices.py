"""
Amoy Oracle Price Updater
Update SimpleMockOracle di Amoy dengan harga LIVE dari Pyth REST API

Usage:
    python3 update_amoy_prices.py [--interval 30]

Cara kerja:
1. Fetch harga LIVE dari Pyth REST API (sama seperti backend)
2. Update SimpleMockOracle di Amoy dengan harga tersebut
3. Loop tiap 30 detik (atau sesuai interval)
"""

import time
import logging
import argparse
import os
from web3 import Web3
from dotenv import load_dotenv
from pyth_rest_oracle import pyth_oracle

# Load environment
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Amoy configuration
AMOY_RPC = os.getenv("AMOY_RPC", "https://rpc-amoy.polygon.technology")
ORACLE_ADDRESS = os.getenv("AMOY_SIMPLE_ORACLE", "0xA5965227D9e59DF0C43ce000E155e6f1cb10f32e")
PRIVATE_KEY = os.getenv("AMOY_PRIVATE_KEY") or os.getenv("PRIVATE_KEY")

if not PRIVATE_KEY:
    raise ValueError("PRIVATE_KEY or AMOY_PRIVATE_KEY not set in .env")

# Token addresses (Amoy)
TOKENS = {
    "WMATIC": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
    "USDC": "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    "LINK": "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904",
}

# SimpleMockOracle ABI (minimal)
ORACLE_ABI = [
    {
        "inputs": [
            {"name": "tokens", "type": "address[]"},
            {"name": "newPrices", "type": "uint256[]"}
        ],
        "name": "setPrices",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "token", "type": "address"}],
        "name": "getPrice",
        "outputs": [{"name": "priceUSD", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]


class AmoyPriceUpdater:
    """Update prices di SimpleMockOracle dengan data dari Pyth REST API"""
    
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(AMOY_RPC))
        if not self.w3.is_connected():
            raise ConnectionError(f"Failed to connect to Amoy RPC: {AMOY_RPC}")
        
        self.account = self.w3.eth.account.from_key(PRIVATE_KEY)
        self.oracle = self.w3.eth.contract(
            address=Web3.to_checksum_address(ORACLE_ADDRESS),
            abi=ORACLE_ABI
        )
        
        logger.info(f"✅ Connected to Amoy")
        logger.info(f"   Oracle: {ORACLE_ADDRESS}")
        logger.info(f"   Account: {self.account.address}")
        logger.info(f"   Balance: {self.w3.from_wei(self.w3.eth.get_balance(self.account.address), 'ether'):.4f} POL")
    
    def fetch_pyth_prices(self):
        """Fetch harga dari Pyth REST API"""
        prices = {}
        
        for symbol, address in TOKENS.items():
            # Map symbol for Pyth (WMATIC → POL)
            pyth_symbol = symbol
            if symbol == "WMATIC":
                pyth_symbol = "POL"
            
            price_data = pyth_oracle.get_price(pyth_symbol, chain_id=80002)
            
            if not price_data["available"]:
                logger.warning(f"⚠️  Price unavailable for {symbol}, skipping")
                continue
            
            # Convert to 8 decimals (oracle format)
            price_usd = price_data["price"]
            price_8dec = int(price_usd * 1e8)
            
            prices[address] = {
                "symbol": symbol,
                "price_usd": price_usd,
                "price_8dec": price_8dec,
                "stale": price_data.get("stale", False)
            }
            
            logger.info(f"💰 {symbol}: ${price_usd:.6f} (8dec: {price_8dec})")
        
        return prices
    
    def update_oracle(self, prices):
        """Update prices di oracle on-chain"""
        if not prices:
            logger.warning("No prices to update")
            return False
        
        # Prepare arrays
        token_addresses = [Web3.to_checksum_address(addr) for addr in prices.keys()]
        price_values = [data["price_8dec"] for data in prices.values()]
        
        try:
            # Build transaction
            tx = self.oracle.functions.setPrices(
                token_addresses,
                price_values
            ).build_transaction({
                'from': self.account.address,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price,
            })
            
            # Sign and send
            signed_tx = self.account.sign_transaction(tx)
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            
            logger.info(f"📤 TX sent: {tx_hash.hex()}")
            
            # Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            
            if receipt["status"] == 1:
                logger.info(f"✅ Prices updated on-chain! Gas used: {receipt['gasUsed']}")
                
                # Verify
                for addr, data in prices.items():
                    on_chain_price = self.oracle.functions.getPrice(Web3.to_checksum_address(addr)).call()
                    if on_chain_price == data["price_8dec"]:
                        logger.info(f"   ✅ {data['symbol']}: Verified")
                    else:
                        logger.warning(f"   ⚠️  {data['symbol']}: Mismatch! Expected {data['price_8dec']}, got {on_chain_price}")
                
                return True
            else:
                logger.error(f"❌ Transaction reverted!")
                return False
            
        except Exception as e:
            logger.error(f"❌ Update failed: {e}")
            return False
    
    def run(self, interval=30):
        """Main loop"""
        logger.info(f"🔄 Starting price updater (interval: {interval}s)")
        logger.info("   Press Ctrl+C to stop\n")
        
        iteration = 0
        
        try:
            while True:
                iteration += 1
                logger.info(f"{'='*60}")
                logger.info(f"Iteration #{iteration} - {time.strftime('%Y-%m-%d %H:%M:%S')}")
                logger.info(f"{'='*60}")
                
                # Fetch prices
                prices = self.fetch_pyth_prices()
                
                # Update oracle
                if prices:
                    success = self.update_oracle(prices)
                    
                    if success:
                        logger.info(f"✅ Update cycle complete!\n")
                    else:
                        logger.error(f"❌ Update failed!\n")
                else:
                    logger.warning("⚠️  No prices available, skipping update\n")
                
                # Sleep
                logger.info(f"💤 Sleeping for {interval} seconds...\n")
                time.sleep(interval)
                
        except KeyboardInterrupt:
            logger.info("\n\n⏹️  Stopped by user")
        except Exception as e:
            logger.error(f"\n\n❌ Fatal error: {e}")
            raise


def main():
    parser = argparse.ArgumentParser(description="Update Amoy oracle prices from Pyth REST API")
    parser.add_argument("--interval", type=int, default=30, help="Update interval in seconds (default: 30)")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    
    args = parser.parse_args()
    
    updater = AmoyPriceUpdater()
    
    if args.once:
        logger.info("Running once...")
        prices = updater.fetch_pyth_prices()
        if prices:
            updater.update_oracle(prices)
    else:
        updater.run(interval=args.interval)


if __name__ == "__main__":
    main()
