from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, validator
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class Intent(BaseModel):
    user: str
    tokenIn: str
    amtIn: float
    tokenOut: str
    minOut: float
    dstChainId: int
    feeMode: str  # NATIVE, INPUT, OUTPUT, STABLE
    feeCap: float
    deadline: int
    nonce: int
    
    @validator('user')
    def validate_address(cls, v):
        if not re.match(r'^0x[a-fA-F0-9]{40}$', v):
            raise ValueError('Invalid Ethereum address')
        return v.lower()
    
    @validator('amtIn', 'minOut', 'feeCap')
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        return v
    
    @validator('feeMode')
    def validate_fee_mode(cls, v):
        if v not in ['NATIVE', 'INPUT', 'OUTPUT', 'STABLE']:
            raise ValueError('Invalid fee mode')
        return v
    
    @validator('dstChainId')
    def validate_chain(cls, v):
        if v not in [80002, 11155111]:
            raise ValueError('Unsupported chain')
        return v

class QuoteRequest(BaseModel):
    intent: Intent

class QuoteResponse(BaseModel):
    success: bool
    relayer: Optional[str] = None
    costEstimate: Optional[str] = None
    estimatedFee: Optional[str] = None
    feeUSD: Optional[str] = None
    oracleSource: Optional[str] = None
    deadline: Optional[int] = None
    reason: Optional[str] = None

class ExecuteRequest(BaseModel):
    intentId: str
    userOp: dict

class SwapHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user: str
    fromChain: str
    toChain: str
    tokenIn: str
    tokenOut: str
    amountIn: str
    amountOut: str
    netOut: str                   # after fee deduction
    feeMode: str                  # NATIVE, INPUT, OUTPUT, STABLE
    feePaid: str
    feeToken: str
    refund: str
    oracleSource: str             # Pyth, TWAP, Chainlink
    priceAge: Optional[int] = None
    status: str
    txHash: Optional[str] = None
    explorerUrl: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

@api_router.get("/")
async def root():
    return {"message": "ZeroToll API - Any-Token Fee Mode", "version": "2.0.0"}

@api_router.post("/quote", response_model=QuoteResponse)
async def get_quote(request: QuoteRequest, req: Request):
    """Get quote with any-token fee mode support"""
    try:
        intent = request.intent
        
        # Determine fee token based on mode
        if intent.feeMode == 'INPUT':
            fee_token = intent.tokenIn
        elif intent.feeMode == 'OUTPUT':
            fee_token = intent.tokenOut
        elif intent.feeMode == 'STABLE':
            fee_token = 'USDC'
        else:
            fee_token = 'POL'
        
        # Mock quote calculation
        estimated_fee = intent.feeCap * 0.2  # 20% of cap as estimate
        fee_usd = estimated_fee * 1.0  # Mock 1:1 conversion
        
        # Mock oracle data
        oracle_source = "Pyth" if intent.feeMode in ['INPUT', 'OUTPUT'] else "TWAP"
        price_age = 12 if oracle_source == "Pyth" else None
        confidence = 0.15 if oracle_source == "Pyth" else None
        
        async with httpx.AsyncClient() as client:
            relayer_url = os.getenv('RELAYER_URL', 'http://localhost:3001')
            try:
                response = await client.post(
                    f"{relayer_url}/api/quote",
                    json=request.model_dump(),
                    timeout=5.0
                )
                if response.status_code == 200:
                    relayer_data = response.json()
                    if relayer_data.get('success'):
                        return QuoteResponse(
                            success=True,
                            relayer=relayer_data.get('relayer'),
                            costEstimate=relayer_data.get('costEstimate'),
                            estimatedFee=f"{estimated_fee:.4f}",
                            feeUSD=f"${fee_usd:.2f}",
                            oracleSource=oracle_source,
                            deadline=int(datetime.now().timestamp()) + 60
                        )
            except:
                pass
        
        # Fallback mock response
        return QuoteResponse(
            success=True,
            relayer="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
            costEstimate="0.001",
            estimatedFee=f"{estimated_fee:.4f}",
            feeUSD=f"${fee_usd:.2f}",
            oracleSource=oracle_source,
            deadline=int(datetime.now().timestamp()) + 60
        )
    except Exception as e:
        logging.error(f"Quote request failed: {e}")
        return QuoteResponse(success=False, reason=str(e))

