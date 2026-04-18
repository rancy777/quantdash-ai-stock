from __future__ import annotations

import importlib.util
import json
from datetime import datetime
from typing import Any

from server.shared import runtime


POLICY_PATH = runtime.SYSTEM_DIR / "eastmoney_provider_policy.json"
SECONDARY_PROVIDER = "mootdx"
SUPPORTED_POLICY_MODES = {"primary_only", "auto_fallback", "prefer_secondary"}
MAJOR_INDEX_SYMBOLS = {"000001", "399001", "399006", "000688"}
MAJOR_INDEX_SECIDS = {"1.000001", "0.399001", "0.399006", "1.000688"}

SECONDARY_DATASET_METADATA: dict[str, dict[str, Any]] = {
    "stock_kline": {
        "actions": ["stock_kline"],
        "label": "个股 K 线",
    },
    "index_kline": {
        "actions": ["index_kline", "stock_kline"],
        "label": "指数 K 线",
    },
    "major_indexes": {
        "actions": ["major_indexes"],
        "label": "主要指数快照",
    },
    "stock_quote_list": {
        "actions": ["stock_list_page", "chinext_list"],
        "label": "股票列表 / 基础行情",
    },
    "market_breadth": {
        "actions": ["market_breadth_overview", "full_market_rows", "full_market_pct_snapshot"],
        "label": "市场宽度 / 全市场快照",
    },
    "index_series": {
        "actions": ["emotion_index_series", "index_amount_series"],
        "label": "指数情绪 / 指数成交额序列",
    },
}
PRIMARY_ONLY_DATASET_METADATA: dict[str, dict[str, Any]] = {
    "sector_rotation": {
        "actions": ["sector_board_list", "sector_board_history"],
        "label": "板块榜单 / 板块历史",
    },
    "limit_pool": {
        "actions": ["limit_up_pool", "broken_pool", "limit_down_pool"],
        "label": "涨停 / 炸板 / 跌停池",
    },
    "valuation": {
        "actions": ["ashare_average_pe"],
        "label": "A股平均估值",
    },
    "futures": {
        "actions": ["futures_main_contract", "futures_net_position"],
        "label": "股指期货持仓",
    },
}
ACTION_DATASET_MAP = {
    "major_indexes": "major_indexes",
    "index_kline": "index_kline",
    "stock_list_page": "stock_quote_list",
    "chinext_list": "stock_quote_list",
    "market_breadth_overview": "market_breadth",
    "full_market_rows": "market_breadth",
    "full_market_pct_snapshot": "market_breadth",
    "emotion_index_series": "index_series",
    "index_amount_series": "index_series",
    "sector_board_list": "sector_rotation",
    "sector_board_history": "sector_rotation",
    "limit_up_pool": "limit_pool",
    "broken_pool": "limit_pool",
    "limit_down_pool": "limit_pool",
    "ashare_average_pe": "valuation",
    "futures_main_contract": "futures",
    "futures_net_position": "futures",
}
DEFAULT_POLICY = {
    "globalMode": "primary_only",
    "datasetOverrides": {},
    "secondaryProvider": SECONDARY_PROVIDER,
    "updatedAt": None,
}


def _dataset_catalog(metadata: dict[str, dict[str, Any]], *, secondary_supported: bool) -> list[dict[str, Any]]:
    return [
        {
            "actions": list(config["actions"]),
            "dataset": dataset,
            "label": config["label"],
            "secondarySupported": secondary_supported,
        }
        for dataset, config in metadata.items()
    ]


def _normalize_mode(value: Any) -> str:
    normalized = str(value or "").strip()
    if normalized in SUPPORTED_POLICY_MODES:
        return normalized
    return DEFAULT_POLICY["globalMode"]


def _normalize_dataset_overrides(raw: Any) -> dict[str, str]:
    if not isinstance(raw, dict):
        return {}
    overrides: dict[str, str] = {}
    for dataset, mode in raw.items():
        if dataset not in SECONDARY_DATASET_METADATA:
            continue
        overrides[dataset] = _normalize_mode(mode)
    return overrides


