from __future__ import annotations

import asyncio
import contextlib
import os
from datetime import date, datetime
from typing import Any

from server.modules.eastmoney_actions import execute_eastmoney_action
from server.shared import runtime


REFRESH_INTERVAL_SECONDS = max(300, int(os.environ.get("EASTMONEY_REFRESH_INTERVAL_SECONDS", "1800")))
ENABLE_SCHEDULED_REFRESH = os.environ.get("EASTMONEY_ENABLE_SCHEDULED_REFRESH", "1") != "0"
REFRESH_ACTIONS = [
    ("major_indexes", {}, 5000),
    ("stock_list_page", {"page": 1, "pageSize": 100}, 6000),
    ("chinext_list", {"pageSize": 50}, 6000),
    ("market_breadth_overview", {}, 5000),
    ("full_market_pct_snapshot", {}, 7000),
    ("limit_up_pool", {}, 7000),
    ("broken_pool", {}, 7000),
    ("limit_down_pool", {}, 7000),
    ("sector_board_list", {"boardType": "concept"}, 6000),
    ("sector_board_list", {"boardType": "industry"}, 6000),
    ("index_amount_series", {"secid": "1.000001", "limit": 12}, 6000),
    ("index_amount_series", {"secid": "0.399001", "limit": 12}, 6000),
]


def _set_refresh_state(**kwargs: Any) -> None:
    runtime.EASTMONEY_REFRESH_STATE.update(kwargs)


def get_eastmoney_refresh_state() -> dict[str, Any]:
    return dict(runtime.EASTMONEY_REFRESH_STATE)


async def warm_eastmoney_datasets(trigger: str = "manual") -> dict[str, Any]:
    today = date.today().strftime("%Y-%m-%d")
    _set_refresh_state(
        state="running",
        trigger=trigger,
        startedAt=datetime.utcnow().isoformat(),
        finishedAt=None,
        lastError=None,
    )

    completed = 0
    failures = 0
    last_error: str | None = None

    for action, params, timeout_ms in REFRESH_ACTIONS:
        try:
            dynamic_params = dict(params)
            if action in {"limit_up_pool", "broken_pool", "limit_down_pool"}:
                dynamic_params.setdefault("date", today)
            await execute_eastmoney_action(
                action,
                dynamic_params,
                timeout_ms=timeout_ms,
                prefer_snapshot=False,
                force_refresh=True,
            )
            completed += 1
        except Exception as exc:
            failures += 1
            last_error = str(exc)
            runtime.LOGGER.warning("EastMoney refresh action %s failed: %s", action, exc)

    _set_refresh_state(
        state="idle",
        finishedAt=datetime.utcnow().isoformat(),
        completed=completed,
        failures=failures,
        lastError=last_error,
    )
    return get_eastmoney_refresh_state()


async def _scheduled_refresh_loop() -> None:
    while True:
        try:
            await warm_eastmoney_datasets(trigger="scheduled")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            _set_refresh_state(
                state="idle",
                finishedAt=datetime.utcnow().isoformat(),
                lastError=str(exc),
            )
            runtime.LOGGER.warning("EastMoney scheduled refresh failed: %s", exc)
        await asyncio.sleep(REFRESH_INTERVAL_SECONDS)


async def start_eastmoney_refresh_scheduler() -> None:
    if not ENABLE_SCHEDULED_REFRESH:
        _set_refresh_state(scheduleEnabled=False)
        return

    if runtime.EASTMONEY_REFRESH_TASK and not runtime.EASTMONEY_REFRESH_TASK.done():
        return

    _set_refresh_state(scheduleEnabled=True, intervalSeconds=REFRESH_INTERVAL_SECONDS)
    runtime.EASTMONEY_REFRESH_TASK = asyncio.create_task(_scheduled_refresh_loop())


async def stop_eastmoney_refresh_scheduler() -> None:
    task = runtime.EASTMONEY_REFRESH_TASK
    if not task:
        return

    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    runtime.EASTMONEY_REFRESH_TASK = None


__all__ = [
    "get_eastmoney_refresh_state",
    "start_eastmoney_refresh_scheduler",
    "stop_eastmoney_refresh_scheduler",
    "warm_eastmoney_datasets",
]
