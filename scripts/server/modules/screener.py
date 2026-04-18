import asyncio
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from server.models import StockPayload
from server.modules.auth import require_user
from server.modules.screener_market_data import (
    fetch_kline,
    fetch_realtime_quote,
    latest_trading_index,
    simple_moving_average,
)
from server.modules.screener_strategies import check_strategy, gather_candidates, inject_mock
from server.modules.screener_wencai import run_wencai_query


ROUTER = APIRouter(tags=["screener"])
SCREENER_CHECK_CONCURRENCY = 8
ALLOWED_STRATEGIES = {
    "chinext_2board_pullback",
    "limit_up_ma5_n_pattern",
    "limit_up_pullback",
    "limit_up_pullback_low_protect",
    "pywencai",
}


@ROUTER.get("/screener")
async def run_screener(
    strategy: str = Query("limit_up_pullback"),
    query: Optional[str] = Query(None, description="Optional question for pywencai strategy"),
    _current_user: Dict[str, Any] = Depends(require_user),
):
    if strategy not in ALLOWED_STRATEGIES:
        raise HTTPException(status_code=400, detail="不支持的选股策略")
    if query and len(query.strip()) > 200:
        raise HTTPException(status_code=400, detail="选股问题长度不能超过 200 个字符")

    if strategy == "pywencai":
        question = query or "今日主力净流入排名前50的股票"
        results = await run_wencai_query(question)
        return {
            "strategy": strategy,
            "question": question,
            "results": [stock.dict() for stock in results],
            "count": len(results),
        }

    try:
        candidates = await gather_candidates(strategy)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch candidates: {exc}") from exc

    if not candidates:
        return {"strategy": strategy, "results": inject_mock(strategy)}

    limit = 120 if strategy == "limit_up_pullback_low_protect" else 30
    semaphore = asyncio.Semaphore(SCREENER_CHECK_CONCURRENCY)

    async def _evaluate(stock: StockPayload) -> StockPayload | None:
        try:
            async with semaphore:
                matches = await check_strategy(stock.symbol, strategy, stock.name)
        except httpx.HTTPError:
            return None
        return stock if matches else None

    selected = [
        stock
        for stock in await asyncio.gather(*(_evaluate(stock) for stock in candidates[:limit]))
        if stock is not None
    ]

    if not selected:
        selected = inject_mock(strategy)

    return {
        "strategy": strategy,
        "results": [stock.dict() for stock in selected],
        "count": len(selected),
    }


__all__ = [
    "ROUTER",
    "run_screener",
    "fetch_kline",
    "fetch_realtime_quote",
    "latest_trading_index",
    "simple_moving_average",
]
