"""
Route Planner Client for Python Backend

Communicates with TypeScript route-planner service to get optimal routes
"""

import os
import requests
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# Route planner service URL (can be same backend or separate service)
ROUTE_SERVICE_URL = os.getenv("ROUTE_SERVICE_URL", "http://localhost:3001")

# DEX Adapter addresses per chain (loaded from deployment artifacts)
DEX_ADAPTERS = {
    11155111: {  # Sepolia
        "uniswapV2": os.getenv("SEPOLIA_UNISWAPV2_ADAPTER"),
        "uniswapV3": os.getenv("SEPOLIA_UNISWAPV3_ADAPTER"),
        "mockDex": os.getenv("SEPOLIA_MOCKDEX_ADAPTER"),
        "zeroToll": os.getenv("SEPOLIA_ZEROTOLL_ADAPTER", "0x4E6A591459F0724E19f9B06A584B26fFB724a2a3"),
    },
    80002: {  # Amoy
        "quickswapV2": os.getenv("AMOY_QUICKSWAP_ADAPTER"),
        "mockDex": os.getenv("AMOY_MOCKDEX_ADAPTER"),
        "zeroToll": os.getenv("AMOY_ZEROTOLL_ADAPTER", "0x30bbFff2e090EF88A41C9e8909c197d4bdb47C87"),
    },
    421614: {  # Arbitrum Sepolia
        "uniswapV3": os.getenv("ARB_SEPOLIA_UNISWAPV3_ADAPTER"),
        "mockDex": os.getenv("ARB_SEPOLIA_MOCKDEX_ADAPTER"),
    },
    11155420: {  # Optimism Sepolia
        "uniswapV3": os.getenv("OP_SEPOLIA_UNISWAPV3_ADAPTER"),
        "mockDex": os.getenv("OP_SEPOLIA_MOCKDEX_ADAPTER"),
    },
}

# zToken addresses (for routing to ZeroTollAdapter)
ZTOKEN_ADDRESSES = {
    11155111: {  # Sepolia
        "0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C".lower(): "zUSDC",
        "0x8153FA09Be1689D44C343f119C829F6702A8720b".lower(): "zETH",
        "0x63c31C4247f6AA40B676478226d6FEB5707649D6".lower(): "zPOL",
        "0x4e2dbcCc07D8e5a8C9f420ea60d1e3aEc7B64D2C".lower(): "zLINK",
    },
    80002: {  # Amoy
        "0x257Fb36CD940D1f6a0a4659e8245D3C3FCecB8bD".lower(): "zUSDC",
        "0xfAE5Fb760917682d67Bc2082667C2C5E55A193f9".lower(): "zETH",
        "0xB0A04aB21faAe4A5399938c07EDdfA0FB41d2B9d".lower(): "zPOL",
        "0x51f6c79e5cA4ACF086d0954AfAAf5c72Be56CBb1".lower(): "zLINK",
    },
}

def is_ztoken(token_address: str, chain_id: int) -> bool:
    """Check if token is a zToken"""
    chain_ztokens = ZTOKEN_ADDRESSES.get(chain_id, {})
    return token_address.lower() in chain_ztokens

# Bridge adapters
BRIDGE_ADAPTERS = {
    "mockBridge": {
        11155111: os.getenv("SEPOLIA_MOCKBRIDGE_ADAPTER"),
        80002: os.getenv("AMOY_MOCKBRIDGE_ADAPTER"),
        421614: os.getenv("ARB_SEPOLIA_MOCKBRIDGE_ADAPTER"),
        11155420: os.getenv("OP_SEPOLIA_MOCKBRIDGE_ADAPTER"),
    },
}


