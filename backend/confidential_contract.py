import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from web3 import Web3

from generated_config import get_chain_config, get_rpc_url, is_configured_address

ROOT_DIR = Path(__file__).resolve().parent.parent
ABI_PATH = (
    ROOT_DIR
    / "packages"
    / "contracts"
    / "artifacts"
    / "contracts"
    / "fhenix"
    / "ConfidentialIntentEscrow.sol"
    / "ConfidentialIntentEscrow.json"
)
ENV_FILES = (
    ROOT_DIR / "packages" / "contracts" / ".env",
    ROOT_DIR / ".env.credentials",
    ROOT_DIR / ".env",
    ROOT_DIR / "backend" / ".env",
)

_ABI_CACHE: Optional[list[Dict[str, Any]]] = None
ERC20_ABI = [
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "owner", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "transfer",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
]
MOCK_DEX_ADAPTER_ABI = [
    {
        "name": "supportedTokens",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "token", "type": "address"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "getQuote",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"},
        ],
        "outputs": [
            {"name": "amountOut", "type": "uint256"},
            {"name": "path", "type": "address[]"},
        ],
    },
    {
        "name": "swap",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"},
            {"name": "minAmountOut", "type": "uint256"},
            {"name": "recipient", "type": "address"},
            {"name": "deadline", "type": "uint256"},
        ],
        "outputs": [{"name": "amountOut", "type": "uint256"}],
    },
]
ZERO_TOLL_ADAPTER_ABI = [
    {
        "name": "supportedTokens",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "token", "type": "address"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "getQuote",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"},
        ],
        "outputs": [{"name": "amountOut", "type": "uint256"}],
    },
    {
        "name": "swap",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "tokenIn", "type": "address"},
            {"name": "tokenOut", "type": "address"},
            {"name": "amountIn", "type": "uint256"},
            {"name": "minAmountOut", "type": "uint256"},
            {"name": "recipient", "type": "address"},
        ],
        "outputs": [{"name": "amountOut", "type": "uint256"}],
    },
]

SETTLEMENT_STAGE_NAMES = {
    0: "none",
    1: "submitted",
    2: "executing",
    3: "executed",
    4: "decryption_requested",
    5: "finalized_success",
    6: "finalized_refunded",
    7: "cancelled",
}


def _read_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip("'").strip('"')
        values[key.strip()] = value
    return values


def _load_env_value(*keys: str) -> Optional[str]:
    for env_path in ENV_FILES:
        values = _read_env_file(env_path)
        for key in keys:
            value = values.get(key)
            if value:
                return value

    for key in keys:
        value = os.getenv(key)
        if value:
            return value

    return None


def _normalize_private_key(value: str) -> str:
    return value if value.startswith("0x") else f"0x{value}"


def _load_escrow_abi() -> list[Dict[str, Any]]:
    global _ABI_CACHE
    if _ABI_CACHE is None:
        artifact = json.loads(ABI_PATH.read_text())
        _ABI_CACHE = artifact["abi"]
    return _ABI_CACHE


def get_confidential_contract_client(chain_id: int) -> Optional[Dict[str, Any]]:
    chain_config = get_chain_config(chain_id)
    contract_address = chain_config.get("confidentialIntentEscrow")
    rpc_url = get_rpc_url(chain_id)
    private_key = _load_env_value("PRIVATE_KEY_DEPLOYER", "RELAYER_PRIVATE_KEY")

    if not is_configured_address(contract_address) or not rpc_url or not private_key:
        return None

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    account = w3.eth.account.from_key(_normalize_private_key(private_key))
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(contract_address),
        abi=_load_escrow_abi(),
    )

    return {
        "web3": w3,
        "account": account,
        "contract": contract,
        "address": Web3.to_checksum_address(contract_address),
        "chainId": chain_id,
        "signer": account.address,
    }


def _build_fee_fields(w3: Web3) -> Dict[str, int]:
    latest_block = w3.eth.get_block("latest")
    base_fee = latest_block.get("baseFeePerGas")
    if base_fee is None:
        return {"gasPrice": int(w3.eth.gas_price)}

    try:
        priority_fee = int(w3.eth.max_priority_fee)
    except Exception:
        priority_fee = int(w3.to_wei(2, "gwei"))

    return {
        "maxPriorityFeePerGas": priority_fee,
        "maxFeePerGas": int(base_fee) * 2 + priority_fee,
    }


def _intent_tuple(intent: Dict[str, Any]) -> tuple[Any, ...]:
    return (
        Web3.to_checksum_address(intent["user"]),
        Web3.to_checksum_address(intent["tokenIn"]),
        Web3.to_checksum_address(intent["tokenOut"]),
        int(intent["amountIn"]),
        int(intent["deadline"]),
        int(intent["nonce"]),
        int(intent["chainId"]),
        intent["encryptedMinOutCommitment"],
    )


