from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime
from typing import Any, Callable

from fastapi import HTTPException

from server.modules.eastmoney_policy import (
    SECONDARY_DATASET_METADATA,
    SECONDARY_PROVIDER,
    get_eastmoney_provider_policy,
    resolve_action_dataset,
)
from server.shared.cache import get_json_cache, set_json_cache
from server.shared import runtime


MOOTDX_KLINE_FREQUENCY_MAP = {
    101: 9,
}
SECONDARY_CACHE_TTL_SECONDS = 10
SECONDARY_FULL_MARKET_CACHE_TTL_SECONDS = 15
SECONDARY_REQUEST_SEMAPHORE = asyncio.Semaphore(4)
SECONDARY_CLIENT_LOCK = asyncio.Lock()
MAJOR_INDEX_DEFINITIONS = [
    {"market": 1, "name": "上证指数", "symbol": "000001"},
    {"market": 0, "name": "深证成指", "symbol": "399001"},
    {"market": 0, "name": "创业板指", "symbol": "399006"},
    {"market": 1, "name": "科创50", "symbol": "000688"},
]
SECID_SYMBOL_MAP = {
    "1.000001": "000001",
    "0.399001": "399001",
    "0.399006": "399006",
    "1.000688": "000688",
}
SECONDARY_HEALTH_PATH = runtime.SYSTEM_DIR / "eastmoney_secondary_health.json"
SECONDARY_CLIENT: Any | None = None


def _normalize_symbol(symbol: str) -> str:
    normalized = str(symbol or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="缺少必要参数: symbol")
    return normalized


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value in {None, "", "-"}:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value in {None, "", "-"}:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _utcnow_iso() -> str:
    return datetime.utcnow().isoformat()


def _market_for_symbol(symbol: str) -> int:
    return 1 if str(symbol).startswith("6") else 0


def _symbol_from_secid(secid: str) -> str:
    normalized = str(secid or "").strip()
    if normalized in SECID_SYMBOL_MAP:
        return SECID_SYMBOL_MAP[normalized]
    if "." in normalized:
        return normalized.split(".", 1)[1]
    return normalized


def _get_record_value(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] not in {None, ""}:
            return record[key]
    return None


def _records_from_rows(rows: Any) -> list[dict[str, Any]]:
    records = rows
    if hasattr(rows, "to_dict"):
        try:
            records = rows.to_dict("records")
        except TypeError:
            records = rows.to_dict()
    if not isinstance(records, list):
        raise HTTPException(status_code=502, detail="mootdx 返回了不可识别的数据结构")
    normalized: list[dict[str, Any]] = []
    for item in records:
        if isinstance(item, dict):
            normalized.append(item)
    return normalized


def _build_envelope(
    *,
    payload: Any,
    dataset_key: str,
    request_key: str,
) -> dict[str, Any]:
    updated_at = _utcnow_iso()
    return {
        "data": payload,
        "meta": {
            "datasetKey": dataset_key,
            "provider": SECONDARY_PROVIDER,
            "requestKey": request_key,
            "source": "secondary",
            "updatedAt": updated_at,
            "isSnapshotFallback": False,
            "isCached": False,
        },
    }


