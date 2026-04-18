import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, Query

from server.models import MonitorCondition, MonitorSignal, WatchlistEntry
from server.modules.auth import (
    ensure_condition_defaults,
    get_user_watchlist,
    require_user,
    sanitize_watchlist_payload,
    save_user_watchlist,
)
from server.modules.screener import (
    fetch_kline,
    fetch_realtime_quote,
    latest_trading_index,
    simple_moving_average,
)
from server.shared import runtime


ROUTER = APIRouter(tags=["watchlist"])
WATCHLIST_SIGNAL_CONCURRENCY = 6


def evaluate_volume_ratio(
    series: List[Dict],
    index: int,
    condition: MonitorCondition,
    quote: Optional[Dict[str, float]] = None,
) -> MonitorSignal:
    condition = ensure_condition_defaults(condition)
    lookback = max(condition.lookbackDays or 5, 1)
    avg_volume = simple_moving_average(series, index, lookback, "volume")
    checked_at = datetime.utcnow().isoformat()
    quote_volume = (quote or {}).get("volume") or 0.0
    today_volume = quote_volume if quote_volume > 0 else series[index].get("volume", 0.0)
    if avg_volume is None or avg_volume <= 0:
        return MonitorSignal(
            conditionId=condition.id,
            conditionType=condition.type,
            triggered=False,
            checkedAt=checked_at,
            message="历史成交量数据不足",
            metrics={"todayVolume": today_volume},
        )
    target_ratio = condition.ratio or 2.0
    volume_threshold = avg_volume * target_ratio
    if condition.minVolume and condition.minVolume > 0:
        volume_threshold = max(volume_threshold, condition.minVolume)
    computed_ratio = today_volume / avg_volume if avg_volume else 0.0
    triggered = today_volume >= volume_threshold
    message = (
        f"成交量 {today_volume:.0f}，近{lookback}日均 {avg_volume:.0f}，"
        f"当前放大 {computed_ratio:.2f} 倍，要求 {target_ratio:.2f} 倍"
    )
    if condition.minVolume:
        message += f"，最低 {condition.minVolume:.0f}"
    return MonitorSignal(
        conditionId=condition.id,
        conditionType=condition.type,
        triggered=triggered,
        checkedAt=checked_at,
        message=message,
        metrics={
            "todayVolume": today_volume,
            "averageVolume": avg_volume,
            "requiredRatio": target_ratio,
            "computedRatio": computed_ratio,
            "thresholdVolume": volume_threshold,
        },
    )


def evaluate_price_touch_ma(
    series: List[Dict],
    index: int,
    condition: MonitorCondition,
    quote: Optional[Dict[str, float]] = None,
) -> MonitorSignal:
    condition = ensure_condition_defaults(condition)
    window = condition.maWindow or 5
    tolerance = condition.tolerancePct or 0.003
    checked_at = datetime.utcnow().isoformat()
    ma_value = simple_moving_average(series, index, window, "close")
    quote_price = (quote or {}).get("price") or 0.0
    price = quote_price if quote_price > 0 else series[index].get("close", 0.0)
    if ma_value is None or ma_value <= 0:
        return MonitorSignal(
            conditionId=condition.id,
            conditionType=condition.type,
            triggered=False,
            checkedAt=checked_at,
            message="历史收盘价数据不足，无法计算均线",
            metrics={"close": price, "maWindow": window},
        )
    distance_pct = abs(price - ma_value) / ma_value if ma_value else 0.0
    triggered = distance_pct <= tolerance
    message = (
        f"收盘 {price:.2f}，{window} 日均线 {ma_value:.2f}，偏离 {distance_pct * 100:.2f}%，"
        f"容差 {tolerance * 100:.2f}%"
    )
    return MonitorSignal(
        conditionId=condition.id,
        conditionType=condition.type,
        triggered=triggered,
        checkedAt=checked_at,
        message=message,
        metrics={
            "close": price,
            "movingAverage": ma_value,
            "distancePct": distance_pct,
            "tolerancePct": tolerance,
            "maWindow": window,
        },
    )


def evaluate_monitor_condition(
    series: List[Dict],
    index: int,
    condition: MonitorCondition,
    quote: Optional[Dict[str, float]] = None,
) -> Optional[MonitorSignal]:
    if condition.type == "volume_ratio":
        return evaluate_volume_ratio(series, index, condition, quote)
    if condition.type == "price_touch_ma":
        return evaluate_price_touch_ma(series, index, condition, quote)
    return None


async def compute_monitor_signals(entry: WatchlistEntry) -> List[MonitorSignal]:
    if not entry.monitorConditions:
        return []
    series = await fetch_kline(entry.symbol)
    idx = latest_trading_index(series)
    if idx < 0:
        return []
    quote: Optional[Dict[str, float]] = None
    try:
        quote = await fetch_realtime_quote(entry.symbol)
    except httpx.HTTPError as exc:
        runtime.LOGGER.warning("Failed to fetch realtime quote for %s: %s", entry.symbol, exc)
    signals: List[MonitorSignal] = []
    for condition in entry.monitorConditions:
        if not condition.enabled:
            continue
        signal = evaluate_monitor_condition(series, idx, condition, quote)
        if signal:
            signals.append(signal)
    return signals


async def attach_monitor_signals(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    semaphore = asyncio.Semaphore(WATCHLIST_SIGNAL_CONCURRENCY)

    async def _annotate(raw: Dict[str, Any]) -> Dict[str, Any]:
        entry = WatchlistEntry(**raw)
        entry.monitorSignals = []
        if not entry.monitorConditions:
            return entry.dict()
        try:
            async with semaphore:
                entry.monitorSignals = await compute_monitor_signals(entry)
        except httpx.HTTPError as exc:
            runtime.LOGGER.warning("Failed to compute monitor signals for %s: %s", entry.symbol, exc)
        return entry.dict()

    return await asyncio.gather(*(_annotate(raw) for raw in items))


@ROUTER.get("/watchlist")
async def fetch_watchlist(
    includeSignals: bool = Query(False, description="是否返回监控条件实时状态"),
    current_user: Dict[str, Any] = Depends(require_user),
):
    data = await runtime.run_blocking(get_user_watchlist, current_user["id"])
    if includeSignals:
        return await attach_monitor_signals(data)
    return data


@ROUTER.put("/watchlist")
async def update_watchlist(
    items: List[WatchlistEntry],
    current_user: Dict[str, Any] = Depends(require_user),
):
    serialized = sanitize_watchlist_payload(items)
    await runtime.run_blocking(save_user_watchlist, current_user["id"], serialized)
    return {"status": "ok", "count": len(serialized)}
