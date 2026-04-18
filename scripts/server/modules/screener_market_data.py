import asyncio
from datetime import datetime
from typing import Dict, List

from server.models import StockPayload
from server.shared.cache import get_json_cache, set_json_cache
from server.modules.screener_kline_data import (
    count_recent,
    fetch_kline,
    latest_trading_index,
    limit_up_threshold,
    pct_change,
    simple_moving_average,
    trading_days_between,
)
from server.modules.screener_quote_data import fetch_realtime_quote
from server.shared import runtime


def build_stock_list_url(page: int, page_size: int) -> str:
    timestamp = int(datetime.utcnow().timestamp() * 1000)
    return (
        "https://push2.eastmoney.com/api/qt/clist/get"
        f"?pn={page}&pz={page_size}&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
        f"&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20,f100&_={timestamp}"
    )


async def fetch_json(url: str) -> Dict:
    cached = await get_json_cache("screener_json", url)
    if isinstance(cached, dict):
        return cached

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://eastmoney.com/",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = await runtime.CLIENT.get(url, headers=headers, timeout=8)
            runtime.LOGGER.debug("Fetching JSON from %s, status code: %s", url, response.status_code)
            response.raise_for_status()
            payload = response.json()
            await set_json_cache("screener_json", url, payload, 20)
            return payload
        except Exception as exc:
            last_error = exc
            if attempt < 2:
                await asyncio.sleep(0.2 * (attempt + 1))
    raise last_error or RuntimeError("fetch_json failed")


def map_stock_payload(item: Dict) -> StockPayload:
    def safe_float(value, default=0.0):
        if value == "-" or value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def safe_list(value) -> List[str]:
        if isinstance(value, list):
            return value
        return [value] if isinstance(value, str) and value else []

    volume = "-"
    turnover = "-"
    volume_value = safe_float(item.get("f5"))
    turnover_value = safe_float(item.get("f6"))
    if volume_value:
        volume = f"{volume_value / 10000:.1f}万"
    if turnover_value:
        turnover = f"{turnover_value / 1e8:.2f}亿"

    industry = item.get("f100", "") or "市场热点"
    return StockPayload(
        symbol=str(item.get("f12")),
        name=item.get("f14", ""),
        price=safe_float(item.get("f2")),
        pctChange=safe_float(item.get("f3")),
        volume=volume,
        turnover=turnover,
        industry=industry,
        concepts=safe_list(industry),
        pe=safe_float(item.get("f9")),
        pb=safe_float(item.get("f23")),
        marketCap=safe_float(item.get("f20")) / 1e8 if safe_float(item.get("f20")) else 0.0,
    )


async def fetch_stock_list(limit_pages: int = 1, page_size: int = 100) -> List[StockPayload]:
    stocks: List[StockPayload] = []
    for page in range(1, limit_pages + 1):
        data = await fetch_json(build_stock_list_url(page, page_size))
        diff = data.get("data", {}).get("diff") or []
        stocks.extend(map_stock_payload(item) for item in diff)
        if len(diff) < page_size:
            break
    return stocks


async def fetch_chinext_list() -> List[StockPayload]:
    url = (
        "https://push2.eastmoney.com/api/qt/clist/get"
        "?pn=1&pz=80&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        "&fs=m:0+t:80"
        "&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20"
    )
    data = await fetch_json(url)
    diff = data.get("data", {}).get("diff") or []
    return [
        StockPayload(
            symbol=str(item.get("f12")),
            name=item.get("f14", ""),
            price=float(item.get("f2") or 0),
            pctChange=float(item.get("f3") or 0),
            volume=f"{(item.get('f5') or 0) / 10000:.1f}万",
            turnover=f"{(item.get('f6') or 0) / 1e8:.2f}亿",
            industry="创业板",
            concepts=["成长", "热门"],
            pe=float(item.get("f9") or 0),
            pb=float(item.get("f23") or 0),
            marketCap=float(item.get("f20") or 0) / 1e8,
        )
        for item in diff
    ]


async def fetch_full_market_list() -> List[StockPayload]:
    stocks: List[StockPayload] = []
    for page in range(1, 31):
        data = await fetch_json(build_stock_list_url(page, 400))
        diff = data.get("data", {}).get("diff") or []
        stocks.extend(map_stock_payload(item) for item in diff)
        if len(diff) < 400:
            break
    return stocks


__all__ = [
    "build_stock_list_url",
    "count_recent",
    "fetch_chinext_list",
    "fetch_full_market_list",
    "fetch_json",
    "fetch_kline",
    "fetch_realtime_quote",
    "fetch_stock_list",
    "latest_trading_index",
    "limit_up_threshold",
    "map_stock_payload",
    "pct_change",
    "simple_moving_average",
    "trading_days_between",
]
