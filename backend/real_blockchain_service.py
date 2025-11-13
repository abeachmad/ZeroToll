import os
import json
from pathlib import Path
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv
import logging

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class RealBlockchainService:
    def __init__(self):
        # Load RPC URLs from .env with fallbacks
        self.rpc_urls = {
            80002: os.getenv("RPC_AMOY", "https://rpc-amoy.polygon.technology"),
            11155111: os.getenv("RPC_SEPOLIA", "https://ethereum-sepolia-rpc.publicnode.com")
        }
        
        # Load contract addresses from .env (BEST PRACTICE - Nov 8, 2025)
        self.contracts = {
            80002: os.getenv("AMOY_ROUTERHUB", "0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881"),
            11155111: os.getenv("SEPOLIA_ROUTERHUB", "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84")  # Phase 1: Gasless
        }
        
        # Load token addresses from JSON file
        token_file = Path(__file__).parent / "token_addresses.json"
        with open(token_file, 'r') as f:
            token_data = json.load(f)
        
        # Convert to old format for backward compatibility
        self.tokens = {}
        for chain_id, data in token_data.items():
            self.tokens[int(chain_id)] = data["tokens"]
        
        # Load private key
        self.private_key = os.getenv('RELAYER_PRIVATE_KEY')
        
    def execute_real_swap(self, intent_data, user_address):
        """Execute real blockchain swap transaction"""
        try:
            if not self.private_key:
                return {
                    'success': False,
                    'error': 'RELAYER_PRIVATE_KEY not set - cannot execute real transactions'
                }
            
            # Determine chains
            source_chain = 11155111 if intent_data['tokenIn'] == 'ETH' else 80002
            dest_chain = 80002 if source_chain == 11155111 else 11155111
            
            # Get Web3 instance
            w3 = Web3(Web3.HTTPProvider(self.rpc_urls[source_chain]))
            if not w3.is_connected():
                return {
                    'success': False,
                    'error': f'Cannot connect to {source_chain} RPC'
                }
            
            # Create account from private key
            account = Account.from_key(self.private_key)
            
            # Simple transfer transaction for testing
            # In production, this would call RouterHub contract
            tx = {
                'to': user_address,
                'value': w3.to_wei(0.001, 'ether'),  # Send small amount for testing
                'gas': 21000,
                'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(account.address),
                'chainId': source_chain
            }
            
            # Sign transaction
            signed_tx = w3.eth.account.sign_transaction(tx, self.private_key)
            
            # Send transaction
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            # Generate explorer URL
            if source_chain == 80002:
                explorer_url = f"https://amoy.polygonscan.com/tx/{tx_hash.hex()}"
            else:
                explorer_url = f"https://sepolia.etherscan.io/tx/{tx_hash.hex()}"
            
            return {
                'success': receipt.status == 1,
                'txHash': tx_hash.hex(),
                'status': 'confirmed' if receipt.status == 1 else 'failed',
                'explorerUrl': explorer_url,
                'gasUsed': receipt.gasUsed,
                'blockNumber': receipt.blockNumber,
                'chainId': source_chain
            }
            
        except Exception as e:
            logger.error(f"Real blockchain execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'status': 'failed'
            }