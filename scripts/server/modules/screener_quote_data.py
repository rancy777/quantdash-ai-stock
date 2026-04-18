from typing import Dict, Optional

from server.shared.cache import get_json_cache, set_json_cache
from server.shared import runtime


def resolve_tencent_symbol(symbol: str) -> str:
    return f"sh{symbol}" if symbol.startswith("6") else f"sz{symbol}"


async def fetch_realtime_quote(symbol: str) -> Optional[Dict[str, float]]:
    cached = await get_json_cache("realtime_quote", symbol)
    if isinstance(cached, dict):
        return cached

    tencent_symbol = resolve_tencent_symbol(symbol)
    url = f"http://qt.gtimg.cn/q={tencent_symbol}"
    headers = {
        "Referer": "http://qt.gtimg.cn",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    last_error: Exception | None = None
    body = ""
    for attempt in range(3):
        try:
            response = await runtime.CLIENT.get(url, headers=headers, timeout=5)
            response.raise_for_status()
            body = response.text.strip()
            break
        except Exception as exc:
            last_error = exc
            if attempt == 2:
                raise
    if last_error and not body:
        raise last_error
    if "=" not in body:
        return None

    _, _, payload = body.partition("=")
    payload = payload.strip().strip(";")
    if payload.startswith('"') and payload.endswith('"'):
        payload = payload[1:-1]
    if not payload:
        return None

    fields = payload.split("~")
    if len(fields) < 33:
        return None

    try:
        current_price = float(fields[3] or 0)
        prev_close = float(fields[4] or 0)
        open_price = float(fields[5] or 0)
        high_price = float(fields[33] or 0) if len(fields) > 33 else current_price
        low_price = float(fields[34] or 0) if len(fields) > 34 else current_price
        volume = float(fields[6] or 0) * 100 if fields[6] else 0.0
        turnover = float(fields[37] or 0) if len(fields) > 37 else 0.0
        payload = {
            "open": open_price,
            "prev_close": prev_close,
            "price": current_price,
            "high": high_price,
            "low": low_price,
            "volume": volume,
            "turnover": turnover,
        }
        await set_json_cache("realtime_quote", symbol, payload, 8)
        return payload
    except (ValueError, IndexError):
        return None


__all__ = ["fetch_realtime_quote", "resolve_tencent_symbol"]
