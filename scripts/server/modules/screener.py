from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from server.modules.auth import require_user
from server.modules.screener_market_data import (
    fetch_kline,
    fetch_realtime_quote,
    latest_trading_index,
    simple_moving_average,
)
from server.modules.screener_wencai import run_wencai_query


ROUTER = APIRouter(tags=["screener"])
ALLOWED_STRATEGIES = {"pywencai"}


@ROUTER.get("/screener")
async def run_screener(
    strategy: str = Query("pywencai"),
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
    raise HTTPException(status_code=400, detail="不支持的选股策略")


__all__ = [
    "ROUTER",
    "run_screener",
    "fetch_kline",
    "fetch_realtime_quote",
    "latest_trading_index",
    "simple_moving_average",
]
