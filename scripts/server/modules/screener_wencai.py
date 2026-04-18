import asyncio
from typing import Any, Dict, List

from fastapi import HTTPException

from server.models import StockPayload
from server.modules.integrations import load_pywencai_cookie
from server.shared.cache import get_json_cache, set_json_cache
from server.shared import runtime

try:
    import pywencai  # type: ignore
except ImportError:
    pywencai = None


def _pick(row: Dict[str, Any], *keys: str, default=None):
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
    return default


async def run_wencai_query(question: str) -> List[StockPayload]:
    normalized_question = str(question or "").strip()
    if len(normalized_question) < 2 or len(normalized_question) > 200:
        raise HTTPException(status_code=400, detail="问财查询长度必须在 2-200 个字符之间")

    cached = await get_json_cache("pywencai_query", normalized_question)
    if isinstance(cached, list):
        return [StockPayload(**item) for item in cached if isinstance(item, dict)]

    if pywencai is None:
        raise HTTPException(status_code=503, detail="pywencai is not installed in this environment")

    cookie = load_pywencai_cookie()
    if not cookie:
        raise HTTPException(
            status_code=503,
            detail="未配置 PYWENCAI_COOKIE，请先在 .env.local 中填写后再使用 pywencai 选股。",
        )

    def _query():
        return pywencai.get(query=normalized_question, loop=True, cookie=cookie)

    try:
        result = await asyncio.to_thread(_query)
    except Exception as exc:
        runtime.LOGGER.exception("PyWenCai query failed: %s", normalized_question)
        raise HTTPException(status_code=502, detail="PyWenCai 查询失败，请稍后重试") from exc

    rows: List[Dict[str, Any]] = []
    if result is None:
        rows = []
    elif hasattr(result, "to_dict"):
        rows = result.to_dict(orient="records")
    elif isinstance(result, list):
        rows = result

    stocks: List[StockPayload] = []
    for row in rows:
        symbol = str(_pick(row, "股票代码", "code", "证券代码", default="")).strip()
        name = str(_pick(row, "股票简称", "name", "证券简称", default="")).strip()
        if not symbol or not name:
            continue
        price = float(_pick(row, "最新价", "price", "现价", default=0) or 0)
        pct = float(_pick(row, "涨跌幅", "涨幅", "pct_change", default=0) or 0)
        volume = _pick(row, "成交量", "量", default="-") or "-"
        turnover = _pick(row, "成交额", "额", default="-") or "-"
        industry = _pick(row, "所属行业", "行业", default="问财结果") or "问财结果"
        concepts = _pick(row, "概念", "题材", default=[]) or []
        if isinstance(concepts, str):
            concepts = [concepts]
        elif not isinstance(concepts, list):
            concepts = []

        stocks.append(
            StockPayload(
                symbol=symbol,
                name=name,
                price=price,
                pctChange=pct,
                volume=str(volume),
                turnover=str(turnover),
                industry=str(industry),
                concepts=concepts,
                pe=0.0,
                pb=0.0,
                marketCap=0.0,
            )
        )

    result = stocks[:60]
    await set_json_cache(
        "pywencai_query",
        normalized_question,
        [item.model_dump() for item in result],
        ttl_seconds=20,
    )
    return result
