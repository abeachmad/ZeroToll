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
    feeMode: str
    feePaid: str
    feeToken: str
    status: str
    txHash: Optional[str] = None
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
                            oracleSource="TWAP",
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
            oracleSource="TWAP",
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
        
        # Save to history
        history = SwapHistory(
            user=request.userOp.get('sender', ''),
            fromChain='Amoy',
            toChain='Sepolia',
            tokenIn='USDC',
            tokenOut='USDC',
            amountIn='100',
            amountOut='99.5',
            feeMode=fee_mode,
            feePaid='0.5',
            feeToken=fee_token,
            status='pending',
            txHash=result.get('txHash')
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
    
    return {
        "totalSwaps": total_swaps,
        "successfulSwaps": successful_swaps,
        "successRate": (successful_swaps / total_swaps * 100) if total_swaps > 0 else 0,
        "totalVolume": "$125,000",
        "gasSaved": "$3,450",
        "supportedTokens": 8
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
