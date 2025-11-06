"""
Web3 Transaction Builder for ZeroToll RouterHub

Builds, signs, and sends real blockchain transactions
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from web3 import Web3
from web3.middleware import geth_poa_middleware
from eth_account import Account
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent / '.env')
load_dotenv()  # Also try current directory

logger = logging.getLogger(__name__)

# RPC endpoints per chain
RPC_ENDPOINTS = {
    11155111: os.getenv("RPC_SEPOLIA", "https://ethereum-sepolia-rpc.publicnode.com"),
    80002: os.getenv("RPC_AMOY", "https://rpc-amoy.polygon.technology"),
    421614: os.getenv("RPC_ARBITRUM_SEPOLIA", "https://sepolia-rollup.arbitrum.io/rpc"),
    11155420: os.getenv("RPC_OPTIMISM_SEPOLIA", "https://sepolia.optimism.io"),
}

# RouterHub addresses per chain (from deployment)
ROUTER_HUB_ADDRESSES = {
    11155111: os.getenv("SEPOLIA_ROUTERHUB"),
    80002: os.getenv("AMOY_ROUTERHUB"),
    421614: os.getenv("ARB_SEPOLIA_ROUTERHUB"),
    11155420: os.getenv("OP_SEPOLIA_ROUTERHUB"),
}

# Relayer private key (signs transactions)
RELAYER_PRIVATE_KEY = os.getenv("RELAYER_PRIVATE_KEY")

# RouterHub ABI (minimal for executeRoute)
ROUTER_HUB_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"internalType": "address", "name": "user", "type": "address"},
                    {"internalType": "address", "name": "tokenIn", "type": "address"},
                    {"internalType": "uint256", "name": "amtIn", "type": "uint256"},
                    {"internalType": "address", "name": "tokenOut", "type": "address"},
                    {"internalType": "uint256", "name": "minOut", "type": "uint256"},
                    {"internalType": "uint64", "name": "dstChainId", "type": "uint64"},
                    {"internalType": "uint64", "name": "deadline", "type": "uint64"},
                    {"internalType": "address", "name": "feeToken", "type": "address"},
                    {"internalType": "uint8", "name": "feeMode", "type": "uint8"},
                    {"internalType": "uint256", "name": "feeCapToken", "type": "uint256"},
                    {"internalType": "bytes", "name": "routeHint", "type": "bytes"},
                    {"internalType": "uint256", "name": "nonce", "type": "uint256"},
                ],
                "internalType": "struct IntentLib.Intent",
                "name": "intent",
                "type": "tuple",
            },
            {"internalType": "address", "name": "adapter", "type": "address"},
            {"internalType": "bytes", "name": "routeData", "type": "bytes"},
        ],
        "name": "executeRoute",
        "outputs": [{"internalType": "uint256", "name": "amountOut", "type": "uint256"}],
        "stateMutability": "nonReentrant",
        "type": "function",
    }
]

# Fee mode enum mapping
FEE_MODE_MAP = {
    "NATIVE": 0,
    "INPUT": 1,
    "OUTPUT": 2,
    "STABLE": 3,
}


class Web3TransactionBuilder:
    """Builds and sends Web3 transactions to RouterHub"""
    
    def __init__(self):
        self.web3_clients: Dict[int, Web3] = {}
        self.relayer_account = None
        
        # Initialize Web3 clients for each chain
        for chain_id, rpc_url in RPC_ENDPOINTS.items():
            w3 = Web3(Web3.HTTPProvider(rpc_url))
            
            # Add PoA middleware for Polygon/Arbitrum/Optimism
            if chain_id in [80002, 421614, 11155420]:
                w3.middleware_onion.inject(geth_poa_middleware, layer=0)
            
            self.web3_clients[chain_id] = w3
            logger.info(f"Initialized Web3 client for chain {chain_id}: {w3.is_connected()}")
        
        # Initialize relayer account
        if RELAYER_PRIVATE_KEY:
            self.relayer_account = Account.from_key(RELAYER_PRIVATE_KEY)
            logger.info(f"Relayer account: {self.relayer_account.address}")
        else:
            logger.warning("No relayer private key configured!")
    
    def build_execute_route_tx(
        self,
        intent: Dict[str, Any],
        adapter_address: str,
        route_data: bytes,
        chain_id: int,
    ) -> Optional[Dict[str, Any]]:
        """
        Build executeRoute transaction
        
        Args:
            intent: User intent data
            adapter_address: DEX/Bridge adapter address
            route_data: Encoded route data for adapter
            chain_id: Source chain ID
        
        Returns:
            Transaction dict ready to sign and send
        """
        if not self.relayer_account:
            logger.error("No relayer account configured")
            return None
        
        w3 = self.web3_clients.get(chain_id)
        if not w3:
            logger.error(f"No Web3 client for chain {chain_id}")
            return None
        
        router_address = ROUTER_HUB_ADDRESSES.get(chain_id)
        if not router_address:
            logger.error(f"No RouterHub address for chain {chain_id}")
            return None
        
        # Create contract instance
        router_contract = w3.eth.contract(
            address=Web3.to_checksum_address(router_address),
            abi=ROUTER_HUB_ABI
        )
        
        # Build intent tuple
        intent_tuple = (
            Web3.to_checksum_address(intent["user"]),
            Web3.to_checksum_address(intent["tokenIn"]),
            int(intent["amtIn"]),
            Web3.to_checksum_address(intent["tokenOut"]),
            int(intent["minOut"]),
            int(intent["dstChainId"]),
            int(intent["deadline"]),
            Web3.to_checksum_address(intent["feeToken"]),
            FEE_MODE_MAP.get(intent["feeMode"], 0),
            int(intent.get("feeCapToken", 0)),
            bytes.fromhex(intent.get("routeHint", "").replace("0x", "")),
            int(intent.get("nonce", 0)),
        )
        
        # Build transaction
        try:
            nonce = w3.eth.get_transaction_count(self.relayer_account.address)
            gas_price = w3.eth.gas_price
            
            # Estimate gas
            try:
                gas_estimate = router_contract.functions.executeRoute(
                    intent_tuple,
                    Web3.to_checksum_address(adapter_address),
                    route_data
                ).estimate_gas({"from": self.relayer_account.address})
                
                # Add 20% buffer
                gas_limit = int(gas_estimate * 1.2)
            except Exception as e:
                logger.warning(f"Gas estimation failed: {e}, using default")
                gas_limit = 500000
            
            # Build transaction dict
            tx = router_contract.functions.executeRoute(
                intent_tuple,
                Web3.to_checksum_address(adapter_address),
                route_data
            ).build_transaction({
                "from": self.relayer_account.address,
                "nonce": nonce,
                "gas": gas_limit,
                "gasPrice": gas_price,
                "chainId": chain_id,
            })
            
            logger.info(f"Built transaction: gas={gas_limit}, gasPrice={gas_price}")
            return tx
        
        except Exception as e:
            logger.error(f"Error building transaction: {e}", exc_info=True)
            return None
    
    def sign_and_send_tx(
        self,
        tx: Dict[str, Any],
        chain_id: int,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Sign and send transaction
        
        Args:
            tx: Transaction dict
            chain_id: Chain ID
        
        Returns:
            Tuple of (tx_hash, error_message)
        """
        if not self.relayer_account:
            return None, "No relayer account configured"
        
        w3 = self.web3_clients.get(chain_id)
        if not w3:
            return None, f"No Web3 client for chain {chain_id}"
        
        try:
            # Sign transaction
            signed_tx = w3.eth.account.sign_transaction(tx, self.relayer_account.key)
            
            # Send transaction
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            tx_hash_hex = tx_hash.hex()
            
            logger.info(f"Transaction sent: {tx_hash_hex}")
            
            # Wait for receipt (with timeout)
            try:
                receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
                
                if receipt["status"] == 1:
                    logger.info(f"Transaction successful: {tx_hash_hex}")
                    return tx_hash_hex, None
                else:
                    logger.error(f"Transaction reverted: {tx_hash_hex}")
                    return tx_hash_hex, "Transaction reverted"
            
            except Exception as e:
                # Transaction sent but receipt timeout
                logger.warning(f"Receipt timeout (tx still may succeed): {e}")
                return tx_hash_hex, None
        
        except Exception as e:
            logger.error(f"Error sending transaction: {e}", exc_info=True)
            return None, str(e)
    
    def approve_token(
        self,
        token_address: str,
        spender_address: str,
        amount: int,
        chain_id: int,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Approve token spending (for demo: relayer approves RouterHub)
        
        Returns:
            Tuple of (tx_hash, error_message)
        """
        w3 = self.web3_clients.get(chain_id)
        if not w3 or not self.relayer_account:
            return None, "Web3 client or relayer not configured"
        
        # ERC20 approve ABI
        erc20_abi = [
            {
                "constant": False,
                "inputs": [
                    {"name": "_spender", "type": "address"},
                    {"name": "_value", "type": "uint256"}
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "type": "function"
            }
        ]
        
        try:
            token_contract = w3.eth.contract(
                address=Web3.to_checksum_address(token_address),
                abi=erc20_abi
            )
            
            nonce = w3.eth.get_transaction_count(self.relayer_account.address)
            gas_price = w3.eth.gas_price
            
            tx = token_contract.functions.approve(
                Web3.to_checksum_address(spender_address),
                amount
            ).build_transaction({
                "from": self.relayer_account.address,
                "nonce": nonce,
                "gas": 100000,
                "gasPrice": gas_price,
                "chainId": chain_id,
            })
            
            # Sign and send
            signed_tx = w3.eth.account.sign_transaction(tx, self.relayer_account.key)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            tx_hash_hex = tx_hash.hex()
            
            logger.info(f"Approval transaction sent: {tx_hash_hex}")
            
            # Wait for receipt
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            if receipt["status"] == 1:
                logger.info(f"Approval successful: {tx_hash_hex}")
                return tx_hash_hex, None
            else:
                return tx_hash_hex, "Approval failed"
                
        except Exception as e:
            logger.error(f"Error approving token: {e}", exc_info=True)
            return None, str(e)
    
    def execute_swap_intent(
        self,
        intent: Dict[str, Any],
        adapter_address: str,
        route_data: bytes,
        chain_id: int,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Execute swap intent end-to-end (with auto-approval for demo)
        
        Returns:
            Tuple of (tx_hash, error_message)
        """
        # Step 1: Approve token spending (DEMO MODE: relayer approves for itself)
        # In production, user would approve via frontend
        router_address = ROUTER_HUB_ADDRESSES.get(chain_id)
        if router_address and intent.get("tokenIn"):
            token_in = intent["tokenIn"]
            amt_in = int(intent["amtIn"])
            
            # Skip approval for native tokens (ETH/POL address is 0xEee...)
            if not token_in.lower().startswith("0xeeeeee"):
                logger.info(f"🔐 Approving {amt_in} of token {token_in} for RouterHub...")
                approve_hash, approve_error = self.approve_token(
                    token_in,
                    router_address,
                    amt_in,
                    chain_id
                )
                
                if approve_error:
                    logger.warning(f"⚠️ Approval failed: {approve_error} (continuing anyway)")
                else:
                    logger.info(f"✅ Approval successful: {approve_hash}")
        
        # Step 2: Build transaction
        tx = self.build_execute_route_tx(intent, adapter_address, route_data, chain_id)
        if not tx:
            return None, "Failed to build transaction"
        
        # Step 3: Sign and send
        return self.sign_and_send_tx(tx, chain_id)
    
    def get_transaction_status(
        self,
        tx_hash: str,
        chain_id: int,
    ) -> Optional[Dict[str, Any]]:
        """Get transaction receipt and status"""
        w3 = self.web3_clients.get(chain_id)
        if not w3:
            return None
        
        try:
            receipt = w3.eth.get_transaction_receipt(tx_hash)
            return {
                "status": "success" if receipt["status"] == 1 else "failed",
                "blockNumber": receipt["blockNumber"],
                "gasUsed": receipt["gasUsed"],
                "transactionHash": receipt["transactionHash"].hex(),
            }
        except Exception as e:
            logger.warning(f"Could not get receipt for {tx_hash}: {e}")
            return None


# Global transaction builder instance
tx_builder = Web3TransactionBuilder()


def execute_intent_on_chain(
    intent: Dict[str, Any],
    adapter_address: str,
    route_data: bytes,
    chain_id: int,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Convenience function to execute intent
    
    Returns:
        Tuple of (tx_hash, error_message)
    """
    return tx_builder.execute_swap_intent(intent, adapter_address, route_data, chain_id)