def _read_policy_file() -> dict[str, Any]:
    if not POLICY_PATH.exists():
        return dict(DEFAULT_POLICY)

    try:
        payload = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return dict(DEFAULT_POLICY)

    global_mode = payload.get("globalMode", payload.get("mode"))
    return {
        **DEFAULT_POLICY,
        "globalMode": _normalize_mode(global_mode),
        "datasetOverrides": _normalize_dataset_overrides(payload.get("datasetOverrides")),
        "secondaryProvider": SECONDARY_PROVIDER,
        "updatedAt": payload.get("updatedAt"),
    }


def is_mootdx_available() -> bool:
    return importlib.util.find_spec("mootdx") is not None


def resolve_action_dataset(action: str, params: dict[str, Any] | None = None) -> str | None:
    normalized_params = params or {}
    if action == "stock_kline":
        symbol = str(normalized_params.get("symbol", "")).strip()
        secid = str(normalized_params.get("secid", "")).strip()
        if symbol in MAJOR_INDEX_SYMBOLS or secid in MAJOR_INDEX_SECIDS:
            return "index_kline"
        return "stock_kline"
    return ACTION_DATASET_MAP.get(action)


def get_effective_policy_mode(action: str, params: dict[str, Any] | None = None) -> str:
    dataset = resolve_action_dataset(action, params)
    if dataset not in SECONDARY_DATASET_METADATA:
        return DEFAULT_POLICY["globalMode"]
    policy = _read_policy_file()
    return policy["datasetOverrides"].get(dataset, policy["globalMode"])


def save_eastmoney_provider_policy(
    global_mode: str,
    dataset_overrides: dict[str, Any] | None = None,
) -> dict[str, Any]:
    policy = {
        "globalMode": _normalize_mode(global_mode),
        "datasetOverrides": _normalize_dataset_overrides(dataset_overrides),
        "secondaryProvider": SECONDARY_PROVIDER,
        "updatedAt": datetime.utcnow().isoformat(),
    }
    POLICY_PATH.write_text(json.dumps(policy, ensure_ascii=False, indent=2), encoding="utf-8")
    return get_eastmoney_provider_policy()


def get_eastmoney_provider_policy() -> dict[str, Any]:
    policy = _read_policy_file()
    secondary_available = is_mootdx_available()
    secondary_reason = None if secondary_available else "未安装 mootdx"
    supported_actions = sorted(
        {
            *[action for config in SECONDARY_DATASET_METADATA.values() for action in config["actions"]],
            *[action for config in PRIMARY_ONLY_DATASET_METADATA.values() for action in config["actions"]],
        }
    )
    return {
        "datasetOverrides": policy["datasetOverrides"],
        "globalMode": policy["globalMode"],
        "mode": policy["globalMode"],
        "primaryOnlyDatasets": _dataset_catalog(PRIMARY_ONLY_DATASET_METADATA, secondary_supported=False),
        "secondaryAvailable": secondary_available,
        "secondaryProvider": SECONDARY_PROVIDER,
        "secondaryReason": secondary_reason,
        "supportedActions": supported_actions,
        "supportedDatasets": _dataset_catalog(SECONDARY_DATASET_METADATA, secondary_supported=True),
        "updatedAt": policy.get("updatedAt"),
    }


def should_prefer_secondary(action: str, params: dict[str, Any] | None = None) -> bool:
    dataset = resolve_action_dataset(action, params)
    if dataset not in SECONDARY_DATASET_METADATA:
        return False
    policy = get_eastmoney_provider_policy()
    if not policy["secondaryAvailable"]:
        return False
    return get_effective_policy_mode(action, params) == "prefer_secondary"


def should_fallback_to_secondary(action: str, params: dict[str, Any] | None = None) -> bool:
    dataset = resolve_action_dataset(action, params)
    if dataset not in SECONDARY_DATASET_METADATA:
        return False
    policy = get_eastmoney_provider_policy()
    if not policy["secondaryAvailable"]:
        return False
    return get_effective_policy_mode(action, params) in {"auto_fallback", "prefer_secondary"}


__all__ = [
    "DEFAULT_POLICY",
    "PRIMARY_ONLY_DATASET_METADATA",
    "SECONDARY_DATASET_METADATA",
    "SUPPORTED_POLICY_MODES",
    "get_eastmoney_provider_policy",
    "get_effective_policy_mode",
    "is_mootdx_available",
    "resolve_action_dataset",
    "save_eastmoney_provider_policy",
    "should_fallback_to_secondary",
    "should_prefer_secondary",
]
