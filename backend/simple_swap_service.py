import os
from web3 import Web3
from eth_account import Account
import logging

logger = logging.getLogger(__name__)

class SimpleSwapService:
    def __init__(self):
        # Multiple RPC endpoints for reliability
        self.rpc_urls = {
            80002: [
                "https://rpc-amoy.polygon.technology",
                "https://polygon-amoy.drpc.org",
                "https://polygon-amoy-bor-rpc.publicnode.com"
            ],
            11155111: [
                "https://ethereum-sepolia-rpc.publicnode.com",
                "https://sepolia.drpc.org",
                "https://rpc.sepolia.org"
            ]
        }
        
        self.private_key = os.getenv('RELAYER_PRIVATE_KEY')
        
    def get_working_rpc(self, chain_id):
        """Find working RPC endpoint"""
        for rpc_url in self.rpc_urls[chain_id]:
            try:
                w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10}))
                if w3.is_connected():
                    return w3
            except:
                continue
        return None
        
    def execute_simple_transfer(self, user_address, chain_id):
        """Execute simple transfer to test blockchain connection"""
        try:
            if not self.private_key:
                return {
                    'success': False,
                    'error': 'RELAYER_PRIVATE_KEY not set'
                }
            
            # Get working RPC
            w3 = self.get_working_rpc(chain_id)
            if not w3:
                return {
                    'success': False,
                    'error': f'Cannot connect to chain {chain_id} RPC'
                }
            
            # Create account
            account = Account.from_key(self.private_key)
            
            # Check balance
            balance = w3.eth.get_balance(account.address)
            if balance == 0:
                return {
                    'success': False,
                    'error': f'Relayer has no balance on chain {chain_id}. Fund {account.address}'
                }
            
            # Simple transfer transaction
            tx = {
                'to': user_address,
                'value': w3.to_wei(0.0001, 'ether'),  # Very small amount
                'gas': 21000,
                'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(account.address),
                'chainId': chain_id
            }
            
            # Sign and send
            signed_tx = w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            
            # Explorer URL
            if chain_id == 80002:
                explorer_url = f"https://amoy.polygonscan.com/tx/{tx_hash.hex()}"
            else:
                explorer_url = f"https://sepolia.etherscan.io/tx/{tx_hash.hex()}"
            
            return {
                'success': receipt.status == 1,
                'txHash': tx_hash.hex(),
                'status': 'confirmed',
                'explorerUrl': explorer_url,
                'gasUsed': receipt.gasUsed,
                'blockNumber': receipt.blockNumber,
                'chainId': chain_id,
                'relayerAddress': account.address
            }
            
        except Exception as e:
            logger.error(f"Transfer failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }