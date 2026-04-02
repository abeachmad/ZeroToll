"""
Confidential gasless intent routes.

This module powers ZeroToll's staged confidential flow and is intentionally
explicit about the runtime mode in use:

1. backend-only staged scaffold
2. on-chain plaintext testing-helper submit path
3. future direct encrypted submit path

Today, the browser already performs real CoFHE encryption for `minOut`, but
the relayed on-chain confidential submit path is still split between
demo/testing-helper wiring and the future production encrypted flow.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import os
from pathlib import Path
from typing import Any, Dict, Optional
import json
import logging
import re
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, field_validator

from confidential_contract import (
    execute_adapter_backed_execution,
    finalize_confidential_settlement,
    get_confidential_contract_client,
    get_operator_inventory_status,
    get_settlement_summary,
    get_verdict_status,
    probe_live_adapter_execution,
    simulate_inventory_backed_execution,
    submit_intent_with_permit2_min_out,
    submit_intent_with_permit_min_out,
    submit_intent_with_plaintext_min_out,
)
from pyth_rest_oracle import pyth_oracle
from token_registry import address_to_symbol, symbol_to_address

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/confidential", tags=["confidential"])

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
CHAIN_CONFIG_PATH = BACKEND_DIR / "chain_config.json"
TOKEN_ADDRESSES_PATH = BACKEND_DIR / "token_addresses.json"
CONFIDENTIAL_INTENTS_PATH = PROJECT_ROOT / ".pids" / "confidential_intents.json"
LEGACY_CONFIDENTIAL_INTENTS_PATH = BACKEND_DIR / ".pids" / "confidential_intents.json"
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


def _env_flag(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _confidential_test_helpers_enabled() -> bool:
    # Default to enabled for backwards-compatible demos until the production
    # encrypted relayed submit path is fully wired.
    return _env_flag("CONFIDENTIAL_ALLOW_TEST_HELPERS", default=True)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _is_address(value: str) -> bool:
    return bool(re.match(r"^0x[a-fA-F0-9]{40}$", value or ""))


def _coerce_token_symbol(value: str, chain_id: int) -> str:
    if _is_address(value):
        return address_to_symbol(value, chain_id)
    return value.upper()


def _is_native_symbol(symbol: Optional[str], chain_id: int) -> bool:
    if not symbol:
        return False

    native_symbol = str(CHAIN_CONFIG.get(chain_id, {}).get("nativeSymbol") or "").upper()
    normalized = symbol.upper()
    return normalized == "NATIVE" or (native_symbol and normalized == native_symbol)


def _get_wrapped_native_address(chain_id: int) -> Optional[str]:
    configured = CHAIN_CONFIG.get(chain_id, {}).get("wrappedToken")
    if _is_address(configured or ""):
        return configured

    native_symbol = str(CHAIN_CONFIG.get(chain_id, {}).get("nativeSymbol") or "").upper()
    candidates = {
        "ETH": ("WETH",),
        "POL": ("WPOL", "WMATIC"),
        "MATIC": ("WMATIC", "WPOL"),
    }.get(native_symbol, ())

    for symbol in candidates:
        try:
            candidate = symbol_to_address(symbol, chain_id)
        except Exception:
            continue
        if _is_address(candidate):
            return candidate

    return None


def _resolve_token_address(value: str, symbol: str, chain_id: int) -> Optional[str]:
    if _is_address(value):
        return value

    try:
        resolved = symbol_to_address(symbol, chain_id)
    except Exception:
        return None

    return resolved if _is_address(resolved) else None


def _resolve_confidential_output(
    token_out_value: str,
    token_out_symbol: str,
    chain_id: int,
) -> Dict[str, Any]:
    requested_is_native = _is_native_symbol(token_out_symbol, chain_id)
    requested_symbol = (
        str(CHAIN_CONFIG.get(chain_id, {}).get("nativeSymbol") or token_out_symbol).upper()
        if requested_is_native
        else token_out_symbol
    )
    requested_address = _resolve_token_address(token_out_value, requested_symbol, chain_id)
    execution_address = requested_address
    execution_symbol = requested_symbol

    if requested_is_native:
        wrapped_native_address = _get_wrapped_native_address(chain_id)
        if not wrapped_native_address:
            raise HTTPException(
                status_code=400,
                detail="Wrapped native token is not configured for confidential native delivery on this chain.",
            )
        execution_address = wrapped_native_address
        execution_symbol = address_to_symbol(wrapped_native_address, chain_id)

    return {
        "requestedAddress": requested_address,
        "requestedSymbol": requested_symbol,
        "requestedIsNative": requested_is_native,
        "executionAddress": execution_address,
        "executionSymbol": execution_symbol,
        "deliveryMode": "native_unwrap" if requested_is_native else "erc20_transfer",
    }


def _ensure_confidential_supported(
    token_in_symbol: str,
    token_out_symbol: str,
    src_chain_id: int,
    dst_chain_id: int,
) -> None:
    if _is_native_symbol(token_in_symbol, src_chain_id):
        raise HTTPException(
            status_code=400,
            detail="Confidential Gasless Intent currently supports ERC-20 input tokens only.",
        )

    if _is_native_symbol(token_out_symbol, dst_chain_id) and not _get_wrapped_native_address(dst_chain_id):
        raise HTTPException(
            status_code=400,
            detail="Wrapped native token is not configured for confidential native delivery on this chain.",
        )


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


def _units_to_decimal(value: int | str, decimals: int) -> float:
    return float(Decimal(str(value)) / (Decimal(10) ** decimals))


def _serialize(intent: Dict[str, Any]) -> Dict[str, Any]:
    serialized = dict(intent)
    for field_name in ("createdAt", "updatedAt", "decryptionReadyAt", "finalizedAt"):
        value = serialized.get(field_name)
        if isinstance(value, datetime):
            serialized[field_name] = value.isoformat()
    return serialized


def _deserialize(document: Dict[str, Any]) -> Dict[str, Any]:
    restored = dict(document)
    for field_name in ("createdAt", "updatedAt", "decryptionReadyAt", "finalizedAt"):
        value = restored.get(field_name)
        if isinstance(value, str):
            restored[field_name] = datetime.fromisoformat(value)
    return restored


def _load_intents_from_disk() -> Dict[str, Dict[str, Any]]:
    source_path = CONFIDENTIAL_INTENTS_PATH
    loaded_from_legacy = False
    if not source_path.exists() and LEGACY_CONFIDENTIAL_INTENTS_PATH.exists():
        source_path = LEGACY_CONFIDENTIAL_INTENTS_PATH
        loaded_from_legacy = True

    if not source_path.exists():
        return {}

    try:
        payload = json.loads(source_path.read_text())
    except Exception as exc:
        logger.warning("Failed to load confidential intent cache from disk: %s", exc)
        return {}

    if not isinstance(payload, dict):
        return {}

    restored: Dict[str, Dict[str, Any]] = {}
    for intent_id, intent in payload.items():
        if isinstance(intent, dict):
            restored[intent_id] = _deserialize(intent)

    if loaded_from_legacy:
        try:
            CONFIDENTIAL_INTENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
            CONFIDENTIAL_INTENTS_PATH.write_text(json.dumps(payload, indent=2))
            LEGACY_CONFIDENTIAL_INTENTS_PATH.unlink(missing_ok=True)
        except Exception as exc:
            logger.warning("Failed to migrate legacy confidential intent cache: %s", exc)

    return restored


def _persist_intents_to_disk() -> None:
    try:
        CONFIDENTIAL_INTENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        serialized = {
            intent_id: _serialize(intent)
            for intent_id, intent in CONFIDENTIAL_INTENTS.items()
        }
        CONFIDENTIAL_INTENTS_PATH.write_text(json.dumps(serialized, indent=2))
        if LEGACY_CONFIDENTIAL_INTENTS_PATH.exists():
            try:
                LEGACY_CONFIDENTIAL_INTENTS_PATH.unlink()
            except Exception:
                # Keep the new canonical cache even if legacy cleanup fails.
                pass
    except Exception as exc:
        logger.warning("Failed to write confidential intent cache to disk: %s", exc)


CONFIDENTIAL_INTENTS: Dict[str, Dict[str, Any]] = _load_intents_from_disk()


async def _persist_intent(request: Request, intent: Dict[str, Any]) -> None:
    CONFIDENTIAL_INTENTS[intent["intentId"]] = intent
    _persist_intents_to_disk()

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

    disk_intents = _load_intents_from_disk()
    disk_intent = disk_intents.get(intent_id)
    if disk_intent:
        CONFIDENTIAL_INTENTS[intent_id] = disk_intent
        return disk_intent

    db = getattr(request.app.state, "db", None)
    if db is None:
        return None

    document = await db.confidential_intents.find_one({"intentId": intent_id}, {"_id": 0})
    if not document:
        return None

    restored = _deserialize(document)
    CONFIDENTIAL_INTENTS[intent_id] = restored
    _persist_intents_to_disk()
    return restored


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


def _sync_record_from_contract_state(record: Dict[str, Any], contract_state: Dict[str, Any]) -> bool:
    settlement = contract_state.get("settlement") or {}
    verdict_status = contract_state.get("verdictStatus") or {}
    settlement_stage = settlement.get("stage")
    if not settlement_stage or settlement_stage == "none":
        return False

    changed = False
    now = _utc_now()

    if settlement.get("grossAmountOut") and settlement.get("grossAmountOut") != "0":
        current_execution = record.get("execution") or {}
        next_execution = {
            **current_execution,
            "grossAmountOut": settlement.get("grossAmountOut"),
            "estimatedFeeToken": settlement.get("feeAmount"),
            "simulatedVerdict": None,
            "verdictSource": "onchain_fhenix_demo",
        }
        if current_execution != next_execution:
            record["execution"] = next_execution
            changed = True

    if settlement_stage in {"executing", "executed"}:
        if record.get("stage") not in {"executing", "decryption_requested", "ready_to_finalize", "finalized_success", "refunded"}:
            record["stage"] = "executing"
            record["status"] = "executing"
            record["statusMessage"] = "Sponsored execution is in progress on the confidential escrow path."
            record["updatedAt"] = now
            changed = True
        return changed

    if settlement_stage == "decryption_requested":
        next_stage = "ready_to_finalize" if verdict_status.get("decrypted") else "decryption_requested"
        next_message = (
            "On-chain decryption verdict is ready. Finalize the confidential settlement now."
            if verdict_status.get("decrypted")
            else _describe_live_execution(record.get("enforcementMode", "cross_token_inventory_live_demo"))
        )
        if record.get("stage") != next_stage or record.get("statusMessage") != next_message or record.get("decryptionReady") != bool(verdict_status.get("decrypted")):
            record["stage"] = next_stage
            record["status"] = next_stage
            record["statusMessage"] = next_message
            record["decryptionReady"] = bool(verdict_status.get("decrypted"))
            record["updatedAt"] = now
            changed = True
        return changed

    if settlement_stage == "finalized_success":
        delivered_as = (
            CHAIN_CONFIG.get(record["dstChainId"], {}).get("nativeSymbol")
            if record.get("requestedTokenOutIsNative")
            else record.get("requestedTokenOutSymbol")
        )
        next_result = {
            "verdict": True,
            "verdictSource": "onchain_fhenix_demo",
            "finalizeTxHash": record.get("result", {}).get("finalizeTxHash"),
            "deliveredAs": delivered_as,
        }
        if record.get("stage") != "finalized_success" or record.get("result") != next_result:
            record["stage"] = "finalized_success"
            record["status"] = "finalized_success"
            record["statusMessage"] = _describe_live_execution(record.get("enforcementMode", "cross_token_inventory_live_demo"), finalized=True)
            record["decryptionReady"] = True
            record["finalizedAt"] = record.get("finalizedAt") or now
            record["updatedAt"] = now
            record["result"] = next_result
            changed = True
        return changed

    if settlement_stage == "finalized_refunded":
        next_result = {
            "verdict": False,
            "verdictSource": "onchain_fhenix_demo",
            "finalizeTxHash": record.get("result", {}).get("finalizeTxHash"),
            "deliveredAs": record.get("requestedTokenOutSymbol"),
        }
        if record.get("stage") != "refunded" or record.get("result") != next_result:
            record["stage"] = "refunded"
            record["status"] = "refunded"
            record["statusMessage"] = _describe_live_execution(record.get("enforcementMode", "cross_token_inventory_live_demo"), finalized=False)
            record["decryptionReady"] = True
            record["finalizedAt"] = record.get("finalizedAt") or now
            record["updatedAt"] = now
            record["result"] = next_result
            changed = True

    return changed


def _is_ztoken_symbol(symbol: Optional[str]) -> bool:
    return bool(symbol and symbol.lower().startswith("z"))


def _select_live_execution_adapter(intent: Dict[str, Any]) -> Optional[Dict[str, str]]:
    chain_config = CHAIN_CONFIG.get(intent["srcChainId"], {})
    adapters = chain_config.get("adapters", {})
    smart_dex_adapter = chain_config.get("smartDexAdapter")
    token_in_symbol = intent.get("tokenInSymbol")
    token_out_symbol = intent.get("tokenOutSymbol")

    if _is_ztoken_symbol(token_in_symbol) and _is_ztoken_symbol(token_out_symbol):
        adapter_address = adapters.get("zeroToll")
        if adapter_address:
            return {
                "address": adapter_address,
                "kind": "zeroToll",
                "label": "ZeroTollAdapter",
                "mode": "cross_token_ztoken_adapter_live",
            }

    if not _is_ztoken_symbol(token_in_symbol) and not _is_ztoken_symbol(token_out_symbol):
        if smart_dex_adapter:
            return {
                "address": smart_dex_adapter,
                "kind": "smartDex",
                "label": "SmartDexAdapter",
                "mode": "cross_token_smartdex_adapter_live",
            }
        adapter_address = adapters.get("mockDex")
        if adapter_address:
            return {
                "address": adapter_address,
                "kind": "mockDex",
                "label": "MockDEXAdapter",
                "mode": "cross_token_mockdex_adapter_demo",
            }

    return None


def _describe_live_execution(mode: str, finalized: Optional[bool] = None) -> str:
    if finalized is None:
        if mode == "same_token_live_escrow_demo":
            return "Live same-token confidential demo executed on escrow. Waiting for on-chain decryption readiness."
        if mode == "cross_token_ztoken_adapter_live":
            return "Live zToken confidential execution routed through ZeroTollAdapter. Waiting for on-chain decryption readiness."
        if mode == "cross_token_smartdex_adapter_live":
            return "Live confidential execution routed through SmartDexAdapter. Waiting for on-chain decryption readiness."
        if mode == "cross_token_mockdex_adapter_demo":
            return "Live confidential execution routed through MockDEXAdapter demo liquidity. This path is on-chain, but the venue is still a mocked market. Waiting for on-chain decryption readiness."
        return "Live cross-token inventory-backed confidential demo executed on escrow. Waiting for on-chain decryption readiness."

    if finalized:
        if mode == "same_token_live_escrow_demo":
            return "Live same-token confidential settlement finalized on escrow."
        if mode == "cross_token_ztoken_adapter_live":
            return "Live zToken confidential settlement finalized through ZeroTollAdapter."
        if mode == "cross_token_smartdex_adapter_live":
            return "Live confidential settlement finalized through SmartDexAdapter."
        if mode == "cross_token_mockdex_adapter_demo":
            return "Live confidential settlement finalized through MockDEXAdapter demo liquidity. This was an on-chain demo path, not a production market venue."
        return "Live cross-token inventory-backed confidential settlement finalized on escrow."

    if mode == "same_token_live_escrow_demo":
        return "Live same-token confidential settlement refunded on escrow."
    if mode == "cross_token_ztoken_adapter_live":
        return "Live zToken confidential settlement refunded after ZeroTollAdapter execution."
    if mode == "cross_token_smartdex_adapter_live":
        return "Live confidential settlement refunded after SmartDexAdapter execution."
    if mode == "cross_token_mockdex_adapter_demo":
        return "Live confidential settlement refunded after MockDEXAdapter demo execution."
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
    wrapped_token = _get_wrapped_native_address(chain_id)
    client = None
    settlement = None
    verdict_status = None

    try:
        client = get_confidential_contract_client(chain_id)
    except Exception as exc:
        logger.warning(
            "Failed to initialize confidential contract client for chain %s: %s",
            chain_id,
            exc,
        )

    if intent_id and client is not None:
        try:
            settlement = get_settlement_summary(chain_id, intent_id)
            verdict_status = get_verdict_status(chain_id, intent_id)
        except Exception as exc:
            logger.warning("Failed to load settlement summary for %s on chain %s: %s", intent_id, chain_id, exc)

    contract_client_ready = client is not None
    test_helper_submit_enabled = contract_client_ready and _confidential_test_helpers_enabled()
    production_encrypted_submit_ready = False

    if test_helper_submit_enabled:
        live_submit_mode = "plaintext_testing_helper"
    elif contract_client_ready:
        live_submit_mode = "encrypted_submit_pending"
    else:
        live_submit_mode = "staged_backend_only"

    return {
        "confidentialIntentEscrow": contract_address,
        "wrappedToken": wrapped_token,
        "ready": bool(contract_address),
        "submissionReady": contract_client_ready,
        "contractClientReady": contract_client_ready,
        "nativeDeliveryReady": bool(contract_address and wrapped_token and contract_client_ready),
        "liveSubmitMode": live_submit_mode,
        "testHelperSubmitEnabled": test_helper_submit_enabled,
        "productionEncryptedSubmitReady": production_encrypted_submit_ready,
        "submitter": client.get("signer") if client is not None else None,
        "settlement": settlement,
        "verdictStatus": verdict_status,
    }


def _build_live_adapter_hint(
    *,
    chain_id: int,
    token_in_address: Optional[str],
    token_out_address: Optional[str],
    token_in_symbol: str,
    token_out_symbol: str,
    amount_in: float,
    expected_output_hint: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    try:
        if not (_is_address(token_in_address or "") and _is_address(token_out_address or "")):
            return None

        direct_adapter = _select_live_execution_adapter(
            {
                "srcChainId": chain_id,
                "tokenInSymbol": token_in_symbol,
                "tokenOutSymbol": token_out_symbol,
            }
        )
        amount_in_units = _decimal_to_units(amount_in, _token_decimals(chain_id, token_in_address))
        expected_output_hint_units = (
            _decimal_to_units(expected_output_hint, _token_decimals(chain_id, token_out_address))
            if expected_output_hint and expected_output_hint > 0
            else 0
        )

        if not direct_adapter:
            inventory_status = get_operator_inventory_status(chain_id, token_out_address)
            if not inventory_status:
                return None

            available_units = int(inventory_status.get("balance") or 0)
            return {
                "ready": available_units >= expected_output_hint_units > 0,
                "mode": "cross_token_inventory_live_demo",
                "adapter": "InventoryOperator",
                "expectedOutputUnits": str(expected_output_hint_units),
                "expectedOutput": _units_to_decimal(
                    expected_output_hint_units,
                    _token_decimals(chain_id, token_out_address),
                ),
                "operatorInventoryBalanceUnits": str(available_units),
                "operatorInventoryBalance": _units_to_decimal(
                    available_units,
                    int(inventory_status.get("decimals") or _token_decimals(chain_id, token_out_address)),
                ),
                "operator": inventory_status.get("operator"),
                "quoteSource": "oracle_inventory_demo",
                "reason": (
                    None
                    if available_units >= expected_output_hint_units > 0
                    else "Operator inventory is currently below the quoted confidential tokenOut requirement for this mixed-pair demo path."
                ),
            }

        try:
            preflight = probe_live_adapter_execution(
                chain_id=chain_id,
                adapter_address=direct_adapter["address"],
                adapter_kind=direct_adapter["kind"],
                token_in_address=token_in_address,
                token_out_address=token_out_address,
                amount_in_units=amount_in_units,
                expected_output_hint=expected_output_hint_units,
            )
        except Exception as exc:
            logger.warning(
                "Failed to load live adapter hint for confidential quote on chain %s: %s",
                chain_id,
                exc,
            )
            return {
                "ready": False,
                "mode": direct_adapter["mode"],
                "adapter": direct_adapter["label"],
                "reason": str(exc),
            }

        expected_output_units = int(preflight.get("expectedOutput") or 0)
        token_out_decimals = _token_decimals(chain_id, token_out_address)

        return {
            "ready": bool(preflight.get("ready")),
            "mode": direct_adapter["mode"],
            "adapter": direct_adapter["label"],
            "expectedOutputUnits": str(expected_output_units),
            "expectedOutput": _units_to_decimal(expected_output_units, token_out_decimals),
            "adapterOutputBalanceUnits": preflight.get("adapterOutputBalance"),
            "quoteSource": preflight.get("quoteSource"),
            "reason": preflight.get("reason"),
        }
    except Exception as exc:
        logger.warning(
            "Failed to build live adapter hint for confidential quote on chain %s: %s",
            chain_id,
            exc,
        )
        return {
            "ready": False,
            "mode": "quote_fallback",
            "adapter": "QuoteFallback",
            "reason": str(exc),
        }


def _build_quote(
    token_in_symbol: str,
    requested_token_out_symbol: str,
    execution_token_out_symbol: str,
    amount_in: float,
    chain_id: int,
    token_in_address: Optional[str] = None,
    token_out_address: Optional[str] = None,
    delivery_mode: str = "erc20_transfer",
) -> Dict[str, Any]:
    contract_state = _get_contract_state(chain_id)
    price_in_data = pyth_oracle.get_price(token_in_symbol, chain_id)
    price_out_data = pyth_oracle.get_price(execution_token_out_symbol, chain_id)

    if not price_in_data["available"] or not price_out_data["available"]:
        raise HTTPException(
            status_code=503,
            detail=f"Confidential quote unavailable for {token_in_symbol} or {execution_token_out_symbol}.",
        )

    price_in = price_in_data["price"]
    price_out = price_out_data["price"]

    usd_value = amount_in * price_in
    gross_out = usd_value / price_out

    live_adapter_hint = _build_live_adapter_hint(
        chain_id=chain_id,
        token_in_address=token_in_address,
        token_out_address=token_out_address,
        token_in_symbol=token_in_symbol,
        token_out_symbol=execution_token_out_symbol,
        amount_in=amount_in,
        expected_output_hint=gross_out,
    )

    if live_adapter_hint and live_adapter_hint.get("ready") and live_adapter_hint.get("expectedOutput", 0) > 0:
        gross_out = float(live_adapter_hint["expectedOutput"])

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
            "Fhenix-testing-helper-live-submit"
            if contract_state.get("testHelperSubmitEnabled")
            else "Fhenix-encrypted-submit-pending"
            if contract_state.get("contractClientReady")
            else "Fhenix-staged-backend"
        ),
        "tokenInSymbol": token_in_symbol,
        "tokenOutSymbol": requested_token_out_symbol,
        "executionTokenOutSymbol": execution_token_out_symbol,
        "grossOut": round(gross_out, 6),
        "netOut": round(net_out, 6),
        "estimatedFeeToken": round(fee_amount, 6),
        "estimatedFeeUSD": round(fee_usd, 6),
        "suggestedConfidentialMinOut": round(suggested_confidential_min_out, 6),
        "delivery": {
            "mode": delivery_mode,
            "requestedTokenOutSymbol": requested_token_out_symbol,
            "executionTokenOutSymbol": execution_token_out_symbol,
            "willUnwrapNative": delivery_mode == "native_unwrap",
        },
        "privacy": {
            "clientEncryptionExpected": (
                "cofhe_sdk_web" if chain_id in COFHE_BROWSER_CHAINS else "commitment_only_scaffold"
            ),
            "contractEnforcement": (
                "testing_helper_submit"
                if contract_state.get("testHelperSubmitEnabled")
                else "encrypted_submit_pending"
                if contract_state.get("contractClientReady")
                else "backend_scaffold_only"
            ),
            "runtimeStatus": (
                "hybrid-live-escrow-with-testing-helper-submit"
                if contract_state.get("testHelperSubmitEnabled")
                else "encrypted-submit-pending"
                if contract_state.get("contractClientReady")
                else "staged-backend-lifecycle"
            ),
        },
        "contract": contract_state,
        "liveExecutionHint": live_adapter_hint,
        "oracleSource": "Pyth",
        "priceStaleness": {
            token_in_symbol: price_in_data["stale"],
            execution_token_out_symbol: price_out_data["stale"],
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
    testingHelperMinOutUnits: Optional[str] = None
    plaintextMinOutForTesting: Optional[str] = None
    permitType: Optional[str] = None
    permitSingle: Optional[Dict[str, Any]] = None
    permit2Signature: Optional[str] = None
    permit: Optional[Dict[str, Any]] = None

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

    @field_validator("testingHelperMinOutUnits", "plaintextMinOutForTesting")
    @classmethod
    def validate_optional_numeric_string(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        if _coerce_float(value) <= 0:
            raise ValueError("Testing-helper minOut must be positive")
        return value

    @field_validator("permitType")
    @classmethod
    def validate_optional_permit_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.lower()
        if normalized not in {"permit2", "erc2612"}:
            raise ValueError("permitType must be permit2 or erc2612")
        return normalized

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
    try:
        token_in_symbol = _coerce_token_symbol(request.tokenIn, request.srcChainId)
        token_out_symbol = _coerce_token_symbol(request.tokenOut, request.dstChainId)
        _ensure_confidential_supported(
            token_in_symbol,
            token_out_symbol,
            request.srcChainId,
            request.dstChainId,
        )
        output_resolution = _resolve_confidential_output(
            request.tokenOut,
            token_out_symbol,
            request.dstChainId,
        )
        return _build_quote(
            token_in_symbol,
            output_resolution["requestedSymbol"],
            output_resolution["executionSymbol"],
            request.amountIn,
            request.srcChainId,
            request.tokenIn,
            output_resolution["executionAddress"],
            output_resolution["deliveryMode"],
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Confidential quote failed for %s -> %s on chain %s: %s",
            request.tokenIn,
            request.tokenOut,
            request.srcChainId,
            exc,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Confidential quote failed: {exc}",
        ) from exc


@router.post("/submit")
async def submit_confidential_intent(payload: ConfidentialSubmitRequest, request: Request):
    token_in_symbol = _coerce_token_symbol(payload.tokenIn, payload.srcChainId)
    token_out_symbol = _coerce_token_symbol(payload.tokenOut, payload.dstChainId)
    _ensure_confidential_supported(
        token_in_symbol,
        token_out_symbol,
        payload.srcChainId,
        payload.dstChainId,
    )
    resolved_token_in = _resolve_token_address(payload.tokenIn, token_in_symbol, payload.srcChainId)
    output_resolution = _resolve_confidential_output(
        payload.tokenOut,
        token_out_symbol,
        payload.dstChainId,
    )
    execution_token_out = output_resolution["executionAddress"]
    execution_token_out_symbol = output_resolution["executionSymbol"]
    requested_native_output = output_resolution["requestedIsNative"]

    intent_id = str(uuid.uuid4())
    now = _utc_now()
    contract_state = _get_contract_state(payload.srcChainId)
    onchain_submit = None
    enforcement_mode = "backend_scaffold_until_contract_wiring"
    testing_helper_min_out_units = payload.testingHelperMinOutUnits or payload.plaintextMinOutForTesting
    amount_in_units = payload.amountInUnits or str(
        _decimal_to_units(payload.amountIn, _token_decimals(payload.srcChainId, resolved_token_in or payload.tokenIn))
    )
    quoted_amount_out_units = payload.quotedAmountOutUnits or str(
        _decimal_to_units(payload.quotedAmountOut, _token_decimals(payload.dstChainId, execution_token_out or payload.tokenOut))
    )
    estimated_fee_token = payload.estimatedFeeToken or "0"
    estimated_fee_token_units = payload.estimatedFeeTokenUnits or (
        str(_decimal_to_units(estimated_fee_token, _token_decimals(payload.dstChainId, execution_token_out or payload.tokenOut)))
        if _coerce_float(estimated_fee_token) > 0
        else "0"
    )
    funding_mode = "approval"

    if contract_state["submissionReady"] and contract_state.get("testHelperSubmitEnabled"):
        if not testing_helper_min_out_units:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Confidential live submit is currently running through the explicit testing-helper path, "
                    "but the frontend did not provide the helper minOut guard. Refresh the quote and retry."
                ),
            )
        intent_payload = {
            "user": payload.user,
            "tokenIn": resolved_token_in or payload.tokenIn,
            "tokenOut": execution_token_out or payload.tokenOut,
            "amountIn": int(amount_in_units),
            "deadline": payload.deadline,
            "nonce": payload.nonce,
            "chainId": payload.srcChainId,
            "encryptedMinOutCommitment": payload.encryptedMinOutCommitment,
        }
        try:
            if payload.permitType == "permit2" and payload.permitSingle and payload.permit2Signature:
                onchain_submit = submit_intent_with_permit2_min_out(
                    payload.srcChainId,
                    intent_payload,
                    int(testing_helper_min_out_units),
                    payload.permitSingle,
                    payload.permit2Signature,
                    requested_native_output,
                )
                enforcement_mode = "onchain_submit_permit2_testing_helper"
                funding_mode = "permit2"
            elif payload.permitType == "erc2612" and payload.permit:
                onchain_submit = submit_intent_with_permit_min_out(
                    payload.srcChainId,
                    intent_payload,
                    int(testing_helper_min_out_units),
                    payload.permit,
                    requested_native_output,
                )
                enforcement_mode = "onchain_submit_erc2612_testing_helper"
                funding_mode = "erc2612"
            else:
                onchain_submit = submit_intent_with_plaintext_min_out(
                    payload.srcChainId,
                    intent_payload,
                    int(testing_helper_min_out_units),
                    requested_native_output,
                )
                enforcement_mode = "onchain_submit_plaintext_testing_helper"
        except Exception as exc:
            error_message = str(exc)
            if "0x756688fe" in error_message.lower() or "invalidnonce" in error_message.lower():
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "On-chain confidential submit failed because the Permit2 nonce is stale for "
                        "the escrow spender. Sign a fresh Permit2 spending authorization and retry."
                    ),
                ) from exc
            if "permit2" in error_message.lower():
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "On-chain confidential submit failed because the Permit2 authorization "
                        "was rejected, expired, or did not match the escrow spender. "
                        "Sign a fresh Permit2 payload and retry."
                    ),
                ) from exc
            if "permit" in error_message.lower():
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "On-chain confidential submit failed because the ERC-2612 permit "
                        "was rejected or expired. Sign a fresh permit payload and retry."
                    ),
                ) from exc
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
            else (
                "Intent committed. Encrypted relayed submit is not wired yet for this runtime, so the staged backend lifecycle will continue off-chain."
                if contract_state.get("contractClientReady") and not contract_state.get("testHelperSubmitEnabled")
                else "Intent committed. Waiting for sponsored execution."
            )
        ),
        "user": payload.user,
        "tokenIn": resolved_token_in or payload.tokenIn,
        "tokenOut": execution_token_out or payload.tokenOut,
        "tokenInSymbol": token_in_symbol,
        "tokenOutSymbol": execution_token_out_symbol,
        "requestedTokenOut": output_resolution["requestedAddress"] or payload.tokenOut,
        "requestedTokenOutSymbol": output_resolution["requestedSymbol"],
        "requestedTokenOutIsNative": requested_native_output,
        "deliveryMode": output_resolution["deliveryMode"],
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
        "testingHelperMinOutUnits": testing_helper_min_out_units if contract_state.get("testHelperSubmitEnabled") else None,
        "fundingMode": funding_mode,
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
            "fundingMode": funding_mode,
        },
        "privacy": {
            "clientEncryptionMode": record["clientEncryptionMode"],
            "enforcementMode": record["enforcementMode"],
            "testHelperSubmitEnabled": contract_state.get("testHelperSubmitEnabled", False),
        },
        "delivery": {
            "mode": record["deliveryMode"],
            "requestedTokenOutSymbol": record["requestedTokenOutSymbol"],
            "executionTokenOutSymbol": record["tokenOutSymbol"],
            "willUnwrapNative": record["requestedTokenOutIsNative"],
        },
    }


@router.post("/execute")
async def execute_confidential_intent(payload: ConfidentialExecuteRequest, request: Request):
    record = await _load_intent(request, payload.intentId)
    if not record:
        raise HTTPException(status_code=404, detail="Confidential intent not found")

    if record.get("contractRef"):
        contract_state = _get_contract_state(
            record["srcChainId"],
            record.get("contractRef", {}).get("contractIntentId"),
        )
        if _sync_record_from_contract_state(record, contract_state):
            await _persist_intent(request, record)

    if record["stage"] in {"ready_to_finalize", "finalized_success", "refunded"}:
        return {
            "success": True,
            "intentId": record["intentId"],
            "stage": record["stage"],
            "statusMessage": record["statusMessage"],
            "execution": record.get("execution"),
            "result": record.get("result"),
        }

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
                    testing_helper_min_out=int(record.get("testingHelperMinOutUnits") or 0),
                    expected_output_hint=gross_amount_out_units,
                )
                live_mode = direct_adapter["mode"]
            except Exception as exc:
                status_code = 502
                error_message = str(exc)
                if "Invalid stage" in error_message:
                    contract_state = _get_contract_state(record["srcChainId"], contract_intent_id)
                    if _sync_record_from_contract_state(record, contract_state):
                        await _persist_intent(request, record)
                        return {
                            "success": True,
                            "intentId": record["intentId"],
                            "stage": record["stage"],
                            "statusMessage": record["statusMessage"],
                            "execution": record.get("execution"),
                            "result": record.get("result"),
                        }
                if "cannot satisfy the confidential minimum output" in error_message:
                    status_code = 409
                raise HTTPException(
                    status_code=status_code,
                    detail=f"On-chain confidential adapter execution failed: {error_message}",
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
                error_message = str(exc)
                if "Invalid stage" in error_message:
                    contract_state = _get_contract_state(record["srcChainId"], contract_intent_id)
                    if _sync_record_from_contract_state(record, contract_state):
                        await _persist_intent(request, record)
                        return {
                            "success": True,
                            "intentId": record["intentId"],
                            "stage": record["stage"],
                            "statusMessage": record["statusMessage"],
                            "execution": record.get("execution"),
                            "result": record.get("result"),
                        }
                if "Insufficient operator inventory" in error_message:
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "On-chain confidential execution is currently using the inventory-backed mixed-pair demo path, "
                            f"but operator inventory is insufficient. {error_message}"
                        ),
                    ) from exc
                raise HTTPException(
                    status_code=502,
                    detail=f"On-chain confidential execution failed: {error_message}",
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

    if record.get("contractRef"):
        contract_state = _get_contract_state(
            record["srcChainId"],
            record.get("contractRef", {}).get("contractIntentId"),
        )
        if _sync_record_from_contract_state(record, contract_state):
            await _persist_intent(request, record)

    _refresh_transient_status(record)

    if record.get("stage") in {"finalized_success", "refunded"}:
        return {
            "success": True,
            "intentId": record["intentId"],
            "stage": record["stage"],
            "statusMessage": record.get("statusMessage"),
            "result": record.get("result"),
            "delivery": {
                "mode": record.get("deliveryMode", "erc20_transfer"),
                "requestedTokenOutSymbol": record.get("requestedTokenOutSymbol", record.get("tokenOutSymbol")),
                "executionTokenOutSymbol": record.get("tokenOutSymbol"),
                "willUnwrapNative": record.get("requestedTokenOutIsNative", False),
            },
        }

    if _live_escrow_demo_eligible(record):
        contract_intent_id = record["contractRef"]["contractIntentId"]
        contract_state = _get_contract_state(record["srcChainId"], contract_intent_id)
        verdict_status = contract_state.get("verdictStatus") or {}
        enforcement_mode = record.get("enforcementMode")

        if not verdict_status.get("decrypted"):
            raise HTTPException(
                status_code=409,
                detail="On-chain decryption result is not ready yet",
            )

        if (
            verdict_status.get("verdict") is False
            and enforcement_mode in {
                "cross_token_ztoken_adapter_live",
                "cross_token_smartdex_adapter_live",
                "cross_token_mockdex_adapter_demo",
                "cross_token_inventory_live_demo",
            }
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "The confidential threshold was not met by the live cross-token execution path. "
                    "This demo path cannot safely refund after tokenIn has been released. "
                    "Request a fresh quote or lower the confidential threshold before retrying."
                ),
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
            "deliveredAs": (
                CHAIN_CONFIG.get(record["dstChainId"], {}).get("nativeSymbol")
                if record.get("requestedTokenOutIsNative")
                else record.get("requestedTokenOutSymbol")
            ),
        }

        await _persist_intent(request, record)

        return {
            "success": True,
            "intentId": record["intentId"],
            "stage": record["stage"],
            "statusMessage": record["statusMessage"],
            "result": record["result"],
            "delivery": {
                "mode": record.get("deliveryMode"),
                "requestedTokenOutSymbol": record.get("requestedTokenOutSymbol"),
                "executionTokenOutSymbol": record.get("tokenOutSymbol"),
                "willUnwrapNative": record.get("requestedTokenOutIsNative", False),
            },
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
        "deliveredAs": (
            CHAIN_CONFIG.get(record["dstChainId"], {}).get("nativeSymbol")
            if verdict and record.get("requestedTokenOutIsNative")
            else record.get("requestedTokenOutSymbol")
        ),
    }

    await _persist_intent(request, record)

    return {
        "success": True,
        "intentId": record["intentId"],
        "stage": record["stage"],
        "statusMessage": record["statusMessage"],
        "result": record["result"],
        "delivery": {
            "mode": record.get("deliveryMode"),
            "requestedTokenOutSymbol": record.get("requestedTokenOutSymbol"),
            "executionTokenOutSymbol": record.get("tokenOutSymbol"),
            "willUnwrapNative": record.get("requestedTokenOutIsNative", False),
        },
    }


@router.get("/status/{intent_id}")
async def get_confidential_status(intent_id: str, request: Request):
    record = await _load_intent(request, intent_id)
    if not record:
        raise HTTPException(status_code=404, detail="Confidential intent not found")

    if record.get("contractRef"):
        contract_state = _get_contract_state(
            record["srcChainId"],
            record.get("contractRef", {}).get("contractIntentId"),
        )
        _sync_record_from_contract_state(record, contract_state)

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
        "delivery": {
            "mode": record.get("deliveryMode"),
            "requestedTokenOutSymbol": record.get("requestedTokenOutSymbol"),
            "executionTokenOutSymbol": record.get("tokenOutSymbol"),
            "willUnwrapNative": record.get("requestedTokenOutIsNative", False),
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