def _load_health_snapshot() -> dict[str, Any]:
    if not SECONDARY_HEALTH_PATH.exists():
        return {}
    try:
        return json.loads(SECONDARY_HEALTH_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def _write_health_snapshot(payload: dict[str, Any]) -> None:
    try:
        SECONDARY_HEALTH_PATH.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except OSError as exc:
        runtime.LOGGER.warning("Failed to write secondary health snapshot: %s", exc)


def _default_health_state() -> dict[str, Any]:
    policy = get_eastmoney_provider_policy()
    return {
        "available": policy["secondaryAvailable"],
        "configuredProvider": policy["secondaryProvider"],
        "lastCheckedAt": None,
        "lastError": policy["secondaryReason"],
        "lastLatencyMs": None,
        "lastSuccessAt": None,
        "probeResults": {},
        "provider": policy["secondaryProvider"],
        "supportedDatasets": [item["dataset"] for item in policy["supportedDatasets"]],
    }


def get_secondary_provider_health() -> dict[str, Any]:
    baseline = _default_health_state()
    snapshot = _load_health_snapshot()
    health = {**baseline, **snapshot}
    if not baseline["available"]:
        health["lastError"] = baseline["lastError"]
    return health


def _build_probe_result(ok: bool, latency_ms: float | None, detail: str, sample_size: int | None = None) -> dict[str, Any]:
    return {
        "checkedAt": _utcnow_iso(),
        "detail": detail,
        "latencyMs": round(latency_ms, 2) if latency_ms is not None else None,
        "ok": ok,
        "sampleSize": sample_size,
    }


async def _load_mootdx_client():
    global SECONDARY_CLIENT

    if SECONDARY_CLIENT is not None:
        return SECONDARY_CLIENT

    try:
        from mootdx.quotes import Quotes  # type: ignore
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="mootdx 未安装") from exc

    def _factory():
        return Quotes.factory(market="std", multithread=False, heartbeat=False)

    async with SECONDARY_CLIENT_LOCK:
        if SECONDARY_CLIENT is not None:
            return SECONDARY_CLIENT
        try:
            SECONDARY_CLIENT = await asyncio.to_thread(_factory)
            return SECONDARY_CLIENT
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"mootdx 初始化失败: {exc}") from exc


def _parse_kline_rows(rows: Any) -> list[dict[str, Any]]:
    records = _records_from_rows(rows)
    normalized_rows: list[dict[str, Any]] = []
    for item in records:
        date_value = _get_record_value(item, "datetime", "date", "day")
        if not date_value:
            continue
        normalized_rows.append(
            {
                "date": str(date_value)[:10],
                "open": _safe_float(_get_record_value(item, "open")),
                "close": _safe_float(_get_record_value(item, "close")),
                "high": _safe_float(_get_record_value(item, "high")),
                "low": _safe_float(_get_record_value(item, "low")),
                "volume": _safe_float(_get_record_value(item, "vol", "volume")),
            }
        )
    if not normalized_rows:
        raise HTTPException(status_code=502, detail="mootdx 未返回有效 K 线")
    return normalized_rows


def _normalize_quote_row(symbol: str, name: str, record: dict[str, Any] | None, *, industry: str) -> dict[str, Any]:
    quote = record or {}
    price = _safe_float(_get_record_value(quote, "price", "last_close", "last", "close"))
    prev_close = _safe_float(_get_record_value(quote, "last_close", "close", "last"), price)
    pct_change = 0.0
    if prev_close > 0:
        pct_change = ((price - prev_close) / prev_close) * 100
    volume = _safe_float(_get_record_value(quote, "vol", "volume"))
    amount = _safe_float(_get_record_value(quote, "amount", "turnover"))
    return {
        "f12": symbol,
        "f14": name,
        "f2": round(price, 2),
        "f3": round(pct_change, 2),
        "f5": volume,
        "f6": amount,
        "f9": "-",
        "f23": "-",
        "f20": "-",
        "f100": industry,
    }


async def _fetch_quote_map(client: Any, symbols: list[str]) -> dict[str, dict[str, Any]]:
    if not symbols:
        return {}

    def _run_quotes():
        return client.quotes(symbol=symbols)

    try:
        rows = await asyncio.to_thread(_run_quotes)
    except Exception:
        return {}

    records = _records_from_rows(rows)
    quote_map: dict[str, dict[str, Any]] = {}
    for item in records:
        symbol = str(_get_record_value(item, "code", "symbol", "stock_code") or "").strip()
        if symbol:
            quote_map[symbol] = item
    return quote_map


def _chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


async def _fetch_quote_map_batched(client: Any, symbols: list[str], *, batch_size: int = 200) -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    if not symbols:
        return merged

    for chunk in _chunked(symbols, batch_size):
        chunk_map = await _fetch_quote_map(client, chunk)
        merged.update(chunk_map)
    return merged


