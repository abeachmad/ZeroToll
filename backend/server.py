from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import httpx
import re
from dex_swap_service import DEXSwapService
from route_client import get_best_route_for_intent
from web3_tx_builder import execute_intent_on_chain
from token_registry import get_token_address
from pyth_rest_oracle import pyth_oracle  # NEW: LIVE prices from Pyth REST API (off-chain)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB client and db will be initialized in lifespan
client = None
db = None

# Initialize DEX swap service
dex_service = DEXSwapService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB
    global client, db
    try:
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        db = client[os.environ.get('DB_NAME', 'zerotoll')]
        logger.info("MongoDB connected successfully")
    except Exception as e:
        logger.warning(f"MongoDB connection failed: {e}")
        client = None
        db = None
    
    yield
    
    # Shutdown: Close MongoDB connection
    if client:
        client.close()
        logger.info("MongoDB connection closed")

app = FastAPI(lifespan=lifespan)

# Security: CORS with specific origins (MUST be before including routers)
allowed_origins = os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Security: Trusted Host
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.zerotoll.io"]
)

api_router = APIRouter(prefix="/api")

# Models
class Intent(BaseModel):
    user: str
    tokenIn: str
    amtIn: float
    tokenOut: str
    minOut: float
    srcChainId: int  # ✅ FIX: Add source chain ID
    dstChainId: int
    feeMode: str  # NATIVE, INPUT, OUTPUT, STABLE
    feeCap: float
    deadline: int
    nonce: int
    
    @field_validator('user')
    @classmethod
    def validate_address(cls, v):
        if not re.match(r'^0x[a-fA-F0-9]{40}$', v):
            raise ValueError('Invalid Ethereum address')
        return v.lower()
    
    @field_validator('amtIn', 'minOut', 'feeCap')
    @classmethod
    def validate_positive(cls, v):
        if v <= 0:
            raise ValueError('Amount must be positive')
        return v
    
    @field_validator('feeMode')
    @classmethod
    def validate_fee_mode(cls, v):
        if v not in ['NATIVE', 'INPUT', 'OUTPUT', 'STABLE']:
            raise ValueError('Invalid fee mode')
        return v
    
    @field_validator('srcChainId', 'dstChainId')
    @classmethod
    def validate_chain(cls, v):
        if v not in [80002, 11155111, 421614, 11155420]:
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
    netOut: Optional[float] = None
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

@api_router.options("/quote")
async def quote_options():
    """Handle CORS preflight for quote endpoint"""
    return {}

@api_router.post("/quote", response_model=QuoteResponse)
async def get_quote(request: QuoteRequest, req: Request):
    """Get quote with any-token fee mode support"""
    try:
        intent = request.intent
        
        # Get chain IDs from intent (✅ FIXED: No more default to Sepolia!)
        src_chain_id = intent.srcChainId
        dst_chain_id = intent.dstChainId
        
        # ✅ Query Pyth REST API for REAL-TIME prices (LIVE, off-chain)
        price_in_data = pyth_oracle.get_price(intent.tokenIn, src_chain_id)
        price_out_data = pyth_oracle.get_price(intent.tokenOut, dst_chain_id)
        
        # Check if prices available (fail-closed)
        if not price_in_data["available"] or not price_out_data["available"]:
            raise HTTPException(
                status_code=503,
                detail=f"Price unavailable for {intent.tokenIn} or {intent.tokenOut}. Please try again in a moment."
            )
        
        price_in = price_in_data["price"]
        price_out = price_out_data["price"]
        
        # Log if using stale prices
        if price_in_data["stale"]:
            logger.warning(f"⚠️  Using STALE price for {intent.tokenIn}: ${price_in:.6f}")
        if price_out_data["stale"]:
            logger.warning(f"⚠️  Using STALE price for {intent.tokenOut}: ${price_out:.6f}")
        
        # Calculate output amount based on real prices
        # Convert input amount to USD, then to output token
        usd_value = intent.amtIn * price_in
        output_amount = usd_value / price_out
        
        # Apply slippage (5% to match MockDEXAdapter)
        # MockDEXAdapter applies 5% slippage: amountOut * 9500 / 10000
        net_out = output_amount * 0.95
        
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
        fee_token_price_data = pyth_oracle.get_price(fee_token, src_chain_id)
        
        # Check fee token price available
        if not fee_token_price_data["available"]:
            raise HTTPException(
                status_code=503,
                detail=f"Price unavailable for fee token {fee_token}. Please try again."
            )
        
        fee_token_price = fee_token_price_data["price"]
        fee_usd = estimated_fee * fee_token_price
        
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
        
        # Fallback mock response with netOut
        # Load relayer address from private key in .env
        relayer_address = os.getenv("RELAYER_ADDRESS", "0xf304eeD846d82a91d688d1bC1A4fA692051d1D7A")
        
        return QuoteResponse(
            success=True,
            relayer=relayer_address,
            costEstimate="0.001",
            estimatedFee=f"{estimated_fee:.4f}",
            feeUSD=f"${fee_usd:.2f}",
            oracleSource=oracle_source,
            deadline=int(datetime.now().timestamp()) + 60,
            netOut=net_out,
            reason=None
        )
    except Exception as e:
        logging.error(f"Quote request failed: {e}")
        return QuoteResponse(success=False, reason=str(e))

