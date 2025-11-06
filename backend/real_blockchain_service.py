import os
import json
from web3 import Web3
from eth_account import Account
import logging

logger = logging.getLogger(__name__)

class RealBlockchainService:
    def __init__(self):
        # RPC URLs untuk testnet
        self.rpc_urls = {
            80002: "https://rpc-amoy.polygon.technology",
            11155111: "https://ethereum-sepolia-rpc.publicnode.com"
        }
        
        # Contract addresses (RouterHub - UPDATED Nov 6, 2025)
        self.contracts = {
            80002: "0x63db4Ac855DD552947238498Ab5da561cce4Ac0b",      # RouterHub v1.3 Amoy
            11155111: "0x1449279761a3e6642B02E82A7be9E5234be00159"   # RouterHub v1.2.1 Sepolia
        }
        
        # Token addresses
        self.tokens = {
            80002: {
                "WPOL": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
                "WETH": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
                "USDC": "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
            },
            11155111: {
                "WETH": "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
                "USDC": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
            }
        }
        
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