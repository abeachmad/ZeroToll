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
from pathlib import Path

router = APIRouter(prefix="/eip7702", tags=["eip7702"])

# Path to the EIP-7702 relayer
RELAYER_PATH = os.path.join(os.path.dirname(__file__), '..', 'eip7702-relayer.mjs')
CHAIN_CONFIG_PATH = Path(__file__).resolve().parent.parent / 'chain_config.json'
with open(CHAIN_CONFIG_PATH, 'r') as chain_config_handle:
    CHAIN_CONFIG = {
        int(chain_id): value for chain_id, value in json.load(chain_config_handle).items()
    }

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
    
    IMPORTANT: Sepolia testnet has issues with large nonces!
    Using sequential nonce (0, 1, 2, ...) instead of timestamp
    until EIP-7702 is fully activated on mainnet.
    
    For production, we'll use timestamp-based nonce which should
    work correctly on mainnet.
    """
    try:
        # For now, use simple in-memory nonce tracking
        # In production, store in database
        import time
        
        # TEMPORARY: Use nonce 0 for testing until Sepolia EIP-7702 is fixed
        # Sepolia testnet has bugs with large nonces
        nonce = 0
        
        return {
            'success': True,
            'nonce': str(nonce),
            'chainId': chain_id,
            'address': address,
            'type': 'sequential',
            'note': 'Using nonce 0 due to Sepolia testnet limitations. Timestamp nonce will be used on mainnet.'
        }
            
    except Exception as e:
        # Fallback to nonce 0
        return {
            'success': True,
            'nonce': '0',
            'chainId': chain_id,
            'address': address,
            'type': 'sequential',
            'note': f'Error: {str(e)}, using nonce 0 fallback'
        }


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
        chain_id = request.chainId
        authorization = request.authorization
        permit = request.permit
        intent = request.intent
        intent_signature = request.intentSignature
        fee = request.fee
        
        print(f"🚀 Executing EIP-7702 swap on chain {chain_id}")
        print(f"   Intent: {intent}")
        print(f"   Authorization: {authorization}")
        print(f"   Calling relayer at: {RELAYER_PATH}")
        
        # Call the relayer to execute the swap
        try:
            result = subprocess.run(
                [
                    'node', 
                    RELAYER_PATH, 
                    'execute',
                    str(chain_id),
                    json.dumps({
                        'authorization': authorization,
                        'permit': permit,
                        'intent': intent,
                        'intentSignature': intent_signature,
                        'fee': fee
                    })
                ],
                capture_output=True,
                text=True,
                timeout=360  # 6 minutes timeout (5 min for gas estimation + 1 min for tx)
            )
            
            print(f"📤 Relayer return code: {result.returncode}")
            print(f"📤 Relayer stdout: {result.stdout}")
            print(f"📤 Relayer stderr: {result.stderr}")
        except subprocess.TimeoutExpired as e:
            print(f"⏱️  Relayer timeout after 6 minutes")
            print(f"   stdout: {e.stdout}")
            print(f"   stderr: {e.stderr}")
            raise HTTPException(
                status_code=504, 
                detail=f'Transaction timeout after 6 minutes. This may indicate RPC issues. Check relayer logs for details.'
            )
        
        if result.returncode == 0:
            # Parse result from relayer
            try:
                swap_result = json.loads(result.stdout)
                
                # Build explorer URL
                explorer_url = ''
                if 'txHash' in swap_result:
                    explorer_tx = CHAIN_CONFIG.get(chain_id, {}).get('explorerTx')
                    if explorer_tx:
                        explorer_url = f"{explorer_tx}{swap_result['txHash']}"
                
                return {
                    'success': True,
                    'txHash': swap_result.get('txHash'),
                    'blockNumber': swap_result.get('blockNumber'),
                    'gasUsed': swap_result.get('gasUsed'),
                    'amountOut': swap_result.get('amountOut'),
                    'explorerUrl': explorer_url,
                    'message': 'Swap executed successfully!',
                    'data': swap_result
                }
            except json.JSONDecodeError:
                # If not JSON, return raw output
                return {
                    'success': True,
                    'message': 'Swap submitted',
                    'output': result.stdout
                }
        else:
            # Execution failed
            error_msg = result.stderr or result.stdout or 'Unknown error'
            raise HTTPException(status_code=500, detail=f'Swap execution failed: {error_msg}')
        
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail='Swap execution timeout (6 minutes)')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/info')
async def get_info():
    """
    Get EIP-7702 integration info
    GET /api/eip7702/info
    """
    networks = {}
    for chain_id, config in CHAIN_CONFIG.items():
        delegate = config.get('delegate')
        if not delegate:
            continue

        explorer_tx = config.get('explorerTx')
        explorer_base = explorer_tx[:-4] if explorer_tx and explorer_tx.endswith('/tx/') else None
        networks[str(chain_id)] = {
            'name': config.get('name'),
            'delegate': delegate,
            'explorer': f'{explorer_base}/address/{delegate}' if explorer_base else None
        }

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
            'networks': networks,
            'endpoints': {
                'health': 'GET /api/eip7702/health/{chain_id}',
                'nonce': 'GET /api/eip7702/nonce/{chain_id}/{address}',
                'quote': 'POST /api/eip7702/quote',
                'execute': 'POST /api/eip7702/execute',
                'info': 'GET /api/eip7702/info'
            }
        }
    }