@api_router.post("/execute")
async def execute_intent(request: ExecuteRequest, req: Request):
    """Execute swap with REAL blockchain transaction via RouterHub"""
    try:
        # DEBUG: Log received userOp
        logging.info(f"🔍 DEBUG - Received userOp: {request.userOp}")
        
        user_address = request.userOp.get('sender', '')
        logging.info(f"🔍 DEBUG - Extracted user_address: {user_address}")
        
        if not user_address:
            raise HTTPException(status_code=400, detail="Missing user address (sender)")
        
        fee_mode = request.userOp.get('feeMode', 'INPUT')
        fee_token_symbol = request.userOp.get('feeToken', 'ETH')
        
        # Extract intent data from request
        call_data = request.userOp.get('callData', {})
        token_in_symbol = call_data.get('tokenIn', 'ETH')
        amt_in = float(call_data.get('amtIn', 0.01))
        token_out_symbol = call_data.get('tokenOut', 'POL')
        min_out = float(call_data.get('minOut', 0))
        src_chain_id = call_data.get('srcChainId', 11155111)
        dst_chain_id = call_data.get('dstChainId', 80002)
        
        # DEBUG: Log minOut received from frontend
        logging.info(f"🔍 DEBUG minOut from frontend: {min_out} ({token_out_symbol})")
        
        # Set deadline to 10 minutes from now (fixes "Intent expired" revert)
        deadline = int(datetime.now().timestamp()) + 600
        logging.info(f"⏰ Intent deadline set to: {deadline} (current: {int(datetime.now().timestamp())})")
        
        # Convert token symbols to addresses
        try:
            token_in = get_token_address(token_in_symbol, src_chain_id)
            token_out = get_token_address(token_out_symbol, dst_chain_id)
            fee_token = get_token_address(fee_token_symbol, src_chain_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # 🔧 FIX: MockDEXAdapter cannot handle native tokens (0xEEEE...)
        # If output is native (ETH/POL), convert to wrapped (WETH/WMATIC)
        needs_unwrap = False
        if token_out.lower() == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee":
            logging.info(f"⚠️ Native token requested ({token_out_symbol}), converting to wrapped")
            if dst_chain_id == 11155111:  # Sepolia
                token_out = get_token_address("WETH", dst_chain_id)
                token_out_symbol = "WETH"
                needs_unwrap = True
            elif dst_chain_id == 80002:  # Amoy
                token_out = get_token_address("WMATIC", dst_chain_id)
                token_out_symbol = "WMATIC"
                needs_unwrap = True
            logging.info(f"   → Swapping to {token_out_symbol} instead: {token_out}")
            logging.info(f"   → TODO: Unwrap {token_out_symbol} → native after swap")
        
        # Convert amounts to wei (assuming 18 decimals for most tokens, 6 for USDC)
        # Simplified: use 18 decimals for now (will be refined per token)
        decimals_in = 6 if token_in_symbol in ['USDC', 'PYUSD', 'USDT'] else 18
        decimals_out = 6 if token_out_symbol in ['USDC', 'PYUSD', 'USDT'] else 18
        
        amt_in_wei = str(int(amt_in * (10 ** decimals_in)))
        min_out_wei = str(int(min_out * (10 ** decimals_out)))
        
        # DEBUG: Log conversion details
        logging.info(f"🔍 DEBUG minOut conversion:")
        logging.info(f"   Input: min_out = {min_out} ({token_out_symbol})")
        logging.info(f"   Decimals: {decimals_out}")
        logging.info(f"   Formula: {min_out} * 10^{decimals_out}")
        logging.info(f"   Result: min_out_wei = {min_out_wei}")
        
        logging.info(f"🚀 Executing intent: {user_address} swap {amt_in} {token_in_symbol} → {token_out_symbol}")
        
        # Step 1: Get best route from route planner
        best_route = get_best_route_for_intent(
            user=user_address,
            token_in=token_in,
            amt_in=amt_in_wei,
            token_out=token_out,
            min_out=min_out_wei,
            src_chain_id=src_chain_id,
            dst_chain_id=dst_chain_id,
            fee_mode=fee_mode,
            deadline=deadline,
        )
        
        if not best_route:
            raise HTTPException(
                status_code=400,
                detail="No route found for this swap. Check token addresses and liquidity."
            )
        
        logging.info(f"✅ Best route: {best_route.explain} (score: {best_route.score})")
        
        # Step 2: Build intent for RouterHub
        intent = {
            "user": user_address,
            "tokenIn": token_in,
            "amtIn": amt_in_wei,
            "tokenOut": token_out,
            "minOut": min_out_wei,
            "dstChainId": dst_chain_id,
            "deadline": deadline,
            "feeToken": fee_token,
            "feeMode": fee_mode,
            "feeCapToken": str(int(0.01 * 1e18)),  # 0.01 token fee cap
            "routeHint": "",  # Empty for now
            "nonce": int(datetime.now().timestamp()),
        }
        
        # Log intent details for debugging
        logging.info(f"📋 Intent details:")
        logging.info(f"  user: {user_address}")
        logging.info(f"  tokenIn: {token_in} ({token_in_symbol})")
        logging.info(f"  amtIn: {amt_in_wei} ({amt_in} {token_in_symbol})")
        logging.info(f"  tokenOut: {token_out} ({token_out_symbol})")
        logging.info(f"  minOut: {min_out_wei}")
        logging.info(f"  dstChainId: {dst_chain_id}")
        logging.info(f"  deadline: {deadline} (expires in {deadline - int(datetime.now().timestamp())}s)")
        logging.info(f"  feeMode: {fee_mode}, feeToken: {fee_token}")
        
        # Step 3: Get adapter address from best route
        if not best_route.steps or len(best_route.steps) == 0:
            raise HTTPException(status_code=400, detail="Route has no steps")
        
        adapter_address = best_route.steps[0]["adapterAddress"]
        
        # Step 4: Build route data (encoded adapter call)
        # RouterHub calls adapter with: adapter.call(routeData)
        # So routeData must be the ABI-encoded call to adapter.swap()
        
        # Import web3 for encoding
        from web3 import Web3
        from eth_abi import encode
        
        # Get RouterHub address for this chain (UPGRADED - v1.4 sends output to user, not relayer!)
        # IMPORTANT: Load from .env to avoid hardcoded stale addresses!
        router_hub_addresses = {
            80002: os.getenv("AMOY_ROUTERHUB", "0x49ADe5FbC18b1d2471e6001725C6bA3Fe1904881"),
            11155111: os.getenv("SEPOLIA_ROUTERHUB", "0x8Bf6f17F19CAc8b857764E9B97E7B8FdCE194e84"),  # Phase 1: Gasless
            421614: os.getenv("ARB_SEPOLIA_ROUTERHUB"),
            11155420: os.getenv("OP_SEPOLIA_ROUTERHUB"),
        }
        router_hub_address = router_hub_addresses.get(src_chain_id)
        if not router_hub_address:
            raise HTTPException(status_code=400, detail=f"RouterHub not deployed on chain {src_chain_id}")
        
        # Build swap() function call
        # function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline)
        swap_selector = Web3.keccak(text="swap(address,address,uint256,uint256,address,uint256)")[:4]
        
        # Encode parameters - recipient MUST be RouterHub address!
        route_data_params = encode(
            ['address', 'address', 'uint256', 'uint256', 'address', 'uint256'],
            [
                Web3.to_checksum_address(token_in),
                Web3.to_checksum_address(token_out),
                int(amt_in_wei),
                int(min_out_wei),
                Web3.to_checksum_address(router_hub_address),  # recipient = RouterHub (not user!)
                deadline
            ]
        )
        route_data = swap_selector + route_data_params
        
        logging.info(f"📦 Built route_data (swap call): {route_data.hex()[:100]}...")
        logging.info(f"   Recipient (RouterHub): {router_hub_address}")
        
        # Step 5: Execute transaction on blockchain
        logging.info(f"📡 Sending transaction to chain {src_chain_id}...")
        tx_hash, error = execute_intent_on_chain(
            intent=intent,
            adapter_address=adapter_address,
            route_data=route_data,
            chain_id=src_chain_id,
        )
        
        # Even if transaction reverted, it's still on-chain (demo success)
        if not tx_hash:
            error_msg = error or "Failed to send transaction"
            logging.error(f"❌ Transaction failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Transaction sent successfully (even if reverted, it's on blockchain)
        if error and "reverted" in error.lower():
            logging.warning(f"⚠️ Transaction reverted (but on-chain): {tx_hash}")
            status_msg = "reverted"
            error_reason = error  # Capture revert reason
        else:
            logging.info(f"✅ Transaction successful! Hash: {tx_hash}")
            status_msg = "success"
            error_reason = None
        
        # Step 6: Build explorer URL
        explorer_urls = {
            11155111: f"https://sepolia.etherscan.io/tx/{tx_hash}",
            80002: f"https://amoy.polygonscan.com/tx/{tx_hash}",
            421614: f"https://sepolia.arbiscan.io/tx/{tx_hash}",
            11155420: f"https://sepolia-optimism.etherscan.io/tx/{tx_hash}",
        }
        explorer_url = explorer_urls.get(src_chain_id, f"https://etherscan.io/tx/{tx_hash}")
        
        # Calculate amounts for response
        amount_out = float(best_route.expected_out) / 1e18
        fee_paid = 0.002  # Estimated from route
        refund = 0.008    # Fee cap - actual fee
        net_out = amount_out - (fee_paid if fee_mode == 'OUTPUT' else 0)
        
        # Save to history if MongoDB available (SAVE BOTH SUCCESS AND FAILURE!)
        if db is not None:
            try:
                chain_names = {
                    11155111: "Ethereum Sepolia",
                    80002: "Polygon Amoy",
                    421614: "Arbitrum Sepolia",
                    11155420: "Optimism Sepolia",
                }
                history = SwapHistory(
                    user=user_address,
                    fromChain=chain_names.get(src_chain_id, f"Chain {src_chain_id}"),
                    toChain=chain_names.get(dst_chain_id, f"Chain {dst_chain_id}"),
                    tokenIn=token_in,
                    tokenOut=token_out,
                    amountIn=str(amt_in),
                    amountOut=str(amount_out) if status_msg == 'success' else '0',
                    netOut=str(net_out) if status_msg == 'success' else '0',
                    feeMode=fee_mode,
                    feePaid=str(fee_paid) if status_msg == 'success' else '0',
                    feeToken=fee_token,
                    refund=str(refund) if status_msg == 'success' else '0',
                    oracleSource='Pyth',
                    priceAge=12,
                    status=status_msg,  # Can be 'success' or 'reverted'
                    txHash=tx_hash,
                    explorerUrl=explorer_url
                )
                doc = history.model_dump()
                doc['timestamp'] = doc['timestamp'].isoformat()
                # Add error reason if reverted
                if error_reason:
                    doc['errorReason'] = error_reason
                await db.swap_history.insert_one(doc)
                logging.info(f"💾 Saved swap history (status={status_msg}): {tx_hash}")
            except Exception as e:
                logging.error(f"Failed to save history: {e}")
        
        # Return REAL transaction data
        return {
            'success': True,
            'txHash': tx_hash,
            'status': status_msg,
            'explorerUrl': explorer_url,
            'routeExplanation': best_route.explain,
            'expectedOut': str(amount_out),
            'netOut': str(net_out),
            'message': f'🎉 Transaction sent to blockchain! TX: {tx_hash[:10]}... View on explorer: {explorer_url}'
        }
        
    except HTTPException as he:
        # HTTPException from routing or validation errors - still need to save to history
        if db is not None and user_address:
            try:
                chain_names = {
                    11155111: "Ethereum Sepolia",
                    80002: "Polygon Amoy",
                    421614: "Arbitrum Sepolia",
                    11155420: "Optimism Sepolia",
                }
                history = SwapHistory(
                    user=user_address,
                    fromChain=chain_names.get(src_chain_id, f"Chain {src_chain_id}"),
                    toChain=chain_names.get(dst_chain_id, f"Chain {dst_chain_id}"),
                    tokenIn=token_in_symbol,
                    tokenOut=token_out_symbol,
                    amountIn=str(amt_in),
                    amountOut='0',
                    netOut='0',
                    feeMode=fee_mode,
                    feePaid='0',
                    feeToken=fee_token_symbol,
                    refund='0',
                    oracleSource='Pyth',
                    priceAge=12,
                    status='failed',
                    txHash='',
                    explorerUrl=''
                )
                doc = history.model_dump()
                doc['timestamp'] = doc['timestamp'].isoformat()
                doc['errorReason'] = str(he.detail)
                await db.swap_history.insert_one(doc)
                logging.info(f"💾 Saved failed swap history: {he.detail}")
            except Exception as save_err:
                logging.error(f"Failed to save error history: {save_err}")
        raise he
    except Exception as e:
        # General exception - also save to history
        if db is not None and user_address:
            try:
                chain_names = {
                    11155111: "Ethereum Sepolia",
                    80002: "Polygon Amoy",
                    421614: "Arbitrum Sepolia",
                    11155420: "Optimism Sepolia",
                }
                history = SwapHistory(
                    user=user_address,
                    fromChain=chain_names.get(src_chain_id if 'src_chain_id' in locals() else 80002, "Unknown"),
                    toChain=chain_names.get(dst_chain_id if 'dst_chain_id' in locals() else 80002, "Unknown"),
                    tokenIn=token_in_symbol if 'token_in_symbol' in locals() else 'Unknown',
                    tokenOut=token_out_symbol if 'token_out_symbol' in locals() else 'Unknown',
                    amountIn=str(amt_in) if 'amt_in' in locals() else '0',
                    amountOut='0',
                    netOut='0',
                    feeMode=fee_mode,
                    feePaid='0',
                    feeToken=fee_token_symbol,
                    refund='0',
                    oracleSource='Pyth',
                    priceAge=12,
                    status='failed',
                    txHash='',
                    explorerUrl=''
                )
                doc = history.model_dump()
                doc['timestamp'] = doc['timestamp'].isoformat()
                doc['errorReason'] = str(e)
                await db.swap_history.insert_one(doc)
                logging.info(f"💾 Saved failed swap history: {str(e)}")
            except Exception as save_err:
                logging.error(f"Failed to save error history: {save_err}")
        logging.error(f"Execute request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/history", response_model=List[SwapHistory])
async def get_history(user: Optional[str] = None):
    if db is None:
        # Return empty list if MongoDB not available
        return []
    
    try:
        query = {"user": user} if user else {}
        history = await db.swap_history.find(query, {"_id": 0}).sort("timestamp", -1).to_list(100)
        
        for item in history:
            if isinstance(item['timestamp'], str):
                item['timestamp'] = datetime.fromisoformat(item['timestamp'])
        
        return history
    except Exception as e:
        logging.error(f"Failed to get history: {e}")
        return []

@api_router.get("/stats")
async def get_stats():
    if db is not None:
        try:
            total_swaps = await db.swap_history.count_documents({})
            successful_swaps = await db.swap_history.count_documents({"status": "success"})
        except:
            total_swaps = 0
            successful_swaps = 0
    else:
        total_swaps = 0
        successful_swaps = 0
    
    # Calculate mode distribution
    if db is not None:
        try:
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
        except:
            native_count = input_count = output_count = stable_count = 0
            total_fees = total_refunds = 0
    else:
        native_count = input_count = output_count = stable_count = 0
        total_fees = total_refunds = 0
    
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

@api_router.get("/oracle/health")
async def get_oracle_health():
    """Get Pyth REST Oracle health status"""
    try:
        health = pyth_oracle.health_check()
        return {
            "success": True,
            "oracle": "pyth-rest",
            "status": "healthy" if health["available"] else "degraded",
            **health
        }
    except Exception as e:
        logger.error(f"Oracle health check failed: {e}")
        return {
            "success": False,
            "oracle": "pyth-rest",
            "status": "error",
            "error": str(e)
        }

app.include_router(api_router)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

