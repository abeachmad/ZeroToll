"""
Real DEX Swap Service with Liquidity Checking
"""
import os
from web3 import Web3
from eth_account import Account
import logging

logger = logging.getLogger(__name__)

class DEXSwapService:
    def __init__(self):
        self.rpc_urls = {
            80002: ["https://rpc-amoy.polygon.technology", "https://polygon-amoy.drpc.org"],
            11155111: ["https://ethereum-sepolia-rpc.publicnode.com", "https://sepolia.drpc.org"],
            421614: ["https://sepolia-rollup.arbitrum.io/rpc", "https://arbitrum-sepolia.blockpi.network/v1/rpc/public"],
            11155420: ["https://sepolia.optimism.io", "https://optimism-sepolia.blockpi.network/v1/rpc/public"]
        }
        
        self.dex_routers = {
            80002: {"router": "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", "name": "QuickSwap V2"},
            11155111: {"router": "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008", "name": "Uniswap V2"},
            421614: {"router": "0x101F443B4d1b059569D643917553c771E1b9663E", "name": "Uniswap V3"},
            11155420: {"router": "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", "name": "Uniswap V3"}
        }
        
        self.tokens = {
            80002: {"WPOL": "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9", "LINK": "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904"},
            11155111: {"WETH": "0xfFf9976782d46CC05630D1f6ebaB18b2324d6B14", "LINK": "0x779877A7B0D9E8603169DdBD7836e478b4624789"},
            421614: {"WETH": "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", "LINK": "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E"},
            11155420: {"WETH": "0x4200000000000000000000000000000000000006", "LINK": "0xE4aB69C077896252FAFBD49EFD26B5D171A32410"}
        }
        
        self.private_key = os.getenv('RELAYER_PRIVATE_KEY')
        
        self.router_abi = [
            {"inputs": [{"name": "amountOutMin", "type": "uint256"}, {"name": "path", "type": "address[]"}, {"name": "to", "type": "address"}, {"name": "deadline", "type": "uint256"}], "name": "swapExactETHForTokens", "outputs": [{"name": "amounts", "type": "uint256[]"}], "stateMutability": "payable", "type": "function"},
            {"inputs": [{"name": "amountIn", "type": "uint256"}, {"name": "path", "type": "address[]"}], "name": "getAmountsOut", "outputs": [{"name": "amounts", "type": "uint256[]"}], "stateMutability": "view", "type": "function"}
        ]
        
    def get_working_rpc(self, chain_id):
        for rpc_url in self.rpc_urls[chain_id]:
            try:
                w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10}))
                if w3.is_connected():
                    return w3
            except:
                continue
        return None
    
    def check_liquidity(self, w3, router, amount_in_wei, path, dex_name):
        """Check if DEX has liquidity for the swap"""
        try:
            amounts_out = router.functions.getAmountsOut(amount_in_wei, path).call()
            return {'success': True, 'amountOut': amounts_out[1], 'dex': dex_name}
        except Exception as e:
            error_msg = str(e)
            if 'INSUFFICIENT_LIQUIDITY' in error_msg:
                return {'success': False, 'error': f'No liquidity on {dex_name}', 'dex': dex_name}
            return {'success': False, 'error': f'{dex_name}: {error_msg}', 'dex': dex_name}
    
    def execute_swap(self, intent_data, user_address):
        """Execute DEX swap with liquidity checking"""
        try:
            if not self.private_key:
                return {'success': False, 'error': 'RELAYER_PRIVATE_KEY not set'}
            
            src_chain = intent_data.get('srcChainId', 11155111)
            dst_chain = intent_data.get('dstChainId', 80002)
            token_in = intent_data['tokenIn']
            token_out = intent_data['tokenOut']
            amount_in = intent_data['amtIn']
            
            # Cross-chain not supported yet
            if src_chain != dst_chain:
                return {
                    'success': False,
                    'error': f'Cross-chain swaps not supported. Source: {src_chain}, Destination: {dst_chain}. Use same chain for testing.',
                    'details': 'Cross-chain bridging requires additional infrastructure (Axelar/LayerZero)'
                }
            
            w3 = self.get_working_rpc(src_chain)
            if not w3:
                return {'success': False, 'error': f'Cannot connect to chain {src_chain}'}
            
            account = Account.from_key(self.private_key)
            balance = w3.eth.get_balance(account.address)
            
            if balance == 0:
                return {'success': False, 'error': 'Relayer has no funds'}
            
            router_info = self.dex_routers.get(src_chain)
            if not router_info:
                return {'success': False, 'error': f'No DEX router for chain {src_chain}'}
            
            router = w3.eth.contract(address=Web3.to_checksum_address(router_info['router']), abi=self.router_abi)
            
            # Build swap path
            if token_in == 'ETH' and token_out == 'POL':
                # ETH on Sepolia -> POL on Amoy (cross-chain)
                return {'success': False, 'error': 'Cross-chain ETH->POL requires bridging', 'details': 'Use same-chain swaps for testing'}
            
            elif token_in == 'ETH' and token_out == 'ETH':
                # Same token, different chain
                return {'success': False, 'error': 'Cannot swap ETH to ETH on different chains', 'details': 'Use bridging service'}
            
            elif token_in in ['ETH', 'POL'] and token_out == 'LINK':
                # Native -> LINK swap
                weth_key = 'WETH' if src_chain != 80002 else 'WPOL'
                weth_addr = Web3.to_checksum_address(self.tokens[src_chain][weth_key])
                link_addr = Web3.to_checksum_address(self.tokens[src_chain]['LINK'])
                path = [weth_addr, link_addr]
                
                amount_in_wei = w3.to_wei(amount_in, 'ether')
                
                # Check liquidity
                liquidity_check = self.check_liquidity(w3, router, amount_in_wei, path, router_info['name'])
                
                if not liquidity_check['success']:
                    return {
                        'success': False,
                        'error': f"No liquidity available for {token_in} -> {token_out} swap",
                        'details': {
                            'dex': router_info['name'],
                            'chain': src_chain,
                            'path': f"{token_in} -> LINK",
                            'reason': liquidity_check['error'],
                            'suggestion': 'Try smaller amounts or use different token pairs'
                        }
                    }
                
                # Execute swap
                min_out = int(liquidity_check['amountOut'] * 0.95)
                deadline = int(w3.eth.get_block('latest')['timestamp']) + 1200
                
                tx = router.functions.swapExactETHForTokens(min_out, path, user_address, deadline).build_transaction({
                    'from': account.address,
                    'value': amount_in_wei,
                    'gas': 300000,
                    'gasPrice': w3.eth.gas_price,
                    'nonce': w3.eth.get_transaction_count(account.address)
                })
                
                signed_tx = w3.eth.account.sign_transaction(tx, self.private_key)
                tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                
                explorers = {
                    80002: "https://amoy.polygonscan.com/tx/",
                    11155111: "https://sepolia.etherscan.io/tx/",
                    421614: "https://sepolia.arbiscan.io/tx/",
                    11155420: "https://sepolia-optimism.etherscan.io/tx/"
                }
                
                return {
                    'success': receipt.status == 1,
                    'txHash': tx_hash.hex(),
                    'status': 'confirmed' if receipt.status == 1 else 'failed',
                    'explorerUrl': f"{explorers[src_chain]}{tx_hash.hex()}",
                    'gasUsed': receipt.gasUsed,
                    'blockNumber': receipt.blockNumber,
                    'chainId': src_chain,
                    'dex': router_info['name']
                }
            
            else:
                return {
                    'success': False,
                    'error': f'Swap pair {token_in} -> {token_out} not supported',
                    'details': 'Currently only ETH/POL -> LINK swaps are supported on same chain'
                }
                
        except Exception as e:
            logger.error(f"Swap failed: {e}")
            return {'success': False, 'error': str(e)}