async def _fetch_stock_catalog(client: Any, market: int) -> list[dict[str, Any]]:
    def _run_stocks():
        return client.stocks(market=market)

    rows = await asyncio.to_thread(_run_stocks)
    records = _records_from_rows(rows)
    normalized: list[dict[str, Any]] = []
    for item in records:
        symbol = str(_get_record_value(item, "code", "symbol", "stock_code") or "").strip()
        name = str(_get_record_value(item, "name", "stock_name") or symbol).strip()
        if symbol:
            normalized.append({"market": market, "name": name, "symbol": symbol})
    return normalized


async def _load_full_market_diff(client: Any) -> list[dict[str, Any]]:
    cached = await get_json_cache("secondary_full_market", "all_diff")
    if isinstance(cached, list):
        return [item for item in cached if isinstance(item, dict)]

    sh_rows, sz_rows = await asyncio.gather(
        _fetch_stock_catalog(client, 1),
        _fetch_stock_catalog(client, 0),
    )
    catalog = sorted([*sh_rows, *sz_rows], key=lambda item: item["symbol"])
    quote_map = await _fetch_quote_map_batched(client, [item["symbol"] for item in catalog])
    diff = [
        _normalize_quote_row(item["symbol"], item["name"], quote_map.get(item["symbol"]), industry="A股")
        for item in catalog
    ]
    await set_json_cache("secondary_full_market", "all_diff", diff, SECONDARY_FULL_MARKET_CACHE_TTL_SECONDS)
    return diff


async def _handle_stock_kline(params: dict[str, Any]) -> dict[str, Any]:
    symbol = _normalize_symbol(params.get("symbol"))
    period = int(params.get("period", 101))
    limit = int(params.get("limit", 200))
    frequency = MOOTDX_KLINE_FREQUENCY_MAP.get(period)
    if frequency is None:
        raise HTTPException(status_code=400, detail=f"mootdx 暂不支持 period={period}")

    client = await _load_mootdx_client()

    def _run_bars():
        return client.bars(symbol=symbol, frequency=frequency, offset=limit)

    try:
        rows = await asyncio.to_thread(_run_bars)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"mootdx 获取个股 K 线失败: {exc}") from exc

    klines = _parse_kline_rows(rows)
    return _build_envelope(
        payload={
            "data": {
                "code": symbol,
                "klines": [
                    f"{row['date']},{row['open']},{row['close']},{row['high']},{row['low']},{row['volume']}"
                    for row in klines
                ],
            }
        },
        dataset_key=f"stock_kline_secondary_{symbol}_{period}_{limit}",
        request_key=f"{SECONDARY_PROVIDER}:stock_kline:{symbol}:{period}:{limit}",
    )


async def _handle_index_kline(params: dict[str, Any]) -> dict[str, Any]:
    symbol = _normalize_symbol(params.get("symbol"))
    period = int(params.get("period", 101))
    limit = int(params.get("limit", 200))
    frequency = MOOTDX_KLINE_FREQUENCY_MAP.get(period)
    if frequency is None:
        raise HTTPException(status_code=400, detail=f"mootdx 暂不支持 period={period}")

    client = await _load_mootdx_client()
    market = _market_for_symbol(symbol)

    def _run_index():
        return client.index(symbol=symbol, market=market, frequency=frequency, start=0, offset=limit)

    try:
        rows = await asyncio.to_thread(_run_index)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"mootdx 获取指数 K 线失败: {exc}") from exc

    klines = _parse_kline_rows(rows)
    return _build_envelope(
        payload={
            "data": {
                "code": symbol,
                "klines": [
                    f"{row['date']},{row['open']},{row['close']},{row['high']},{row['low']},{row['volume']}"
                    for row in klines
                ],
            }
        },
        dataset_key=f"index_kline_secondary_{symbol}_{period}_{limit}",
        request_key=f"{SECONDARY_PROVIDER}:index_kline:{symbol}:{period}:{limit}",
    )


