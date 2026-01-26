"""
EIP-7702 Gasless Swap Routes
Provides quote and execution endpoints for EIP-7702 gasless swaps
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import subprocess
import json
import os
from typing import Dict, Any

router = APIRouter(prefix="/eip7702", tags=["eip7702"])

# Path to the EIP-7702 relayer
RELAYER_PATH = os.path.join(os.path.dirname(__file__), '..', 'eip7702-relayer.mjs')

# Pydantic models
class QuoteRequest(BaseModel):
    chainId: int
    tokenIn: str
    tokenOut: str
    amountIn: str

class ExecuteRequest(BaseModel):
    chainId: int
    authorization: Dict[str, Any]
    permit: Dict[str, Any]
    intent: Dict[str, Any]
    intentSignature: str
    fee: str


@router.get('/health/{chain_id}')
async def health_check(chain_id: int):
    """
    Health check for EIP-7702 relayer
    GET /api/eip7702/health/{chain_id}
    """
    try:
        result = subprocess.run(
            ['node', RELAYER_PATH, 'health', str(chain_id)],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            health_data = json.loads(result.stdout)
            return {
                'success': True,
                'health': health_data
            }
        else:
            raise HTTPException(status_code=500, detail=result.stderr)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/nonce/{chain_id}/{address}')
async def get_nonce(chain_id: int, address: str):
    """
    Get user's current nonce for EIP-7702 swaps
    GET /api/eip7702/nonce/{chain_id}/{address}
    """
    try:
        result = subprocess.run(
            ['node', RELAYER_PATH, 'nonce', str(chain_id), address],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            # Parse nonce from output
            output = result.stdout.strip()
            if 'Nonce:' in output:
                nonce = output.split('Nonce:')[1].strip()
                return {
                    'success': True,
                    'nonce': nonce,
                    'chainId': chain_id,
                    'address': address
                }
            else:
                raise HTTPException(status_code=500, detail='Could not parse nonce')
        else:
            raise HTTPException(status_code=500, detail=result.stderr)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/quote')
async def get_quote(request: QuoteRequest):
    """
    Get quote for EIP-7702 swap
    POST /api/eip7702/quote
    
    Body:
    {
        "chainId": 80002,
        "tokenIn": "0x...",
        "tokenOut": "0x...",
        "amountIn": "1000000"
    }
    """
    try:
        chain_id = request.chainId
        token_in = request.tokenIn
        token_out = request.tokenOut
        amount_in = request.amountIn
        
        # Calculate fee (2x gas cost)
        # For EIP-7702, gas is ~150,000 (50% less than ERC-4337)
        gas_estimate = 150000
        
        # Simplified fee calculation
        # In production, use oracle for accurate pricing
        fee_percent = 0.01  # 1% max
        fee = int(int(amount_in) * fee_percent)
        
        # Get swap quote from DEX (simplified)
        # In production, query actual DEX for quote
        swap_amount = int(amount_in) - fee
        
        # Estimate output (simplified - would query DEX in production)
        # Assuming 1:1 for demo purposes
        estimated_output = swap_amount
        
        return {
            'success': True,
            'quote': {
                'chainId': chain_id,
                'tokenIn': token_in,
                'tokenOut': token_out,
                'amountIn': amount_in,
                'amountOut': str(estimated_output),
                'fee': str(fee),
                'feePercent': fee_percent * 100,
                'gasEstimate': gas_estimate,
                'gasSavings': '50%',  # vs ERC-4337
                'path': [token_in, token_out],
                'method': 'EIP-7702'
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/execute')
async def execute_swap(request: ExecuteRequest):
    """
    Execute EIP-7702 gasless swap
    POST /api/eip7702/execute
    
    Body:
    {
        "chainId": 80002,
        "authorization": {...},
        "permit": {...},
        "intent": {...},
        "intentSignature": "0x...",
        "fee": "10000"
    }
    """
    try:
        # TODO: Call the relayer to execute the swap
        # For now, return a mock response
        
        return {
            'success': True,
            'message': 'EIP-7702 execution endpoint ready',
            'note': 'Full implementation requires frontend integration',
            'data': {
                'chainId': request.chainId,
                'method': 'EIP-7702',
                'status': 'pending_implementation'
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/info')
async def get_info():
    """
    Get EIP-7702 integration info
    GET /api/eip7702/info
    """
    return {
        'success': True,
        'info': {
            'name': 'ZeroToll EIP-7702 Integration',
            'version': '1.0.0',
            'description': 'Gasless swaps with 50% gas savings',
            'features': [
                '50% gas savings vs ERC-4337',
                'Trustless fee calculation on-chain',
                'Native token output (unwrap WETH/WPOL)',
                'Atomic execution (no frontrunning)',
                'Works with any EOA wallet'
            ],
            'networks': {
                '80002': {
                    'name': 'Polygon Amoy',
                    'delegate': '0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C',
                    'explorer': 'https://amoy.polygonscan.com/address/0x5F43D1Fc4fAad0dFe097fc3bB32d66a9864c730C'
                },
                '11155111': {
                    'name': 'Ethereum Sepolia',
                    'delegate': '0xcFE005B2E0013e0FF8cB0569d9b103094d423B36',
                    'explorer': 'https://sepolia.etherscan.io/address/0xcFE005B2E0013e0FF8cB0569d9b103094d423B36'
                }
            },
            'endpoints': {
                'health': 'GET /api/eip7702/health/{chain_id}',
                'nonce': 'GET /api/eip7702/nonce/{chain_id}/{address}',
                'quote': 'POST /api/eip7702/quote',
                'execute': 'POST /api/eip7702/execute',
                'info': 'GET /api/eip7702/info'
            }
        }
    }