def _normalize_bytes32(value: str | bytes) -> bytes:
    if isinstance(value, bytes):
        return value
    return Web3.to_bytes(hexstr=value)


def _adapter_contract(w3: Web3, adapter_address: str, adapter_kind: str) -> Any:
    adapter_abi = (
        ZERO_TOLL_ADAPTER_ABI
        if adapter_kind == "zeroToll"
        else MOCK_DEX_ADAPTER_ABI
    )
    return w3.eth.contract(
        address=Web3.to_checksum_address(adapter_address),
        abi=adapter_abi,
    )


def _erc20_contract(w3: Web3, token_address: str) -> Any:
    return w3.eth.contract(
        address=Web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
    )


def _clamp_fee_amount(
    estimated_fee_amount: int,
    gross_amount_out: int,
    plaintext_min_out: int,
) -> int:
    if gross_amount_out <= 0 or estimated_fee_amount <= 0:
        return 0

    if plaintext_min_out > 0:
        max_fee_without_violating_user_floor = max(gross_amount_out - plaintext_min_out, 0)
        return min(estimated_fee_amount, max_fee_without_violating_user_floor)

    return min(estimated_fee_amount, gross_amount_out)


def _send_transaction(w3: Web3, account: Any, tx_builder: Any, chain_id: int) -> Dict[str, Any]:
    tx_params = {
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "chainId": chain_id,
        **_build_fee_fields(w3),
    }

    try:
        estimated_gas = tx_builder.estimate_gas(tx_params)
        tx_params["gas"] = int(estimated_gas * 1.2)
    except Exception as exc:
        raise RuntimeError(f"Preflight failed: {exc}") from exc

    signed = account.sign_transaction(tx_builder.build_transaction(tx_params))
    raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
    tx_hash = w3.eth.send_raw_transaction(raw_tx)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

    if getattr(receipt, "status", 0) != 1:
        raise RuntimeError(f"On-chain transaction reverted: {tx_hash.hex()}")

    return {
        "txHash": tx_hash.hex(),
        "blockNumber": receipt.blockNumber,
        "gasUsed": getattr(receipt, "gasUsed", None),
    }


def probe_live_adapter_execution(
    chain_id: int,
    adapter_address: str,
    adapter_kind: str,
    token_in_address: str,
    token_out_address: str,
    amount_in_units: int,
) -> Dict[str, Any]:
    client = get_confidential_contract_client(chain_id)
    if client is None:
        raise RuntimeError("ConfidentialIntentEscrow is not configured for live execution on this chain.")

    w3: Web3 = client["web3"]
    adapter = _adapter_contract(w3, adapter_address, adapter_kind)
    token_out = _erc20_contract(w3, token_out_address)
    token_in_checksum = Web3.to_checksum_address(token_in_address)
    token_out_checksum = Web3.to_checksum_address(token_out_address)

    supported_in = bool(adapter.functions.supportedTokens(token_in_checksum).call())
    supported_out = bool(adapter.functions.supportedTokens(token_out_checksum).call())
    if not supported_in or not supported_out:
        return {
            "ready": False,
            "supportedTokenIn": supported_in,
            "supportedTokenOut": supported_out,
            "reason": "Adapter does not support this token pair.",
        }

    if adapter_kind == "zeroToll":
        expected_output = int(
            adapter.functions.getQuote(
                token_in_checksum,
                token_out_checksum,
                int(amount_in_units),
            ).call()
        )
    else:
        quote_result = adapter.functions.getQuote(
            token_in_checksum,
            token_out_checksum,
            int(amount_in_units),
        ).call()
        expected_output = int(quote_result[0])

    output_balance = int(token_out.functions.balanceOf(Web3.to_checksum_address(adapter_address)).call())
    ready = expected_output > 0 and output_balance >= expected_output

    return {
        "ready": ready,
        "supportedTokenIn": supported_in,
        "supportedTokenOut": supported_out,
        "expectedOutput": str(expected_output),
        "adapterOutputBalance": str(output_balance),
        "reason": None if ready else "Adapter output liquidity is insufficient for the current quote.",
    }