async def _handle_major_indexes(_: dict[str, Any]) -> dict[str, Any]:
    client = await _load_mootdx_client()
    diff: list[dict[str, Any]] = []

    for definition in MAJOR_INDEX_DEFINITIONS:
        symbol = definition["symbol"]

        def _run_index():
            return client.index(symbol=symbol, market=definition["market"], frequency=9, start=0, offset=2)

        try:
            rows = await asyncio.to_thread(_run_index)
            records = _records_from_rows(rows)
            if len(records) < 2:
                continue
            latest = records[-1]
            prev = records[-2]
            latest_close = _safe_float(_get_record_value(latest, "close"))
            prev_close = _safe_float(_get_record_value(prev, "close"), latest_close)
            pct_change = 0.0
            if prev_close > 0:
                pct_change = ((latest_close - prev_close) / prev_close) * 100
            diff.append(
                {
                    "f12": symbol,
                    "f14": definition["name"],
                    "f2": round(latest_close, 2),
                    "f3": round(pct_change, 2),
                    "f5": _safe_float(_get_record_value(latest, "vol", "volume")),
                    "f6": _safe_float(_get_record_value(latest, "amount")),
                    "f9": "-",
                    "f23": "-",
                    "f20": "-",
                    "f100": "宽基指数",
                }
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"mootdx 获取主要指数失败: {exc}") from exc

    if not diff:
        raise HTTPException(status_code=502, detail="mootdx 未返回主要指数快照")

    return _build_envelope(
        payload={"data": {"diff": diff}},
        dataset_key="major_indexes_secondary",
        request_key=f"{SECONDARY_PROVIDER}:major_indexes",
    )


async def _handle_market_breadth_overview(_: dict[str, Any]) -> dict[str, Any]:
    client = await _load_mootdx_client()
    diff = await _load_full_market_diff(client)
    rise = 0
    fall = 0
    flat = 0
    for row in diff:
        pct = _safe_float(row.get("f3"))
        if pct > 0:
            rise += 1
        elif pct < 0:
            fall += 1
        else:
            flat += 1

    return _build_envelope(
        payload={"data": {"diff": [{"f104": rise, "f105": fall, "f106": flat}]}},
        dataset_key="market_breadth_overview_secondary",
        request_key=f"{SECONDARY_PROVIDER}:market_breadth_overview",
    )


async def _handle_full_market_rows(_: dict[str, Any]) -> dict[str, Any]:
    client = await _load_mootdx_client()
    diff = await _load_full_market_diff(client)
    return _build_envelope(
        payload=diff,
        dataset_key="full_market_rows_secondary",
        request_key=f"{SECONDARY_PROVIDER}:full_market_rows",
    )


async def _handle_full_market_pct_snapshot(_: dict[str, Any]) -> dict[str, Any]:
    client = await _load_mootdx_client()
    diff = await _load_full_market_diff(client)
    pct_diff = [{"f3": row.get("f3", 0)} for row in diff]
    return _build_envelope(
        payload={"data": {"diff": pct_diff}},
        dataset_key="full_market_pct_snapshot_secondary",
        request_key=f"{SECONDARY_PROVIDER}:full_market_pct_snapshot",
    )


async def _handle_emotion_index_series(params: dict[str, Any]) -> dict[str, Any]:
    secid = str(params.get("secid", "")).strip()
    symbol = _symbol_from_secid(secid)
    period = int(params.get("period", 101))
    limit = int(params.get("limit", 12))
    frequency = MOOTDX_KLINE_FREQUENCY_MAP.get(period)
    if frequency is None:
        raise HTTPException(status_code=400, detail=f"mootdx 暂不支持 period={period}")

    client = await _load_mootdx_client()
    market = _market_for_symbol(symbol)

    def _run_index():
        return client.index(symbol=symbol, market=market, frequency=frequency, start=0, offset=limit)

    try:
        rows = await asyncio.to_thread(_run_index)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"mootdx 获取指数情绪序列失败: {exc}") from exc

    klines = _parse_kline_rows(rows)
    return _build_envelope(
        payload={
            "data": {
                "code": symbol,
                "klines": [
                    f"{row['date']},{row['open']},{row['close']},{row['high']},{row['low']},{row['volume']}"
                    for row in klines
                ],
            }
        },
        dataset_key=f"emotion_index_series_secondary_{symbol}_{period}_{limit}",
        request_key=f"{SECONDARY_PROVIDER}:emotion_index_series:{symbol}:{period}:{limit}",
    )


