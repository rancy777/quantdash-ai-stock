import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import httpx

from server.modules.screener_quote_data import resolve_tencent_symbol
from server.shared.cache import get_json_cache, set_json_cache
from server.shared import runtime


def resolve_sina_scale(period: int) -> int:
    if period in (1, 5, 15, 30, 60):
        return period
    if period in (101, 102, 103):
        return 240
    return 240


def resolve_sina_symbol(symbol: str) -> str:
    return f"sh{symbol}" if symbol.startswith("6") else f"sz{symbol}"


async def fetch_kline_from_sina(symbol: str, period: int = 101) -> List[Dict]:
    params = {
        "symbol": resolve_sina_symbol(symbol),
        "scale": resolve_sina_scale(period),
        "ma": "5,10,20,30,60",
        "datalen": 200,
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://finance.sina.com.cn/",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    response = await runtime.CLIENT.get(
        "https://quotes.sina.cn/cn/api/openapi.php/StockService.getKLineData",
        params=params,
        headers=headers,
    )
    response.raise_for_status()
    payload = response.json()
    result_block: Any = payload.get("result")
    if isinstance(result_block, list):
        result_block = result_block[0] if result_block else {}
    if not isinstance(result_block, dict):
        return []
    data_block: Any = result_block.get("data", {})
    if isinstance(data_block, list):
        data_block = data_block[0] if data_block else {}
    if not isinstance(data_block, dict):
        return []

    series: List[Dict[str, Any]] = []
    for item in data_block.get("kline") or []:
        day = item.get("day")
        if not day:
            continue
        try:
            series.append(
                {
                    "date": day,
                    "open": float(item.get("open", 0) or 0),
                    "close": float(item.get("close", 0) or 0),
                    "high": float(item.get("high", 0) or 0),
                    "low": float(item.get("low", 0) or 0),
                    "volume": float(item.get("volume", 0) or 0),
                }
            )
        except (TypeError, ValueError):
            continue
    return series


async def fetch_kline_from_tencent(symbol: str, period: int = 101) -> List[Dict]:
    tencent_symbol = resolve_tencent_symbol(symbol)
    limit = 240
    if period in (1, 5, 15, 30, 60):
        param = f"{tencent_symbol},m{period},{limit}"
        url = "https://ifzq.gtimg.cn/appstock/app/kline/mkline"
    else:
        param = f"{tencent_symbol},day,,{limit},qfq"
        url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://gu.qq.com/",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    response = await runtime.CLIENT.get(url, params={"param": param}, headers=headers)
    response.raise_for_status()
    payload = response.json()
    data = payload.get("data", {})
    if not isinstance(data, dict):
        return []

    target_raw: Any = data.get(tencent_symbol) or data.get(tencent_symbol.upper())
    target: Optional[Dict[str, Any]] = None
    if isinstance(target_raw, dict):
        target = target_raw
    elif isinstance(target_raw, list):
        target = next((candidate for candidate in target_raw if isinstance(candidate, dict)), None)
    if not target:
        return []

    kline_key = "m" if period in (1, 5, 15, 30, 60) else "day"
    kline = target.get(f"{kline_key}_hfq") or target.get(f"{kline_key}_fq") or target.get(kline_key) or []
    series: List[Dict[str, Any]] = []
    for item in kline:
        if isinstance(item, list) and len(item) >= 6:
            date_str = item[0]
            open_p, close_p, high_p, low_p, volume = item[1:6]
        elif isinstance(item, dict):
            date_str = item.get("date")
            open_p = item.get("open")
            close_p = item.get("close")
            high_p = item.get("high")
            low_p = item.get("low")
            volume = item.get("volume")
        else:
            continue
        if not date_str:
            continue
        try:
            series.append(
                {
                    "date": date_str,
                    "open": float(open_p or 0),
                    "close": float(close_p or 0),
                    "high": float(high_p or 0),
                    "low": float(low_p or 0),
                    "volume": float(volume or 0),
                }
            )
        except (TypeError, ValueError):
            continue
    return series


async def fetch_kline_from_eastmoney(symbol: str, period: int = 101) -> List[Dict]:
    try:
        secid = f"1.{symbol}" if symbol.startswith(("60", "5", "900")) else f"0.{symbol}"
        params = {
            "secid": secid,
            "fields1": "f1",
            "fields2": "f51,f52,f53,f54,f55,f57",
            "klt": period,
            "fqt": "1",
            "end": "20500101",
            "lmt": "260",
            "_": int(datetime.now().timestamp() * 1000),
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": "http://quote.eastmoney.com/",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        response = await runtime.CLIENT.get(
            "https://push2his.eastmoney.com/api/qt/stock/kline/get",
            params=params,
            headers=headers,
        )
        response.raise_for_status()
        payload = response.json()
        series: List[Dict[str, Any]] = []
        for entry in payload.get("data", {}).get("klines") or []:
            parts = entry.split(",")
            if len(parts) < 6:
                continue
            date_str, open_p, close_p, high_p, low_p, volume = parts[:6]
            try:
                series.append(
                    {
                        "date": date_str,
                        "open": float(open_p),
                        "close": float(close_p),
                        "high": float(high_p),
                        "low": float(low_p),
                        "volume": float(volume),
                    }
                )
            except ValueError:
                continue
        return series
    except httpx.ConnectTimeout:
        runtime.LOGGER.error("Eastmoney API connect timeout for %s", symbol)
        return []
    except httpx.HTTPError as exc:
        runtime.LOGGER.error("Eastmoney API HTTP error for %s: %s", symbol, exc)
        return []
    except Exception as exc:
        runtime.LOGGER.error("Eastmoney API error for %s: %s: %s", symbol, type(exc).__name__, exc)
        return []