def submit_intent_with_plaintext_min_out(
    chain_id: int,
    intent: Dict[str, Any],
    plaintext_min_out: int,
) -> Dict[str, Any]:
    client = get_confidential_contract_client(chain_id)
    if client is None:
        raise RuntimeError("ConfidentialIntentEscrow is not configured for live submission on this chain.")

    w3: Web3 = client["web3"]
    contract = client["contract"]
    account = client["account"]
    intent_tuple = _intent_tuple(intent)

    contract_intent_id = contract.functions.getIntentId(intent_tuple).call()
    tx_builder = contract.functions.submitIntentWithPlaintextMinOutForTesting(
        intent_tuple,
        int(plaintext_min_out),
    )
    receipt_data = _send_transaction(w3, account, tx_builder, chain_id)

    return {
        "contractIntentId": contract_intent_id.hex(),
        "submitTxHash": receipt_data["txHash"],
        "submitBlockNumber": receipt_data["blockNumber"],
        "submitter": account.address,
        "contractAddress": client["address"],
    }


def get_settlement_summary(chain_id: int, intent_id: str) -> Optional[Dict[str, Any]]:
    client = get_confidential_contract_client(chain_id)
    if client is None:
        return None

    contract = client["contract"]
    summary = contract.functions.getSettlementSummary(_normalize_bytes32(intent_id)).call()
    intent = summary[0]
    stage_value = int(summary[1])

    if stage_value == 0 and intent[0] == "0x0000000000000000000000000000000000000000":
        return None

    return {
        "stage": SETTLEMENT_STAGE_NAMES.get(stage_value, "unknown"),
        "stageValue": stage_value,
        "grossAmountOut": str(summary[4]),
        "feeAmount": str(summary[5]),
        "netAmountOut": str(summary[6]),
        "inputReleased": bool(summary[7]),
        "executionTarget": summary[8],
    }


def get_verdict_status(chain_id: int, intent_id: str) -> Optional[Dict[str, bool]]:
    client = get_confidential_contract_client(chain_id)
    if client is None:
        return None

    verdict, decrypted = client["contract"].functions.getVerdictStatus(
        _normalize_bytes32(intent_id)
    ).call()
    return {
        "verdict": bool(verdict),
        "decrypted": bool(decrypted),
    }


def simulate_inventory_backed_execution(
    chain_id: int,
    intent_id: str,
    token_in_address: str,
    token_out_address: str,
    amount_in_units: int,
    gross_amount_out: int,
    fee_amount: int,
) -> Dict[str, Any]:
    client = get_confidential_contract_client(chain_id)
    if client is None:
        raise RuntimeError("ConfidentialIntentEscrow is not configured for live execution on this chain.")

    w3: Web3 = client["web3"]
    account = client["account"]
    contract = client["contract"]
    token_out = w3.eth.contract(address=Web3.to_checksum_address(token_out_address), abi=ERC20_ABI)

    required_inventory = int(gross_amount_out)
    if token_in_address.lower() == token_out_address.lower():
        required_inventory = max(int(gross_amount_out) - int(amount_in_units), 0)

    available_balance = int(token_out.functions.balanceOf(account.address).call())
    if available_balance < required_inventory:
        raise RuntimeError(
            f"Insufficient operator inventory for tokenOut. Need {required_inventory}, have {available_balance}."
        )

    release_receipt = _send_transaction(
        w3,
        account,
        contract.functions.releaseInputForExecution(_normalize_bytes32(intent_id), account.address),
        chain_id,
    )
    fund_receipt = _send_transaction(
        w3,
        account,
        token_out.functions.transfer(client["address"], int(gross_amount_out)),
        chain_id,
    )
    record_receipt = _send_transaction(
        w3,
        account,
        contract.functions.recordExecutionResult(
            _normalize_bytes32(intent_id),
            int(gross_amount_out),
            int(fee_amount),
        ),
        chain_id,
    )
    decrypt_receipt = _send_transaction(
        w3,
        account,
        contract.functions.requestDecryption(_normalize_bytes32(intent_id)),
        chain_id,
    )

    return {
        "mode": (
            "same_token_live_demo"
            if token_in_address.lower() == token_out_address.lower()
            else "cross_token_inventory_backed_live_demo"
        ),
        "operatorInventoryRequired": str(required_inventory),
        "operatorInventoryBalance": str(available_balance),
        "releaseInputTxHash": release_receipt["txHash"],
        "returnOutputTxHash": fund_receipt["txHash"],
        "recordExecutionTxHash": record_receipt["txHash"],
        "requestDecryptionTxHash": decrypt_receipt["txHash"],
    }