async def _handle_index_amount_series(params: dict[str, Any]) -> dict[str, Any]:
    secid = str(params.get("secid", "")).strip()
    symbol = _symbol_from_secid(secid)
    period = int(params.get("period", 101))
    limit = int(params.get("limit", 12))
    frequency = MOOTDX_KLINE_FREQUENCY_MAP.get(period)
    if frequency is None:
        raise HTTPException(status_code=400, detail=f"mootdx 暂不支持 period={period}")

    client = await _load_mootdx_client()
    market = _market_for_symbol(symbol)

    def _run_index():
        return client.index(symbol=symbol, market=market, frequency=frequency, start=0, offset=limit)

    try:
        rows = await asyncio.to_thread(_run_index)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"mootdx 获取指数成交额序列失败: {exc}") from exc

    records = _records_from_rows(rows)
    klines: list[str] = []
    for item in records:
        date_value = _get_record_value(item, "datetime", "date", "day")
        if not date_value:
            continue
        open_value = _safe_float(_get_record_value(item, "open"))
        close_value = _safe_float(_get_record_value(item, "close"))
        high_value = _safe_float(_get_record_value(item, "high"))
        low_value = _safe_float(_get_record_value(item, "low"))
        volume_value = _safe_float(_get_record_value(item, "vol", "volume"))
        amount_value = _safe_float(_get_record_value(item, "amount"))
        klines.append(
            f"{str(date_value)[:10]},{open_value},{close_value},{high_value},{low_value},{volume_value},{amount_value}"
        )
    if not klines:
        raise HTTPException(status_code=502, detail="mootdx 未返回有效指数成交额序列")

    return _build_envelope(
        payload={"data": {"code": symbol, "klines": klines}},
        dataset_key=f"index_amount_series_secondary_{symbol}_{period}_{limit}",
        request_key=f"{SECONDARY_PROVIDER}:index_amount_series:{symbol}:{period}:{limit}",
    )


async def _handle_stock_quote_list(params: dict[str, Any], *, chinext_only: bool) -> dict[str, Any]:
    page = max(1, int(params.get("page", 1)))
    page_size = max(1, int(params.get("pageSize", 100)))
    client = await _load_mootdx_client()

    sh_rows, sz_rows = await asyncio.gather(
        _fetch_stock_catalog(client, 1),
        _fetch_stock_catalog(client, 0),
    )

    catalog = sorted([*sh_rows, *sz_rows], key=lambda item: item["symbol"])
    if chinext_only:
        catalog = [item for item in catalog if item["symbol"].startswith("300")]

    start = (page - 1) * page_size
    selected = catalog[start : start + page_size]
    quote_map = await _fetch_quote_map(client, [item["symbol"] for item in selected])
    industry = "创业板" if chinext_only else "A股"
    diff = [
        _normalize_quote_row(item["symbol"], item["name"], quote_map.get(item["symbol"]), industry=industry)
        for item in selected
    ]

    return _build_envelope(
        payload={"data": {"diff": diff}},
        dataset_key=f"{'chinext' if chinext_only else 'stock_list'}_secondary_{page}_{page_size}",
        request_key=f"{SECONDARY_PROVIDER}:{'chinext_list' if chinext_only else 'stock_list_page'}:{page}:{page_size}",
    )


SecondaryHandler = Callable[[dict[str, Any]], "asyncio.Future[dict[str, Any]]"] | Callable[[dict[str, Any]], dict[str, Any]]


SECONDARY_PROVIDER_REGISTRY: dict[str, dict[str, Any]] = {
    SECONDARY_PROVIDER: {
        "datasets": {
            "stock_kline": _handle_stock_kline,
            "index_kline": _handle_index_kline,
            "major_indexes": _handle_major_indexes,
            "stock_quote_list": _handle_stock_quote_list,
            "market_breadth": _handle_market_breadth_overview,
            "index_series": _handle_emotion_index_series,
        },
        "label": "Mootdx",
    }
}


