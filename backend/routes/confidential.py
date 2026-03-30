"""
Confidential gasless intent routes.

This module provides a staged settlement scaffold for the Fhenix-backed
confidential flow. It is intentionally honest about the current runtime:
the active app stores a client commitment and tracks the lifecycle, while
the real on-chain FHE enforcement lives in the contracts package and will
be wired in later.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional
import json
import logging
import re
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from confidential_contract import (
    execute_adapter_backed_execution,
    finalize_confidential_settlement,
    get_confidential_contract_client,
    get_settlement_summary,
    get_verdict_status,
    simulate_inventory_backed_execution,
    submit_intent_with_plaintext_min_out,
)
from pyth_rest_oracle import pyth_oracle
from token_registry import address_to_symbol

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/confidential", tags=["confidential"])

ROOT_DIR = Path(__file__).resolve().parent.parent
CHAIN_CONFIG_PATH = ROOT_DIR / "chain_config.json"
TOKEN_ADDRESSES_PATH = ROOT_DIR / "token_addresses.json"
with open(CHAIN_CONFIG_PATH, "r") as chain_config_handle:
    CHAIN_CONFIG = {
        int(chain_id): value for chain_id, value in json.load(chain_config_handle).items()
    }
with open(TOKEN_ADDRESSES_PATH, "r") as token_addresses_handle:
    TOKEN_ADDRESSES = {
        int(chain_id): value for chain_id, value in json.load(token_addresses_handle).items()
    }

SUPPORTED_CHAINS = {
    chain_id
    for chain_id, config in CHAIN_CONFIG.items()
    if config.get("features", {}).get("gasless")
}
COFHE_BROWSER_CHAINS = {11155111}

CONFIDENTIAL_INTENTS: Dict[str, Dict[str, Any]] = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _is_address(value: str) -> bool:
    return bool(re.match(r"^0x[a-fA-F0-9]{40}$", value or ""))


def _coerce_token_symbol(value: str, chain_id: int) -> str:
    if _is_address(value):
        return address_to_symbol(value, chain_id)
    return value.upper()


def _coerce_float(value: str | float | int) -> float:
    return float(value)


def _token_decimals(chain_id: int, token_address: str) -> int:
    metadata = (
        TOKEN_ADDRESSES.get(chain_id, {})
        .get("metadataByAddress", {})
        .get((token_address or "").lower(), {})
    )
    return int(metadata.get("decimals", 18))


def _decimal_to_units(value: str | float | int, decimals: int) -> int:
    scaled = Decimal(str(value)) * (Decimal(10) ** decimals)
    return int(scaled.quantize(Decimal("1")))


def _serialize(intent: Dict[str, Any]) -> Dict[str, Any]:
    serialized = dict(intent)
    for field_name in ("createdAt", "updatedAt", "decryptionReadyAt", "finalizedAt"):
        value = serialized.get(field_name)
        if isinstance(value, datetime):
            serialized[field_name] = value.isoformat()
    return serialized


async def _persist_intent(request: Request, intent: Dict[str, Any]) -> None:
    CONFIDENTIAL_INTENTS[intent["intentId"]] = intent

    db = getattr(request.app.state, "db", None)
    if db is None:
        return

    try:
        await db.confidential_intents.replace_one(
            {"intentId": intent["intentId"]},
            _serialize(intent),
            upsert=True,
        )
    except Exception as exc:
        logger.warning("Failed to persist confidential intent %s: %s", intent["intentId"], exc)


async def _load_intent(request: Request, intent_id: str) -> Optional[Dict[str, Any]]:
    intent = CONFIDENTIAL_INTENTS.get(intent_id)
    if intent:
        return intent

    db = getattr(request.app.state, "db", None)
    if db is None:
        return None

    document = await db.confidential_intents.find_one({"intentId": intent_id}, {"_id": 0})
    if not document:
        return None

    for field_name in ("createdAt", "updatedAt", "decryptionReadyAt", "finalizedAt"):
        value = document.get(field_name)
        if isinstance(value, str):
            document[field_name] = datetime.fromisoformat(value)

    CONFIDENTIAL_INTENTS[intent_id] = document
    return document


def _refresh_transient_status(intent: Dict[str, Any]) -> None:
    ready_at = intent.get("decryptionReadyAt")
    if (
        intent.get("stage") == "decryption_requested"
        and ready_at
        and isinstance(ready_at, datetime)
        and _utc_now() >= ready_at
    ):
        intent["decryptionReady"] = True
        intent["stage"] = "ready_to_finalize"
        intent["status"] = "ready_to_finalize"
        intent["statusMessage"] = (
            "Decryption result is ready. Finalize the confidential settlement now."
        )
        intent["updatedAt"] = _utc_now()


def _is_ztoken_symbol(symbol: Optional[str]) -> bool:
    return bool(symbol and symbol.lower().startswith("z"))


def _select_live_execution_adapter(intent: Dict[str, Any]) -> Optional[Dict[str, str]]:
    chain_config = CHAIN_CONFIG.get(intent["srcChainId"], {})
    adapters = chain_config.get("adapters", {})
    token_in_symbol = intent.get("tokenInSymbol")
    token_out_symbol = intent.get("tokenOutSymbol")

    if _is_ztoken_symbol(token_in_symbol) and _is_ztoken_symbol(token_out_symbol):
        adapter_address = adapters.get("zeroToll")
        if adapter_address:
            return {
                "address": adapter_address,
                "kind": "zeroToll",
                "label": "ZeroTollAdapter",
                "mode": "cross_token_ztoken_adapter_live_demo",
            }

    if not _is_ztoken_symbol(token_in_symbol) and not _is_ztoken_symbol(token_out_symbol):
        adapter_address = adapters.get("mockDex")
        if adapter_address:
            return {
                "address": adapter_address,
                "kind": "mockDex",
                "label": "MockDEXAdapter",
                "mode": "cross_token_adapter_live_demo",
            }

    return None


def _describe_live_execution(mode: str, finalized: Optional[bool] = None) -> str:
    if finalized is None:
        if mode == "same_token_live_escrow_demo":
            return "Live same-token confidential demo executed on escrow. Waiting for on-chain decryption readiness."
        if mode == "cross_token_ztoken_adapter_live_demo":
            return "Live zToken confidential execution routed through ZeroTollAdapter. Waiting for on-chain decryption readiness."
        if mode == "cross_token_adapter_live_demo":
            return "Live confidential execution routed through MockDEXAdapter. Waiting for on-chain decryption readiness."
        return "Live cross-token inventory-backed confidential demo executed on escrow. Waiting for on-chain decryption readiness."

    if finalized:
        if mode == "same_token_live_escrow_demo":
            return "Live same-token confidential settlement finalized on escrow."
        if mode == "cross_token_ztoken_adapter_live_demo":
            return "Live zToken confidential settlement finalized through ZeroTollAdapter."
        if mode == "cross_token_adapter_live_demo":
            return "Live confidential settlement finalized through MockDEXAdapter."
        return "Live cross-token inventory-backed confidential settlement finalized on escrow."

    if mode == "same_token_live_escrow_demo":
        return "Live same-token confidential settlement refunded on escrow."
    if mode == "cross_token_ztoken_adapter_live_demo":
        return "Live zToken confidential settlement refunded after ZeroTollAdapter execution."
    if mode == "cross_token_adapter_live_demo":
        return "Live confidential settlement refunded after MockDEXAdapter execution."
    return "Live cross-token inventory-backed confidential settlement refunded on escrow."


def _live_escrow_demo_eligible(intent: Dict[str, Any]) -> bool:
    return bool(
        intent.get("contractRef")
        and intent.get("amountInUnits")
        and intent.get("quotedAmountOutUnits")
        and intent.get("estimatedFeeTokenUnits")
    )


def _get_contract_state(chain_id: int, intent_id: Optional[str] = None) -> Dict[str, Any]:
    chain_config = CHAIN_CONFIG.get(chain_id, {})
    contract_address = chain_config.get("confidentialIntentEscrow")
    client = get_confidential_contract_client(chain_id)
    settlement = None
    verdict_status = None

    if intent_id and client is not None:
        try:
            settlement = get_settlement_summary(chain_id, intent_id)
            verdict_status = get_verdict_status(chain_id, intent_id)
        except Exception as exc:
            logger.warning("Failed to load settlement summary for %s on chain %s: %s", intent_id, chain_id, exc)

    return {
        "confidentialIntentEscrow": contract_address,
        "ready": bool(contract_address),
        "submissionReady": client is not None,
        "liveSubmitMode": (
            "plaintext_testing_helper" if contract_address and client is not None else "staged_backend_only"
        ),
        "settlement": settlement,
        "verdictStatus": verdict_status,
    }


def _build_quote(token_in_symbol: str, token_out_symbol: str, amount_in: float, chain_id: int) -> Dict[str, Any]:
    contract_state = _get_contract_state(chain_id)
    price_in_data = pyth_oracle.get_price(token_in_symbol, chain_id)
    price_out_data = pyth_oracle.get_price(token_out_symbol, chain_id)

    if not price_in_data["available"] or not price_out_data["available"]:
        raise HTTPException(
            status_code=503,
            detail=f"Confidential quote unavailable for {token_in_symbol} or {token_out_symbol}.",
        )

    price_in = price_in_data["price"]
    price_out = price_out_data["price"]

    usd_value = amount_in * price_in
    gross_out = usd_value / price_out

    sponsorship_fee_rate = 0.0075
    protocol_fee_rate = 0.0025
    total_fee_rate = sponsorship_fee_rate + protocol_fee_rate

    confidential_settlement_buffer = 0.985
    net_out_before_guard = gross_out * (1 - total_fee_rate)
    net_out = net_out_before_guard * confidential_settlement_buffer
    suggested_confidential_min_out = net_out * 0.97

    fee_amount = gross_out - net_out
    fee_usd = fee_amount * price_out

    return {
        "success": True,
        "mode": "CONFIDENTIAL_GASLESS_INTENT",
        "method": (
            "Fhenix-hybrid-live-submit"
            if contract_state.get("submissionReady")
            else "Fhenix-scaffold"
        ),
        "tokenInSymbol": token_in_symbol,
        "tokenOutSymbol": token_out_symbol,
        "grossOut": round(gross_out, 6),
        "netOut": round(net_out, 6),
        "estimatedFeeToken": round(fee_amount, 6),
        "estimatedFeeUSD": round(fee_usd, 6),
        "suggestedConfidentialMinOut": round(suggested_confidential_min_out, 6),
        "privacy": {
            "clientEncryptionExpected": (
                "cofhe_sdk_web" if chain_id in COFHE_BROWSER_CHAINS else "commitment_only_scaffold"
            ),
            "contractEnforcement": "contracts-package-only",
            "runtimeStatus": (
                "hybrid-live-escrow-with-adapter-execution"
                if contract_state.get("submissionReady")
                else "staged-backend-lifecycle"
            ),
        },
        "contract": contract_state,
        "oracleSource": "Pyth",
        "priceStaleness": {
            token_in_symbol: price_in_data["stale"],
            token_out_symbol: price_out_data["stale"],
        },
    }


class ConfidentialQuoteRequest(BaseModel):
    user: str
    tokenIn: str
    tokenOut: str
    amountIn: float
    srcChainId: int
    dstChainId: int
    feeMode: str = "OUTPUT"
    feeCap: float = 3.0

    @field_validator("user")
    @classmethod
    def validate_user(cls, value: str) -> str:
        if not _is_address(value):
            raise ValueError("Invalid Ethereum address")
        return value.lower()

    @field_validator("amountIn", "feeCap")
    @classmethod
    def validate_positive_number(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Amount must be positive")
        return value

    @field_validator("srcChainId", "dstChainId")
    @classmethod
    def validate_chain(cls, value: int) -> int:
        if value not in SUPPORTED_CHAINS:
            raise ValueError("Unsupported confidential chain")
        return value


class ConfidentialSubmitRequest(BaseModel):
    user: str
    tokenIn: str
    tokenOut: str
    amountIn: str
    amountInUnits: Optional[str] = None
    quotedAmountOut: str
    quotedAmountOutUnits: Optional[str] = None
    estimatedFeeToken: Optional[str] = None
    estimatedFeeTokenUnits: Optional[str] = None
    srcChainId: int
    dstChainId: int
    feeMode: str = "OUTPUT"
    feeCap: str = "0"
    deadline: int
    nonce: int
    encryptedMinOutCommitment: str
    encryptedPayload: Optional[Dict[str, Any]] = None
    clientEncryptionMode: str = "commitment_only_scaffold"
    clientGuardrailBps: int = 9500
    plaintextMinOutForTesting: Optional[str] = None

    @field_validator("user")
    @classmethod
    def validate_submit_user(cls, value: str) -> str:
        if not _is_address(value):
            raise ValueError("Invalid Ethereum address")
        return value.lower()

    @field_validator("amountIn", "quotedAmountOut", "feeCap")
    @classmethod
    def validate_numeric_string(cls, value: str) -> str:
        if _coerce_float(value) <= 0:
            raise ValueError("Numeric string must be positive")
        return value

    @field_validator("amountInUnits", "quotedAmountOutUnits")
    @classmethod
    def validate_optional_unit_string(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if int(value) <= 0:
            raise ValueError("Unit string must be positive")
        return value

    @field_validator("estimatedFeeTokenUnits")
    @classmethod
    def validate_optional_fee_unit_string(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if int(value) < 0:
            raise ValueError("Fee unit string must be non-negative")
        return value

    @field_validator("estimatedFeeToken")
    @classmethod
    def validate_optional_fee_string(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if _coerce_float(value) < 0:
            raise ValueError("estimatedFeeToken must be non-negative")
        return value

    @field_validator("plaintextMinOutForTesting")
    @classmethod
    def validate_optional_numeric_string(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if _coerce_float(value) <= 0:
            raise ValueError("plaintextMinOutForTesting must be positive")
        return value

    @field_validator("encryptedMinOutCommitment")
    @classmethod
    def validate_commitment(cls, value: str) -> str:
        if not re.match(r"^0x[a-fA-F0-9]{64}$", value):
            raise ValueError("Commitment must be a 32-byte hex string")
        return value

    @field_validator("clientGuardrailBps")
    @classmethod
    def validate_guardrail(cls, value: int) -> int:
        if value < 100 or value > 10000:
            raise ValueError("Guardrail BPS must be between 100 and 10000")
        return value

    @field_validator("srcChainId", "dstChainId")
    @classmethod
    def validate_submit_chain(cls, value: int) -> int:
        if value not in SUPPORTED_CHAINS:
            raise ValueError("Unsupported confidential chain")
        return value


class ConfidentialExecuteRequest(BaseModel):
    intentId: str


class ConfidentialFinalizeRequest(BaseModel):
    intentId: str


@router.post("/quote")
async def get_confidential_quote(request: ConfidentialQuoteRequest):
    token_in_symbol = _coerce_token_symbol(request.tokenIn, request.srcChainId)
    token_out_symbol = _coerce_token_symbol(request.tokenOut, request.dstChainId)
    return _build_quote(token_in_symbol, token_out_symbol, request.amountIn, request.srcChainId)


@router.post("/submit")
async def submit_confidential_intent(payload: ConfidentialSubmitRequest, request: Request):
    token_in_symbol = _coerce_token_symbol(payload.tokenIn, payload.srcChainId)
    token_out_symbol = _coerce_token_symbol(payload.tokenOut, payload.dstChainId)

    intent_id = str(uuid.uuid4())
    now = _utc_now()
    contract_state = _get_contract_state(payload.srcChainId)
    onchain_submit = None
    enforcement_mode = "backend_scaffold_until_contract_wiring"
    amount_in_units = payload.amountInUnits or str(
        _decimal_to_units(payload.amountIn, _token_decimals(payload.srcChainId, payload.tokenIn))
    )
    quoted_amount_out_units = payload.quotedAmountOutUnits or str(
        _decimal_to_units(payload.quotedAmountOut, _token_decimals(payload.dstChainId, payload.tokenOut))
    )
    estimated_fee_token = payload.estimatedFeeToken or "0"
    estimated_fee_token_units = payload.estimatedFeeTokenUnits or (
        str(_decimal_to_units(estimated_fee_token, _token_decimals(payload.dstChainId, payload.tokenOut)))
        if _coerce_float(estimated_fee_token) > 0
        else "0"
    )

    if contract_state["submissionReady"] and payload.plaintextMinOutForTesting:
        intent_payload = {
            "user": payload.user,
            "tokenIn": payload.tokenIn,
            "tokenOut": payload.tokenOut,
            "amountIn": int(amount_in_units),
            "deadline": payload.deadline,
            "nonce": payload.nonce,
            "chainId": payload.srcChainId,
            "encryptedMinOutCommitment": payload.encryptedMinOutCommitment,
        }
        try:
            onchain_submit = submit_intent_with_plaintext_min_out(
                payload.srcChainId,
                intent_payload,
                int(payload.plaintextMinOutForTesting),
            )
            enforcement_mode = "onchain_submit_plaintext_testing_helper"
        except Exception as exc:
            error_message = str(exc)
            if "allowance" in error_message.lower() or "transfer amount" in error_message.lower():
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "On-chain confidential submit failed because the escrow contract is not approved "
                        "to pull tokenIn yet. Approve the ConfidentialIntentEscrow spender first, then retry."
                    ),
                ) from exc
            raise HTTPException(
                status_code=502,
                detail=f"On-chain confidential submit failed: {error_message}",
            ) from exc

    record = {
        "intentId": intent_id,
        "stage": "submitted_onchain" if onchain_submit else "submitted",
        "status": "submitted_onchain" if onchain_submit else "submitted",
        "statusMessage": (
            "Intent committed on ConfidentialIntentEscrow. Waiting for sponsored execution orchestration."
            if onchain_submit
            else "Intent committed. Waiting for sponsored execution."
        ),
        "user": payload.user,
        "tokenIn": payload.tokenIn,
        "tokenOut": payload.tokenOut,
        "tokenInSymbol": token_in_symbol,
        "tokenOutSymbol": token_out_symbol,
        "amountIn": payload.amountIn,
        "amountInUnits": amount_in_units,
        "quotedAmountOut": payload.quotedAmountOut,
        "quotedAmountOutUnits": quoted_amount_out_units,
        "estimatedFeeToken": estimated_fee_token,
        "estimatedFeeTokenUnits": estimated_fee_token_units,
        "srcChainId": payload.srcChainId,
        "dstChainId": payload.dstChainId,
        "feeMode": payload.feeMode,
        "feeCap": payload.feeCap,
        "deadline": payload.deadline,
        "nonce": payload.nonce,
        "encryptedMinOutCommitment": payload.encryptedMinOutCommitment,
        "encryptedPayload": payload.encryptedPayload or {},
        "clientEncryptionMode": payload.clientEncryptionMode,
        "clientGuardrailBps": payload.clientGuardrailBps,
        "plaintextMinOutForTesting": payload.plaintextMinOutForTesting,
        "enforcementMode": enforcement_mode,
        "createdAt": now,
        "updatedAt": now,
        "decryptionReady": False,
        "decryptionReadyAt": None,
        "finalizedAt": None,
        "relayRef": f"confidential-{intent_id[:8]}",
        "contractRef": onchain_submit,
        "execution": None,
        "result": None,
    }

    await _persist_intent(request, record)

    return {
        "success": True,
        "intentId": intent_id,
        "stage": record["stage"],
        "statusMessage": record["statusMessage"],
        "contract": {
            **_get_contract_state(payload.srcChainId, onchain_submit["contractIntentId"] if onchain_submit else None),
            "submission": onchain_submit,
        },
        "privacy": {
            "clientEncryptionMode": record["clientEncryptionMode"],
            "enforcementMode": record["enforcementMode"],
        },
    }


@router.post("/execute")
async def execute_confidential_intent(payload: ConfidentialExecuteRequest, request: Request):
    record = await _load_intent(request, payload.intentId)
    if not record:
        raise HTTPException(status_code=404, detail="Confidential intent not found")

    if record["stage"] not in {"submitted", "submitted_onchain", "executing"}:
        raise HTTPException(
            status_code=409,
            detail=f"Intent cannot be executed from stage {record['stage']}",
        )

    quoted_amount_out = _coerce_float(record["quotedAmountOut"])
    guarded_min_out = quoted_amount_out * (record["clientGuardrailBps"] / 10000)

    simulated_gross_out = quoted_amount_out * 0.992
    simulated_fee = max(quoted_amount_out - simulated_gross_out, 0.0)
    simulated_verdict = simulated_gross_out >= guarded_min_out

    if _live_escrow_demo_eligible(record):
        contract_intent_id = record["contractRef"]["contractIntentId"]
        amount_in_units = int(record["amountInUnits"])
        quoted_amount_out_units = int(record["quotedAmountOutUnits"])
        fee_units = int(record["estimatedFeeTokenUnits"])
        gross_amount_out_units = quoted_amount_out_units + fee_units
        direct_adapter = _select_live_execution_adapter(record)

        if direct_adapter:
            try:
                onchain_execution = execute_adapter_backed_execution(
                    chain_id=record["srcChainId"],
                    intent_id=contract_intent_id,
                    adapter_address=direct_adapter["address"],
                    adapter_kind=direct_adapter["kind"],
                    token_in_address=record["tokenIn"],
                    token_out_address=record["tokenOut"],
                    amount_in_units=amount_in_units,
                    execution_min_amount_out=1,
                    deadline=int(record["deadline"]),
                    estimated_fee_amount=fee_units,
                    plaintext_min_out=int(record.get("plaintextMinOutForTesting") or 0),
                )
                live_mode = direct_adapter["mode"]
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"On-chain confidential adapter execution failed: {exc}",
                ) from exc
        else:
            try:
                onchain_execution = simulate_inventory_backed_execution(
                    record["srcChainId"],
                    contract_intent_id,
                    token_in_address=record["tokenIn"],
                    token_out_address=record["tokenOut"],
                    amount_in_units=amount_in_units,
                    gross_amount_out=gross_amount_out_units,
                    fee_amount=fee_units,
                )
                live_mode = (
                    "same_token_live_escrow_demo"
                    if (record["tokenIn"] or "").lower() == (record["tokenOut"] or "").lower()
                    else "cross_token_inventory_live_demo"
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"On-chain confidential execution failed: {exc}",
                ) from exc

        now = _utc_now()
        record["stage"] = "decryption_requested"
        record["status"] = "decryption_requested"
        record["statusMessage"] = _describe_live_execution(live_mode)
        record["enforcementMode"] = live_mode
        record["updatedAt"] = now
        record["decryptionReady"] = False
        record["decryptionReadyAt"] = None
        record["execution"] = {
            "grossAmountOut": str(onchain_execution.get("grossAmountOut", gross_amount_out_units)),
            "estimatedFeeToken": str(onchain_execution.get("appliedFeeAmount", fee_units)),
            "simulatedVerdict": None,
            "verdictSource": "onchain_fhenix_demo",
            "liveExecution": onchain_execution,
        }

        await _persist_intent(request, record)

        return {
            "success": True,
            "intentId": record["intentId"],
            "stage": record["stage"],
            "statusMessage": record["statusMessage"],
            "execution": record["execution"],
        }

    now = _utc_now()
    record["stage"] = "decryption_requested"
    record["status"] = "decryption_requested"
    record["statusMessage"] = (
        "Sponsored execution recorded. Waiting for decryption readiness before finalization."
    )
    record["updatedAt"] = now
    record["decryptionReady"] = False
    record["decryptionReadyAt"] = now + timedelta(seconds=4)
    record["execution"] = {
        "grossAmountOut": round(simulated_gross_out, 6),
        "estimatedFeeToken": round(simulated_fee, 6),
        "simulatedVerdict": simulated_verdict,
        "verdictSource": "scaffold-guardrail",
    }

    await _persist_intent(request, record)

    return {
        "success": True,
        "intentId": record["intentId"],
        "stage": record["stage"],
        "statusMessage": record["statusMessage"],
        "decryptionReadyAt": record["decryptionReadyAt"].isoformat(),
        "execution": record["execution"],
    }


@router.post("/finalize")
async def finalize_confidential_intent(payload: ConfidentialFinalizeRequest, request: Request):
    record = await _load_intent(request, payload.intentId)
    if not record:
        raise HTTPException(status_code=404, detail="Confidential intent not found")

    _refresh_transient_status(record)

    if _live_escrow_demo_eligible(record):
        contract_intent_id = record["contractRef"]["contractIntentId"]
        contract_state = _get_contract_state(record["srcChainId"], contract_intent_id)
        verdict_status = contract_state.get("verdictStatus") or {}

        if not verdict_status.get("decrypted"):
            raise HTTPException(
                status_code=409,
                detail="On-chain decryption result is not ready yet",
            )

        try:
            finalize_result = finalize_confidential_settlement(
                record["srcChainId"],
                contract_intent_id,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"On-chain confidential finalize failed: {exc}",
            ) from exc

        verdict = bool(finalize_result["verdict"])
        now = _utc_now()
        record["stage"] = "finalized_success" if verdict else "refunded"
        record["status"] = record["stage"]
        record["statusMessage"] = _describe_live_execution(
            record.get("enforcementMode", "cross_token_inventory_live_demo"),
            finalized=verdict,
        )
        record["updatedAt"] = now
        record["finalizedAt"] = now
        record["decryptionReady"] = True
        record["result"] = {
            "verdict": verdict,
            "verdictSource": "onchain_fhenix_demo",
            "finalizeTxHash": finalize_result["finalizeTxHash"],
        }

        await _persist_intent(request, record)

        return {
            "success": True,
            "intentId": record["intentId"],
            "stage": record["stage"],
            "statusMessage": record["statusMessage"],
            "result": record["result"],
        }

    if record["stage"] not in {"decryption_requested", "ready_to_finalize"}:
        raise HTTPException(
            status_code=409,
            detail=f"Intent cannot be finalized from stage {record['stage']}",
        )

    if not record.get("decryptionReady"):
        raise HTTPException(
            status_code=409,
            detail="Decryption result not ready yet",
        )

    verdict = bool(record.get("execution", {}).get("simulatedVerdict"))
    now = _utc_now()

    if verdict:
        record["stage"] = "finalized_success"
        record["status"] = "finalized_success"
        record["statusMessage"] = (
            "Confidential settlement finalized. User would receive tokenOut net of sponsored gas and protocol fee."
        )
    else:
        record["stage"] = "refunded"
        record["status"] = "refunded"
        record["statusMessage"] = (
            "Confidential threshold failed. User would be refunded on the staged settlement path."
        )

    record["updatedAt"] = now
    record["finalizedAt"] = now
    record["result"] = {
        "verdict": verdict,
        "verdictSource": record.get("execution", {}).get("verdictSource", "unknown"),
    }

    await _persist_intent(request, record)

    return {
        "success": True,
        "intentId": record["intentId"],
        "stage": record["stage"],
        "statusMessage": record["statusMessage"],
        "result": record["result"],
    }


@router.get("/status/{intent_id}")
async def get_confidential_status(intent_id: str, request: Request):
    record = await _load_intent(request, intent_id)
    if not record:
        raise HTTPException(status_code=404, detail="Confidential intent not found")

    _refresh_transient_status(record)
    if record.get("contractRef"):
        contract_state = _get_contract_state(
            record["srcChainId"],
            record.get("contractRef", {}).get("contractIntentId"),
        )
        verdict_status = contract_state.get("verdictStatus") or {}
        if (
            record.get("stage") == "decryption_requested"
            and verdict_status.get("decrypted")
        ):
            record["decryptionReady"] = True
            record["stage"] = "ready_to_finalize"
            record["status"] = "ready_to_finalize"
            record["statusMessage"] = (
                "On-chain decryption verdict is ready. Finalize the confidential settlement now."
            )
            record["updatedAt"] = _utc_now()
    await _persist_intent(request, record)

    return {
        "success": True,
        "intentId": record["intentId"],
        "stage": record["stage"],
        "status": record["status"],
        "statusMessage": record["statusMessage"],
        "decryptionReady": record.get("decryptionReady", False),
        "relayRef": record.get("relayRef"),
        "privacy": {
            "clientEncryptionMode": record.get("clientEncryptionMode"),
            "enforcementMode": record.get("enforcementMode"),
        },
        "contract": {
            **_get_contract_state(
                record["srcChainId"],
                record.get("contractRef", {}).get("contractIntentId"),
            ),
            "submission": record.get("contractRef"),
        },
        "execution": record.get("execution"),
        "result": record.get("result"),
        "createdAt": record["createdAt"].isoformat(),
        "updatedAt": record["updatedAt"].isoformat(),
        "finalizedAt": record["finalizedAt"].isoformat() if record.get("finalizedAt") else None,
    }