def execute_adapter_backed_execution(
    chain_id: int,
    intent_id: str,
    adapter_address: str,
    adapter_kind: str,
    token_in_address: str,
    token_out_address: str,
    amount_in_units: int,
    execution_min_amount_out: int,
    deadline: int,
    estimated_fee_amount: int,
    plaintext_min_out: int,
) -> Dict[str, Any]:
    client = get_confidential_contract_client(chain_id)
    if client is None:
        raise RuntimeError("ConfidentialIntentEscrow is not configured for live execution on this chain.")

    preflight = probe_live_adapter_execution(
        chain_id=chain_id,
        adapter_address=adapter_address,
        adapter_kind=adapter_kind,
        token_in_address=token_in_address,
        token_out_address=token_out_address,
        amount_in_units=amount_in_units,
    )
    if not preflight.get("ready"):
        raise RuntimeError(preflight.get("reason") or "Adapter preflight failed.")

    expected_output = int(preflight.get("expectedOutput") or 0)
    if expected_output <= 0:
        raise RuntimeError("Adapter preflight returned zero output.")

    if int(plaintext_min_out) > expected_output:
        raise RuntimeError(
            "Live adapter quote cannot satisfy the confidential minimum output. "
            "No funds were moved; get a fresh quote or lower the confidential threshold."
        )

    w3: Web3 = client["web3"]
    account = client["account"]
    contract = client["contract"]
    adapter = _adapter_contract(w3, adapter_address, adapter_kind)
    token_out = _erc20_contract(w3, token_out_address)
    escrow_address = Web3.to_checksum_address(client["address"])

    balance_before = int(token_out.functions.balanceOf(escrow_address).call())

    release_receipt = _send_transaction(
        w3,
        account,
        contract.functions.releaseInputForExecution(
            _normalize_bytes32(intent_id),
            Web3.to_checksum_address(adapter_address),
        ),
        chain_id,
    )

    if adapter_kind == "zeroToll":
        swap_fn = adapter.functions.swap(
            Web3.to_checksum_address(token_in_address),
            Web3.to_checksum_address(token_out_address),
            int(amount_in_units),
            int(execution_min_amount_out),
            escrow_address,
        )
    else:
        swap_fn = adapter.functions.swap(
            Web3.to_checksum_address(token_in_address),
            Web3.to_checksum_address(token_out_address),
            int(amount_in_units),
            int(execution_min_amount_out),
            escrow_address,
            int(deadline),
        )

    swap_receipt = _send_transaction(
        w3,
        account,
        swap_fn,
        chain_id,
    )

    balance_after = int(token_out.functions.balanceOf(escrow_address).call())
    gross_amount_out = balance_after - balance_before
    if gross_amount_out <= 0:
        raise RuntimeError("Adapter execution completed but escrow did not receive any tokenOut.")

    applied_fee_amount = _clamp_fee_amount(
        int(estimated_fee_amount),
        int(gross_amount_out),
        int(plaintext_min_out),
    )

    record_receipt = _send_transaction(
        w3,
        account,
        contract.functions.recordExecutionResult(
            _normalize_bytes32(intent_id),
            int(gross_amount_out),
            int(applied_fee_amount),
        ),
        chain_id,
    )
    decrypt_receipt = _send_transaction(
        w3,
        account,
        contract.functions.requestDecryption(_normalize_bytes32(intent_id)),
        chain_id,
    )

    return {
        "mode": f"{adapter_kind}_adapter_live_demo",
        "adapterKind": adapter_kind,
        "adapterAddress": Web3.to_checksum_address(adapter_address),
        "preflight": preflight,
        "executionMinAmountOut": str(execution_min_amount_out),
        "grossAmountOut": str(gross_amount_out),
        "appliedFeeAmount": str(applied_fee_amount),
        "netAmountOut": str(gross_amount_out - applied_fee_amount),
        "releaseInputTxHash": release_receipt["txHash"],
        "swapTxHash": swap_receipt["txHash"],
        "recordExecutionTxHash": record_receipt["txHash"],
        "requestDecryptionTxHash": decrypt_receipt["txHash"],
    }


def finalize_confidential_settlement(chain_id: int, intent_id: str) -> Dict[str, Any]:
    client = get_confidential_contract_client(chain_id)
    if client is None:
        raise RuntimeError("ConfidentialIntentEscrow is not configured for live finalization on this chain.")

    verdict_status = get_verdict_status(chain_id, intent_id)
    if not verdict_status or not verdict_status["decrypted"]:
        raise RuntimeError("Verdict not decrypted yet.")

    contract = client["contract"]
    w3: Web3 = client["web3"]
    account = client["account"]
    fn = (
        contract.functions.finalizeSuccess(_normalize_bytes32(intent_id))
        if verdict_status["verdict"]
        else contract.functions.finalizeRefund(_normalize_bytes32(intent_id))
    )
    receipt_data = _send_transaction(w3, account, fn, chain_id)
    return {
        "finalizeTxHash": receipt_data["txHash"],
        "finalizedSuccess": verdict_status["verdict"],
        "verdict": verdict_status["verdict"],
    }