class RouteCandidate:
    """Route candidate from route planner"""
    
    def __init__(self, data: Dict[str, Any]):
        self.route_id = data["routeId"]
        self.type = data["type"]  # "same-chain" or "cross-chain"
        self.src_chain_id = data["srcChainId"]
        self.dst_chain_id = data["dstChainId"]
        self.token_in = data["tokenIn"]
        self.token_out = data["tokenOut"]
        self.amount_in = data["amountIn"]
        self.expected_out = data["expectedOut"]
        self.steps = data["steps"]
        self.total_gas_cost = data["totalGasCost"]
        self.pyth_fee = data["pythFee"]
        self.net_user_output = data["netUserOutput"]
        self.score = data["score"]
        self.explain = data["explain"]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "routeId": self.route_id,
            "type": self.type,
            "srcChainId": self.src_chain_id,
            "dstChainId": self.dst_chain_id,
            "tokenIn": self.token_in,
            "tokenOut": self.token_out,
            "amountIn": self.amount_in,
            "expectedOut": self.expected_out,
            "steps": self.steps,
            "totalGasCost": self.total_gas_cost,
            "pythFee": self.pyth_fee,
            "netUserOutput": self.net_user_output,
            "score": self.score,
            "explain": self.explain,
        }


class RoutePlannerClient:
    """Client for route planning service"""
    
    def __init__(self, service_url: str = ROUTE_SERVICE_URL):
        self.service_url = service_url
    
    def plan_routes(
        self,
        user: str,
        token_in: str,
        amt_in: str,
        token_out: str,
        min_out: str,
        src_chain_id: int,
        dst_chain_id: int,
        fee_mode: str,
        deadline: int,
    ) -> List[RouteCandidate]:
        """
        Plan routes for a swap intent
        
        Args:
            user: User wallet address
            token_in: Input token address
            amt_in: Input amount (wei)
            token_out: Output token address
            min_out: Minimum output amount (wei)
            src_chain_id: Source chain ID
            dst_chain_id: Destination chain ID
            fee_mode: Fee payment mode (NATIVE, INPUT, OUTPUT, STABLE)
            deadline: Transaction deadline (unix timestamp)
        
        Returns:
            List of route candidates sorted by score (best first)
        """
        intent = {
            "user": user,
            "tokenIn": token_in,
            "amtIn": amt_in,
            "tokenOut": token_out,
            "minOut": min_out,
            "srcChainId": src_chain_id,
            "dstChainId": dst_chain_id,
            "feeMode": fee_mode,
            "deadline": deadline,
        }
        
        try:
            # If route service is available, call it
            response = requests.post(
                f"{self.service_url}/plan-routes",
                json=intent,
                timeout=5,
            )
            response.raise_for_status()
            routes_data = response.json()["routes"]
            return [RouteCandidate(r) for r in routes_data]
        
        except (requests.RequestException, Exception) as e:
            logger.warning(f"Route service unavailable, using fallback: {e}")
            # Fallback: simple heuristic routing
            return self._fallback_routing(intent)
    
    def get_best_route(
        self,
        user: str,
        token_in: str,
        amt_in: str,
        token_out: str,
        min_out: str,
        src_chain_id: int,
        dst_chain_id: int,
        fee_mode: str,
        deadline: int,
    ) -> Optional[RouteCandidate]:
        """Get the best route for an intent"""
        routes = self.plan_routes(
            user, token_in, amt_in, token_out, min_out,
            src_chain_id, dst_chain_id, fee_mode, deadline
        )
        return routes[0] if routes else None
    
    def _fallback_routing(self, intent: Dict[str, Any]) -> List[RouteCandidate]:
        """
        Fallback routing when route service is unavailable
        Creates a simple mock route using deployed MockDEXAdapter or ZeroTollAdapter for zTokens
        """
        src_chain = intent["srcChainId"]
        dst_chain = intent["dstChainId"]
        token_in = intent["tokenIn"]
        token_out = intent["tokenOut"]
        
        # Check if either token is a zToken - use ZeroTollAdapter
        use_zerotoll = is_ztoken(token_in, src_chain) or is_ztoken(token_out, src_chain)
        
        # Use deployed MockDEXAdapter addresses - Load from .env (BEST PRACTICE)
        # Nov 8, 2025: Updated to use Pyth Oracle (REAL-TIME prices, NO HARDCODE!)
        # Sepolia adapter now queries MultiTokenPythOracle (0x729fBc26977F8df79B45c1c5789A483640E89b4A)
        adapter_addresses = {
            11155111: os.getenv("SEPOLIA_MOCKDEX_ADAPTER", "0x86D1AA2228F3ce649d415F19fC71134264D0E84B"),
            80002: os.getenv("AMOY_MOCKDEX_ADAPTER", "0x7caFe27c7367FA0E929D4e83578Cec838E3Ceec7"),
            421614: os.getenv("ARB_SEPOLIA_MOCKDEX_ADAPTER"),
            11155420: os.getenv("OP_SEPOLIA_MOCKDEX_ADAPTER"),
        }
        
        # Select adapter based on token type
        if use_zerotoll:
            zerotoll_adapters = DEX_ADAPTERS.get(src_chain, {})
            adapter = zerotoll_adapters.get("zeroToll", "0x0000000000000000000000000000000000000001")
            protocol_name = "ZeroTollAdapter"
            logger.info(f"✓ Using ZeroTollAdapter for zToken swap on chain {src_chain}")
        else:
            adapter = adapter_addresses.get(src_chain, "0x0000000000000000000000000000000000000001")
            protocol_name = "UniswapV2" if src_chain == 11155111 else "QuickswapV2"
        
        if src_chain == dst_chain:
            # Same-chain swap
            route = {
                "routeId": f"fallback-{src_chain}-same-chain",
                "type": "same-chain",
                "srcChainId": src_chain,
                "dstChainId": dst_chain,
                "tokenIn": token_in,
                "tokenOut": token_out,
                "amountIn": intent["amtIn"],
                "expectedOut": intent["minOut"],  # Use minOut as estimate
                "steps": [
                    {
                        "type": "swap",
                        "protocol": protocol_name,
                        "adapterAddress": adapter,
                        "tokenIn": token_in,
                        "tokenOut": token_out,
                        "chainId": src_chain,
                        "estimatedGas": 150000,
                    }
                ],
                "totalGasCost": "0",  # Simplified
                "pythFee": "1000000000000000",  # 0.001 ETH
                "netUserOutput": intent["minOut"],
                "score": 100,
                "explain": f"Route via {protocol_name}" + (" (zToken swap)" if use_zerotoll else " (testing mode)"),
            }
            logger.info(f"✓ Created fallback same-chain route for {src_chain} using {protocol_name}")
            return [RouteCandidate(route)]
        
        else:
            # Cross-chain swap
            bridge_adapter = adapter_addresses.get(src_chain, "0x0000000000000000000000000000000000000001")
            route = {
                "routeId": f"fallback-bridge-{src_chain}-{dst_chain}",
                "type": "cross-chain",
                "srcChainId": src_chain,
                "dstChainId": dst_chain,
                "tokenIn": token_in,
                "tokenOut": token_out,
                "amountIn": intent["amtIn"],
                "expectedOut": intent["minOut"],
                "steps": [
                    {
                        "type": "bridge",
                        "protocol": "MockBridge",
                        "adapterAddress": bridge_adapter,
                        "tokenIn": token_in,
                        "tokenOut": token_out,
                        "chainId": src_chain,
                        "estimatedGas": 200000,
                    }
                ],
                "totalGasCost": "0",
                "pythFee": "2000000000000000",  # 0.002 ETH
                "netUserOutput": intent["minOut"],
                "score": 80,
                "explain": "Mock cross-chain route via MockBridge (testing mode)",
            }
            logger.info(f"✓ Created fallback cross-chain route {src_chain} → {dst_chain}")
            return [RouteCandidate(route)]


# Global route planner client instance
route_planner = RoutePlannerClient()


def get_best_route_for_intent(
    user: str,
    token_in: str,
    amt_in: str,
    token_out: str,
    min_out: str,
    src_chain_id: int,
    dst_chain_id: int,
    fee_mode: str,
    deadline: int,
) -> Optional[RouteCandidate]:
    """
    Convenience function to get best route
    
    Returns:
        Best route candidate or None if no route found
    """
    return route_planner.get_best_route(
        user, token_in, amt_in, token_out, min_out,
        src_chain_id, dst_chain_id, fee_mode, deadline
    )