async def execute_secondary_action(action: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    normalized_params = params or {}
    dataset = resolve_action_dataset(action, normalized_params)
    policy = get_eastmoney_provider_policy()
    provider = policy["secondaryProvider"]
    provider_config = SECONDARY_PROVIDER_REGISTRY.get(provider)
    if not provider_config or dataset not in provider_config["datasets"]:
        raise HTTPException(status_code=400, detail=f"第二数据源暂不支持 action: {action}")

    request_key = f"{provider}:{action}:{json.dumps(normalized_params, ensure_ascii=False, sort_keys=True)}"
    cached = await get_json_cache("secondary_action", request_key)
    if isinstance(cached, dict) and cached.get("data") is not None and cached.get("meta") is not None:
        return cached

    handler = provider_config["datasets"][dataset]
    async with SECONDARY_REQUEST_SEMAPHORE:
        if dataset == "stock_quote_list":
            result = await handler(normalized_params, chinext_only=action == "chinext_list")
        elif dataset == "market_breadth":
            if action == "full_market_rows":
                result = await _handle_full_market_rows(normalized_params)
            elif action == "full_market_pct_snapshot":
                result = await _handle_full_market_pct_snapshot(normalized_params)
            else:
                result = await handler(normalized_params)
        elif dataset == "index_series":
            if action == "index_amount_series":
                result = await _handle_index_amount_series(normalized_params)
            else:
                result = await handler(normalized_params)
        else:
            result = await handler(normalized_params)
    await set_json_cache("secondary_action", request_key, result, SECONDARY_CACHE_TTL_SECONDS)
    return result


async def probe_secondary_provider() -> dict[str, Any]:
    health = _default_health_state()
    provider = health["provider"]
    health["lastCheckedAt"] = _utcnow_iso()

    if not health["available"]:
        _write_health_snapshot(health)
        return health

    probes = {
        "index_kline": {"symbol": "000001", "period": 101, "limit": 5},
        "major_indexes": {},
        "stock_kline": {"symbol": "600036", "period": 101, "limit": 5},
        "stock_quote_list": {"page": 1, "pageSize": 5},
    }

    probe_results: dict[str, Any] = {}
    all_latencies: list[float] = []
    last_error: str | None = None

    for dataset, params in probes.items():
        if dataset not in SECONDARY_DATASET_METADATA:
            continue
        started_at = time.perf_counter()
        try:
            action = "major_indexes" if dataset == "major_indexes" else dataset
            result = await execute_secondary_action(action, params)
            latency_ms = (time.perf_counter() - started_at) * 1000
            all_latencies.append(latency_ms)
            sample_size = None
            payload = result.get("data", {}).get("data", {})
            if isinstance(payload, dict):
                if isinstance(payload.get("klines"), list):
                    sample_size = len(payload["klines"])
                elif isinstance(payload.get("diff"), list):
                    sample_size = len(payload["diff"])
            probe_results[dataset] = _build_probe_result(True, latency_ms, "探测成功", sample_size)
        except Exception as exc:
            latency_ms = (time.perf_counter() - started_at) * 1000
            last_error = str(exc)
            probe_results[dataset] = _build_probe_result(False, latency_ms, str(exc))

    successful_latencies = [item["latencyMs"] for item in probe_results.values() if item.get("ok")]
    if successful_latencies:
        health["lastSuccessAt"] = _utcnow_iso()
        health["lastLatencyMs"] = round(sum(float(v) for v in successful_latencies) / len(successful_latencies), 2)
        health["lastError"] = None
    else:
        health["lastError"] = last_error or "第二数据源探测失败"

    health["probeResults"] = probe_results
    _write_health_snapshot(health)
    return health


__all__ = [
    "SECONDARY_PROVIDER_REGISTRY",
    "execute_secondary_action",
    "get_secondary_provider_health",
    "probe_secondary_provider",
]
