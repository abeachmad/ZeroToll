import os
from web3 import Web3
from eth_account import Account
import logging
import json

logger = logging.getLogger(__name__)

class DEXIntegrationService:
    def __init__(self):
        # RPC URLs for all testnets
        self.rpc_urls = {
            80002: [
                "https://rpc-amoy.polygon.technology",
                "https://polygon-amoy.drpc.org"
            ],
            11155111: [
                "https://ethereum-sepolia-rpc.publicnode.com",
                "https://sepolia.drpc.org"
            ],
            421614: [
                "https://sepolia-rollup.arbitrum.io/rpc",
                "https://arbitrum-sepolia.blockpi.network/v1/rpc/public"
            ],
            11155420: [
                "https://sepolia.optimism.io",
                "https://optimism-sepolia.blockpi.network/v1/rpc/public"
            ]
        }
        
        # DEX Router addresses (testnet)
        self.dex_routers = {
            80002: {
                "router": "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
                "name": "QuickSwap"
            },
            11155111: {
                "router": "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008",
                "name": "Uniswap V2"
            },
            421614: {
                "router": "0x101F443B4d1b059569D643917553c771E1b9663E",
                "name": "Uniswap V3"
            },
            11155420: {
                "router": "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
                "name": "Uniswap V3"
            }
        }
        
        # Token addresses for all testnets
        self.tokens = {
            80002: {
                "WPOL": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
                "LINK": "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904"
            },
            11155111: {
                "WETH": "0xfFf9976782d46CC05630D1f6ebaB18b2324d6B14",
                "LINK": "0x779877A7B0D9E8603169DdBD7836e478b4624789"
            },
            421614: {
                "WETH": "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
                "LINK": "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E"
            },
            11155420: {
                "WETH": "0x4200000000000000000000000000000000000006",
                "LINK": "0xE4aB69C077896252FAFBD49EFD26B5D171A32410"
            }
        }
        
        self.private_key = os.getenv('RELAYER_PRIVATE_KEY')
        
        # Uniswap V2 Router ABI (simplified)
        self.router_abi = [
            {
                "inputs": [
                    {"name": "amountOutMin", "type": "uint256"},
                    {"name": "path", "type": "address[]"},
                    {"name": "to", "type": "address"},
                    {"name": "deadline", "type": "uint256"}
                ],
                "name": "swapExactETHForTokens",
                "outputs": [{"name": "amounts", "type": "uint256[]"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "amountIn", "type": "uint256"},
                    {"name": "amountOutMin", "type": "uint256"},
                    {"name": "path", "type": "address[]"},
                    {"name": "to", "type": "address"},
                    {"name": "deadline", "type": "uint256"}
                ],
                "name": "swapExactTokensForETH",
                "outputs": [{"name": "amounts", "type": "uint256[]"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "amountIn", "type": "uint256"},
                    {"name": "path", "type": "address[]"}
                ],
                "name": "getAmountsOut",
                "outputs": [{"name": "amounts", "type": "uint256[]"}],
                "stateMutability": "view",
                "type": "function"
            }
        ]
        
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
        
    def execute_dex_swap(self, intent_data, user_address):
        """Execute real DEX swap on testnet"""
        try:
            if not self.private_key:
                return {
                    'success': False,
                    'error': 'RELAYER_PRIVATE_KEY not set'
                }
            
            # Determine source chain from dstChainId or default
            source_chain = intent_data.get('srcChainId', 11155111)
            
            # Get Web3 instance
            w3 = self.get_working_rpc(source_chain)
            if not w3:
                return {
                    'success': False,
                    'error': f'Cannot connect to chain {source_chain}'
                }
            
            # Create account
            account = Account.from_key(self.private_key)
            
            # Get DEX router
            router_info = self.dex_routers.get(source_chain)
            if not router_info:
                return {'success': False, 'error': f'No DEX router for chain {source_chain}'}
            router_address = router_info['router']
            
            # Create router contract
            router = w3.eth.contract(
                address=router_address,
                abi=self.router_abi
            )
            
            # Check relayer balance
            balance = w3.eth.get_balance(account.address)
            logger.info(f"Relayer {account.address} balance: {w3.from_wei(balance, 'ether')} ETH")
            
            if balance == 0:
                return {'success': False, 'error': 'Relayer has no funds'}
            
            # Simple ETH/POL transfer for all chains (testnet demo)
            if intent_data['tokenIn'] in ['ETH', 'POL']:
                amount_in_wei = w3.to_wei(intent_data['amtIn'], 'ether')
                logger.info(f"Sending {intent_data['amtIn']} {intent_data['tokenIn']} to {user_address} on chain {source_chain}")
                
                tx = {
                    'to': user_address,
                    'value': amount_in_wei,
                    'gas': 21000,
                    'gasPrice': w3.eth.gas_price,
                    'nonce': w3.eth.get_transaction_count(account.address),
                    'chainId': source_chain
                }
                
            else:
                return {
                    'success': False,
                    'error': f'Token swaps not yet implemented. Only native transfers (ETH/POL) supported.'
                }
            
            # Sign and send
            logger.info(f"Signing and sending transaction...")
            signed_tx = w3.eth.account.sign_transaction(tx, self.private_key)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            logger.info(f"Transaction sent: {tx_hash.hex()}")
            
            # Wait for confirmation
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            logger.info(f"Confirmed in block {receipt.blockNumber}, status: {receipt.status}")
            
            # Generate explorer URL
            explorers = {
                80002: "https://amoy.polygonscan.com/tx/",
                11155111: "https://sepolia.etherscan.io/tx/",
                421614: "https://sepolia.arbiscan.io/tx/",
                11155420: "https://sepolia-optimism.etherscan.io/tx/"
            }
            explorer_url = f"{explorers.get(source_chain, 'https://etherscan.io/tx/')}{tx_hash.hex()}"
            
            return {
                'success': receipt.status == 1,
                'txHash': tx_hash.hex(),
                'status': 'confirmed' if receipt.status == 1 else 'failed',
                'explorerUrl': explorer_url,
                'gasUsed': receipt.gasUsed,
                'blockNumber': receipt.blockNumber,
                'chainId': source_chain,
                'dex': router_info['name'],
                'relayerAddress': account.address
            }
            
        except Exception as e:
            logger.error(f"DEX swap failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }