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

class BlockchainService:
    def __init__(self):
        # Load RPC URLs from .env with fallbacks
        self.rpc_urls = {
            80002: os.getenv("RPC_AMOY", "https://rpc-amoy.polygon.technology/"),
            11155111: os.getenv("RPC_SEPOLIA", "https://ethereum-sepolia-rpc.publicnode.com")
        }
        
        # Load contract addresses from .env (BEST PRACTICE - Nov 8, 2025)
        self.contracts = {
            80002: {
                "RouterHub": os.getenv("AMOY_ROUTERHUB", "0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881"),
                "FeeSink": os.getenv("AMOY_FEESINK", "0x1F679D174A9fBe4158EABcD24d4A63D6Bcf8f700")
            },
            11155111: {
                "RouterHub": os.getenv("SEPOLIA_ROUTERHUB", "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84"),  # Phase 1: Gasless
                "FeeSink": os.getenv("SEPOLIA_FEESINK", "0x2c7342421eB6Bf2a2368F034b26A19F39DC2C130")
            }
        }
        
        # Load token addresses from JSON file
        token_file = Path(__file__).parent / "token_addresses.json"
        with open(token_file, 'r') as f:
            token_data = json.load(f)
        
        # Convert to old format for backward compatibility
        self.tokens = {}
        for chain_id, data in token_data.items():
            self.tokens[int(chain_id)] = data["tokens"]
        
        # Load private key dari environment
        self.private_key = os.getenv('RELAYER_PRIVATE_KEY')
        if not self.private_key:
            logger.warning("RELAYER_PRIVATE_KEY not set, using demo mode")
            
    def get_web3(self, chain_id):
        """Get Web3 instance for specific chain"""
        rpc_url = self.rpc_urls.get(chain_id)
        if not rpc_url:
            raise ValueError(f"Unsupported chain ID: {chain_id}")
        return Web3(Web3.HTTPProvider(rpc_url))
    
    def get_router_contract(self, chain_id):
        """Get RouterHub contract instance"""
        w3 = self.get_web3(chain_id)
        contract_address = self.contracts[chain_id]["RouterHub"]
        
        # RouterHub ABI (simplified)
        abi = [
            {
                "inputs": [
                    {"name": "intent", "type": "tuple", "components": [
                        {"name": "user", "type": "address"},
                        {"name": "tokenIn", "type": "address"},
                        {"name": "amtIn", "type": "uint256"},
                        {"name": "tokenOut", "type": "address"},
                        {"name": "minOut", "type": "uint256"},
                        {"name": "dstChainId", "type": "uint256"},
                        {"name": "feeMode", "type": "uint8"},
                        {"name": "feeCap", "type": "uint256"},
                        {"name": "deadline", "type": "uint256"},
                        {"name": "nonce", "type": "uint256"}
                    ]},
                    {"name": "adapter", "type": "address"},
                    {"name": "routeData", "type": "bytes"}
                ],
                "name": "executeRoute",
                "outputs": [{"name": "amountOut", "type": "uint256"}],
                "type": "function"
            }
        ]
        
        return w3.eth.contract(address=contract_address, abi=abi)
    
    def execute_swap(self, intent_data, user_address):
        """Execute actual blockchain swap"""
        try:
            if not self.private_key:
                # Demo mode - return mock transaction
                return {
                    'success': True,
                    'txHash': f"0x{'0' * 64}",
                    'status': 'demo',
                    'explorerUrl': None
                }
            
            # Determine source chain based on tokenIn
            source_chain = 11155111 if intent_data['tokenIn'] == 'ETH' else 80002
            dest_chain = 80002 if source_chain == 11155111 else 11155111
            
            w3 = self.get_web3(source_chain)
            account = Account.from_key(self.private_key)
            
            # Get contract
            router = self.get_router_contract(source_chain)
            
            # Convert token symbols to addresses
            token_in_addr = self._get_token_address(intent_data['tokenIn'], source_chain)
            token_out_addr = self._get_token_address(intent_data['tokenOut'], dest_chain)
            
            # Build intent struct
            intent = (
                user_address,  # user
                token_in_addr,  # tokenIn
                int(intent_data['amtIn'] * 10**18),  # amtIn (convert to wei)
                token_out_addr,  # tokenOut
                int(intent_data['minOut'] * 10**18),  # minOut
                dest_chain,  # dstChainId
                self._get_fee_mode_enum(intent_data['feeMode']),  # feeMode
                int(intent_data['feeCap'] * 10**18),  # feeCap
                intent_data['deadline'],  # deadline
                intent_data['nonce']  # nonce
            )
            
            # Mock adapter and route data for demo
            adapter_address = "0x0000000000000000000000000000000000000001"
            route_data = "0x"
            
            # Build transaction
            tx = router.functions.executeRoute(
                intent, 
                adapter_address, 
                route_data
            ).build_transaction({
                'from': account.address,
                'gas': 500000,
                'gasPrice': w3.eth.gas_price,
                'nonce': w3.eth.get_transaction_count(account.address)
            })
            
            # Sign and send transaction
            signed_tx = w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            
            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            explorer_url = self._get_explorer_url(tx_hash.hex(), source_chain)
            
            return {
                'success': receipt.status == 1,
                'txHash': tx_hash.hex(),
                'status': 'confirmed' if receipt.status == 1 else 'failed',
                'explorerUrl': explorer_url,
                'gasUsed': receipt.gasUsed,
                'blockNumber': receipt.blockNumber
            }
            
        except Exception as e:
            logger.error(f"Blockchain execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'status': 'failed'
            }
    
    def _get_token_address(self, symbol, chain_id):
        """Get token contract address"""
        if symbol in ['ETH', 'POL']:
            return "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"  # Native token marker
        
        token_map = self.tokens.get(chain_id, {})
        return token_map.get(symbol, "0x0000000000000000000000000000000000000000")
    
    def _get_fee_mode_enum(self, fee_mode):
        """Convert fee mode string to enum"""
        modes = {
            'NATIVE': 0,
            'INPUT': 1, 
            'OUTPUT': 2,
            'STABLE': 3
        }
        return modes.get(fee_mode, 0)
    
    def _get_explorer_url(self, tx_hash, chain_id):
        """Get explorer URL for transaction"""
        if chain_id == 80002:
            return f"https://amoy.polygonscan.com/tx/{tx_hash}"
        elif chain_id == 11155111:
            return f"https://sepolia.etherscan.io/tx/{tx_hash}"
        return None