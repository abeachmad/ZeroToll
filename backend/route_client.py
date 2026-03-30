"""
Route Planner Client for Python Backend

Communicates with TypeScript route-planner service to get optimal routes
"""

import os
import requests
import logging
from typing import Dict, List, Optional, Any
from generated_config import get_adapter_address, get_ztoken_map

logger = logging.getLogger(__name__)

# Optional route planner service. When unset, the backend goes straight
# to local heuristic routing instead of assuming a legacy service on 3001.
ROUTE_SERVICE_URL = os.getenv("ROUTE_SERVICE_URL")

PREFERRED_SWAP_ADAPTERS = {
    11155111: [("uniswapV3", "UniswapV3"), ("uniswapV2", "UniswapV2"), ("mockDex", "MockDEX")],
    80002: [("quickswapV2", "QuickSwapV2"), ("mockDex", "MockDEX")],
    421614: [("uniswapV3", "UniswapV3"), ("mockDex", "MockDEX")],
    11155420: [("uniswapV3", "UniswapV3"), ("mockDex", "MockDEX")],
}

def is_ztoken(token_address: str, chain_id: int) -> bool:
    """Check if token is a zToken"""
    return token_address.lower() in get_ztoken_map(chain_id)


def get_preferred_swap_adapter(chain_id: int) -> tuple[str, str]:
    """Select the best configured same-chain adapter for a network."""
    for adapter_key, protocol_name in PREFERRED_SWAP_ADAPTERS.get(chain_id, []):
        address = get_adapter_address(chain_id, adapter_key)
        if address:
            return address, protocol_name
    return "0x0000000000000000000000000000000000000001", "MockDEX"


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

        if not self.service_url:
            logger.info("ROUTE_SERVICE_URL not configured, using local fallback routing")
            return self._fallback_routing(intent)
        
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
        
        # Select adapter based on token type
        if use_zerotoll:
            adapter = get_adapter_address(src_chain, "zeroToll") or "0x0000000000000000000000000000000000000001"
            protocol_name = "ZeroTollAdapter"
            logger.info(f"✓ Using ZeroTollAdapter for zToken swap on chain {src_chain}")
        else:
            adapter, protocol_name = get_preferred_swap_adapter(src_chain)
        
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
            bridge_adapter = get_adapter_address(src_chain, "mockBridge") or "0x0000000000000000000000000000000000000001"
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
