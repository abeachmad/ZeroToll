import json
import os
from pathlib import Path
from typing import Any, Dict

ROOT_DIR = Path(__file__).resolve().parent
CHAIN_CONFIG_FILE = ROOT_DIR / "chain_config.json"
TOKEN_ADDRESSES_FILE = ROOT_DIR / "token_addresses.json"
NATIVE_TOKEN_SENTINEL = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

CHAIN_ENV_PREFIXES = {
    80002: "AMOY",
    11155111: "SEPOLIA",
    421614: "ARB_SEPOLIA",
    11155420: "OP_SEPOLIA",
}

ADAPTER_ENV_SUFFIXES = {
    "quickswapV2": "QUICKSWAP_ADAPTER",
    "uniswapV2": "UNISWAPV2_ADAPTER",
    "uniswapV3": "UNISWAPV3_ADAPTER",
    "mockDex": "MOCKDEX_ADAPTER",
    "mockBridge": "MOCKBRIDGE_ADAPTER",
    "zeroToll": "ZEROTOLL_ADAPTER",
}


def _load_json(path: Path) -> Dict[str, Any]:
    with open(path, "r") as handle:
        return json.load(handle)


CHAIN_CONFIG = {
    int(chain_id): value
    for chain_id, value in _load_json(CHAIN_CONFIG_FILE).items()
}
TOKEN_ADDRESSES = {
    int(chain_id): value
    for chain_id, value in _load_json(TOKEN_ADDRESSES_FILE).items()
}


def is_configured_address(value: Any) -> bool:
    return isinstance(value, str) and value.startswith("0x") and len(value) == 42


def get_chain_config(chain_id: int) -> Dict[str, Any]:
    return CHAIN_CONFIG.get(chain_id, {})


def get_token_map(chain_id: int) -> Dict[str, str]:
    return TOKEN_ADDRESSES.get(chain_id, {}).get("tokens", {})


def get_ztoken_map(chain_id: int) -> Dict[str, str]:
    ztokens = {}
    for symbol, address in get_token_map(chain_id).items():
        if symbol.upper().startswith("Z") and is_configured_address(address):
            ztokens[address.lower()] = symbol
    return ztokens


def get_rpc_url(chain_id: int) -> str | None:
    prefix = CHAIN_ENV_PREFIXES.get(chain_id)
    if prefix:
        override = os.getenv(f"RPC_{prefix}")
        if override:
            return override
    return get_chain_config(chain_id).get("rpc")


def get_explorer_tx_base(chain_id: int) -> str | None:
    return get_chain_config(chain_id).get("explorerTx")


def get_router_hub(chain_id: int) -> str | None:
    return get_chain_config(chain_id).get("routerHub")


def get_fee_sink(chain_id: int) -> str | None:
    return get_chain_config(chain_id).get("feeSink")


def get_adapter_address(chain_id: int, adapter_key: str) -> str | None:
    prefix = CHAIN_ENV_PREFIXES.get(chain_id)
    env_suffix = ADAPTER_ENV_SUFFIXES.get(adapter_key)
    if prefix and env_suffix:
        override = os.getenv(f"{prefix}_{env_suffix}")
        if override:
            return override

    address = get_chain_config(chain_id).get("adapters", {}).get(adapter_key)
    return address if is_configured_address(address) else None