def generate_mock_kline(symbol: str, days: int = 120) -> List[Dict]:
    import random

    series = []
    current_price = random.uniform(5, 50)
    for offset in range(days):
        date = (datetime.now() - timedelta(days=days - offset - 1)).strftime("%Y-%m-%d")
        change_pct = random.uniform(-5, 5) / 100
        open_price = current_price
        close_price = current_price * (1 + change_pct)
        high_price = max(open_price, close_price) * (1 + random.uniform(0, 2) / 100)
        low_price = min(open_price, close_price) * (1 - random.uniform(0, 2) / 100)
        volume = random.uniform(5_000_000, 50_000_000)
        series.append(
            {
                "date": date,
                "open": round(open_price, 2),
                "close": round(close_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "volume": round(volume),
            }
        )
        current_price = close_price
    runtime.LOGGER.debug("Generated mock kline data for %s, %s days", symbol, days)
    return series


async def fetch_kline(symbol: str, period: int = 101) -> List[Dict]:
    cache_key = f"{symbol}:{period}"
    cached = await get_json_cache("kline_series", cache_key)
    if isinstance(cached, list) and cached:
        return cached

    providers = [
        ("Eastmoney", fetch_kline_from_eastmoney),
        ("Sina", fetch_kline_from_sina),
        ("Tencent", fetch_kline_from_tencent),
    ]
    for name, provider in providers:
        for attempt in range(3):
            try:
                data = await provider(symbol, period)
                if data:
                    runtime.LOGGER.info("Successfully fetched kline from %s for %s", name, symbol)
                    await set_json_cache("kline_series", cache_key, data, 30)
                    return data
                runtime.LOGGER.warning("%s kline fetch returned empty for %s (attempt %s)", name, symbol, attempt + 1)
            except httpx.ConnectTimeout:
                runtime.LOGGER.warning("%s kline fetch timed out for %s (attempt %s)", name, symbol, attempt + 1)
                await asyncio.sleep(1)
            except Exception as exc:
                runtime.LOGGER.warning(
                    "%s kline fetch failed for %s (attempt %s): %s: %s",
                    name,
                    symbol,
                    attempt + 1,
                    type(exc).__name__,
                    exc,
                )
    runtime.LOGGER.error("All providers failed to fetch kline for %s, generating mock data", symbol)
    fallback = generate_mock_kline(symbol)
    await set_json_cache("kline_series", cache_key, fallback, 15)
    return fallback


def latest_trading_index(series: List[Dict]) -> int:
    if not series:
        return -1
    today = datetime.utcnow().strftime("%Y-%m-%d")
    for index in range(len(series) - 1, -1, -1):
        if series[index]["date"] <= today:
            return index
    return len(series) - 1


def pct_change(series: List[Dict], index: int) -> float:
    if index <= 0 or index >= len(series):
        return 0.0
    previous = series[index - 1]["close"]
    if previous == 0:
        return 0.0
    return ((series[index]["close"] - previous) / previous) * 100


def limit_up_threshold(symbol: str, name: Optional[str] = None) -> float:
    upper_name = (name or "").upper()
    if "ST" in upper_name:
        return 1.045
    if symbol.startswith(("30", "68")):
        return 1.195
    if symbol.startswith(("8", "4")):
        return 1.30
    return 1.095


def count_recent(flags: List[bool], window: int, end_idx: int) -> int:
    start = max(end_idx - window + 1, 0)
    return sum(1 for index in range(start, end_idx + 1) if flags[index])


def trading_days_between(series: List[Dict], start: int, end: int) -> int:
    if start >= end:
        return 0
    count = 0
    for index in range(start + 1, end + 1):
        if datetime.strptime(series[index]["date"], "%Y-%m-%d").weekday() < 5:
            count += 1
    return count


def simple_moving_average(series: List[Dict], index: int, window: int, key: str) -> Optional[float]:
    if index < 0 or window <= 0 or index - window + 1 < 0:
        return None
    total = 0.0
    for offset in range(window):
        total += float(series[index - offset].get(key, 0.0))
    return total / window


__all__ = [
    "count_recent",
    "fetch_kline",
    "fetch_kline_from_eastmoney",
    "fetch_kline_from_sina",
    "fetch_kline_from_tencent",
    "generate_mock_kline",
    "latest_trading_index",
    "limit_up_threshold",
    "pct_change",
    "resolve_sina_scale",
    "resolve_sina_symbol",
    "simple_moving_average",
    "trading_days_between",
]