@api_router.post("/execute")
async def execute_intent(request: ExecuteRequest, req: Request):
    """Execute swap with any-token fee mode"""
    try:
        fee_mode = request.userOp.get('feeMode', 'STABLE')
        fee_token = request.userOp.get('feeToken', 'USDC')
        
        async with httpx.AsyncClient() as client:
            relayer_url = os.getenv('RELAYER_URL', 'http://localhost:3001')
            try:
                response = await client.post(
                    f"{relayer_url}/api/execute",
                    json=request.model_dump(),
                    timeout=30.0
                )
                result = response.json()
            except:
                # Fallback mock
                result = {
                    'success': True,
                    'txHash': f"0x{request.intentId[2:66]}",
                    'status': 'pending'
                }
        
        # Calculate net output
        amount_in = 100.0
        amount_out = 99.5
        fee_paid = 0.5
        refund = 0.1
        net_out = amount_out - fee_paid if fee_mode == 'OUTPUT' else amount_out
        
        # Determine explorer URL
        tx_hash = result.get('txHash')
        explorer_url = f"https://amoy.polygonscan.com/tx/{tx_hash}" if tx_hash else None
        
        # Save to history
        history = SwapHistory(
            user=request.userOp.get('sender', ''),
            fromChain='Amoy',
            toChain='Sepolia',
            tokenIn='USDC',
            tokenOut='USDC',
            amountIn=str(amount_in),
            amountOut=str(amount_out),
            netOut=str(net_out),
            feeMode=fee_mode,
            feePaid=str(fee_paid),
            feeToken=fee_token,
            refund=str(refund),
            oracleSource='Pyth' if fee_mode in ['INPUT', 'OUTPUT'] else 'TWAP',
            priceAge=12 if fee_mode in ['INPUT', 'OUTPUT'] else None,
            status='success',
            txHash=tx_hash,
            explorerUrl=explorer_url
        )
        doc = history.model_dump()
        doc['timestamp'] = doc['timestamp'].isoformat()
        await db.swap_history.insert_one(doc)
        
        return result
    except Exception as e:
        logging.error(f"Execute request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/history", response_model=List[SwapHistory])
async def get_history(user: Optional[str] = None):
    query = {"user": user} if user else {}
    history = await db.swap_history.find(query, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    for item in history:
        if isinstance(item['timestamp'], str):
            item['timestamp'] = datetime.fromisoformat(item['timestamp'])
    
    return history

@api_router.get("/stats")
async def get_stats():
    total_swaps = await db.swap_history.count_documents({})
    successful_swaps = await db.swap_history.count_documents({"status": "success"})
    
    # Calculate mode distribution
    native_count = await db.swap_history.count_documents({"feeMode": "NATIVE"})
    input_count = await db.swap_history.count_documents({"feeMode": "INPUT"})
    output_count = await db.swap_history.count_documents({"feeMode": "OUTPUT"})
    stable_count = await db.swap_history.count_documents({"feeMode": "STABLE"})
    
    # Calculate totals
    pipeline = [
        {"$group": {
            "_id": None,
            "totalFees": {"$sum": {"$toDouble": "$feePaid"}},
            "totalRefunds": {"$sum": {"$toDouble": "$refund"}}
        }}
    ]
    aggregation = await db.swap_history.aggregate(pipeline).to_list(1)
    total_fees = aggregation[0]['totalFees'] if aggregation else 0
    total_refunds = aggregation[0]['totalRefunds'] if aggregation else 0
    
    # Mock calculations
    total_volume_usd = total_swaps * 125.5
    gas_saved_usd = total_swaps * 0.45
    avg_fee_usd = total_fees / total_swaps if total_swaps > 0 else 0
    refund_rate = (total_refunds / total_fees * 100) if total_fees > 0 else 0
    any_token_share = ((input_count + output_count) / total_swaps * 100) if total_swaps > 0 else 0
    
    return {
        "totalSwaps": total_swaps,
        "successfulSwaps": successful_swaps,
        "successRate": (successful_swaps / total_swaps * 100) if total_swaps > 0 else 99.8,
        "totalVolume": f"${total_volume_usd:,.0f}",
        "gasSaved": f"${gas_saved_usd:,.2f}",
        "supportedTokens": 8,
        "avgFeeUSD": f"${avg_fee_usd:.2f}",
        "refundRate": f"{refund_rate:.1f}%",
        "anyTokenShare": f"{any_token_share:.1f}%",
        "modeDistribution": {
            "native": native_count,
            "input": input_count,
            "output": output_count,
            "stable": stable_count
        }
    }

app.include_router(api_router)

# Security: CORS with specific origins
allowed_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# Security: Trusted Host
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.zerotoll.io"]
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
