"""
EIP-7702 API Routes for ZeroToll Backend

Provides endpoints for:
- Checking smart account status
- Getting Pimlico bundler/paymaster URLs
- Building UserOperations for gasless swaps
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/eip7702", tags=["EIP-7702"])

# Configuration
PIMLICO_API_KEY = os.getenv("PIMLICO_API_KEY", "")

SUPPORTED_CHAINS = {
    80002: {
        "name": "Polygon Amoy",
        "bundler_url": f"https://api.pimlico.io/v2/80002/rpc?apikey={PIMLICO_API_KEY}",
        "paymaster_url": f"https://api.pimlico.io/v2/80002/rpc?apikey={PIMLICO_API_KEY}",
        "entry_point": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        "delegator": "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
    },
    11155111: {
        "name": "Ethereum Sepolia",
        "bundler_url": f"https://api.pimlico.io/v2/11155111/rpc?apikey={PIMLICO_API_KEY}",
        "paymaster_url": f"https://api.pimlico.io/v2/11155111/rpc?apikey={PIMLICO_API_KEY}",
        "entry_point": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        "delegator": "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B",
    },
}


class ChainConfigResponse(BaseModel):
    chain_id: int
    name: str
    bundler_url: str
    paymaster_url: str
    entry_point: str
    delegator: str
    supported: bool


class PimlicoHealthResponse(BaseModel):
    available: bool
    chain_id: int
    entry_points: list[str] = []
    error: Optional[str] = None


class SmartAccountStatusRequest(BaseModel):
    address: str
    chain_id: int


class SmartAccountStatusResponse(BaseModel):
    address: str
    chain_id: int
    is_smart_account: bool
    is_metamask_smart_account: bool
    delegator_address: Optional[str] = None
    supported: bool


@router.get("/config/{chain_id}", response_model=ChainConfigResponse)
async def get_chain_config(chain_id: int):
    """Get EIP-7702 configuration for a specific chain."""
    if chain_id not in SUPPORTED_CHAINS:
        return ChainConfigResponse(
            chain_id=chain_id,
            name="Unknown",
            bundler_url="",
            paymaster_url="",
            entry_point="",
            delegator="",
            supported=False,
        )
    
    config = SUPPORTED_CHAINS[chain_id]
    return ChainConfigResponse(
        chain_id=chain_id,
        name=config["name"],
        bundler_url=config["bundler_url"],
        paymaster_url=config["paymaster_url"],
        entry_point=config["entry_point"],
        delegator=config["delegator"],
        supported=True,
    )


@router.get("/health/{chain_id}", response_model=PimlicoHealthResponse)
async def check_pimlico_health(chain_id: int):
    """Check if Pimlico bundler is available for a chain."""
    if chain_id not in SUPPORTED_CHAINS:
        return PimlicoHealthResponse(
            available=False,
            chain_id=chain_id,
            error=f"Chain {chain_id} not supported",
        )
    
    if not PIMLICO_API_KEY:
        return PimlicoHealthResponse(
            available=False,
            chain_id=chain_id,
            error="PIMLICO_API_KEY not configured",
        )
    
    config = SUPPORTED_CHAINS[chain_id]
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                config["bundler_url"],
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "eth_supportedEntryPoints",
                    "params": [],
                },
            )
            
            data = response.json()
            
            if "result" in data and len(data["result"]) > 0:
                return PimlicoHealthResponse(
                    available=True,
                    chain_id=chain_id,
                    entry_points=data["result"],
                )
            
            return PimlicoHealthResponse(
                available=False,
                chain_id=chain_id,
                error="No entry points returned",
            )
    except Exception as e:
        logger.error(f"Pimlico health check failed: {e}")
        return PimlicoHealthResponse(
            available=False,
            chain_id=chain_id,
            error=str(e),
        )


@router.get("/supported-chains")
async def get_supported_chains():
    """Get list of supported chains for EIP-7702."""
    return {
        "chains": [
            {
                "chain_id": chain_id,
                "name": config["name"],
            }
            for chain_id, config in SUPPORTED_CHAINS.items()
        ]
    }


@router.post("/estimate-gas")
async def estimate_user_operation_gas(
    chain_id: int,
    sender: str,
    call_data: str,
    target: str,
):
    """Estimate gas for a UserOperation via Pimlico."""
    if chain_id not in SUPPORTED_CHAINS:
        raise HTTPException(status_code=400, detail=f"Chain {chain_id} not supported")
    
    if not PIMLICO_API_KEY:
        raise HTTPException(status_code=500, detail="PIMLICO_API_KEY not configured")
    
    config = SUPPORTED_CHAINS[chain_id]
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Build minimal UserOperation for estimation
            user_op = {
                "sender": sender,
                "nonce": "0x0",
                "initCode": "0x",
                "callData": call_data,
                "callGasLimit": "0x0",
                "verificationGasLimit": "0x0",
                "preVerificationGas": "0x0",
                "maxFeePerGas": "0x0",
                "maxPriorityFeePerGas": "0x0",
                "paymasterAndData": "0x",
                "signature": "0x",
            }
            
            response = await client.post(
                config["bundler_url"],
                json={
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "eth_estimateUserOperationGas",
                    "params": [user_op, config["entry_point"]],
                },
            )
            
            data = response.json()
            
            if "error" in data:
                raise HTTPException(
                    status_code=400,
                    detail=data["error"].get("message", "Gas estimation failed"),
                )
            
            return {
                "success": True,
                "gas_estimate": data.get("result", {}),
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gas estimation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
