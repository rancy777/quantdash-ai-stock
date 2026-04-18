import json
from pathlib import Path
from typing import List

from fastapi import APIRouter

from server.models import ScreenerStrategyCatalogEntry, ScreenerStrategyCatalogResponse
from server.shared import runtime


ROUTER = APIRouter(tags=["screener"])
LOCAL_STRATEGY_PATH = runtime.SYSTEM_DIR / "screener_strategies.local.json"

PYWENCAI_ENTRY = ScreenerStrategyCatalogEntry(
    id="pywencai",
    name="pywencai一句话选股",
    desc="直接输入自然语言条件，让 pywencai 返回符合条件的股票列表，适合快速试错和盘前盘后临时筛选。",
    badge="问财",
    iconKey="search-check",
    tagText="pywencai结果",
    matcher=None,
)


def _load_local_catalog_entries() -> List[ScreenerStrategyCatalogEntry]:
    if not LOCAL_STRATEGY_PATH.exists():
        return []

    raw = json.loads(LOCAL_STRATEGY_PATH.read_text(encoding="utf-8"))
    entries = raw.get("entries") if isinstance(raw, dict) else raw
    if not isinstance(entries, list):
        return []

    parsed: List[ScreenerStrategyCatalogEntry] = []
    for item in entries:
        try:
            parsed.append(ScreenerStrategyCatalogEntry.model_validate(item))
        except Exception as exc:
            runtime.LOGGER.warning("Invalid local screener strategy entry skipped: %s", exc)
    return parsed


@ROUTER.get("/screener/strategies", response_model=ScreenerStrategyCatalogResponse)
async def get_screener_strategies() -> ScreenerStrategyCatalogResponse:
    return ScreenerStrategyCatalogResponse(entries=[PYWENCAI_ENTRY, *_load_local_catalog_entries()])
