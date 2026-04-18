import asyncio
import os
from datetime import datetime
from typing import Any, Dict, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from server.modules.auth import require_user
from server.models import SyncTriggerResponse
from server.shared.cache import get_cache_backend_status
from server.shared import runtime


ROUTER = APIRouter(tags=["system"])


def get_sync_runtime_state() -> Dict[str, Any]:
    return dict(runtime.SYNC_RUNTIME_STATE)


async def _watch_sync_process(process: asyncio.subprocess.Process) -> None:
    try:
        await process.wait()
        runtime.SYNC_RUNTIME_STATE["state"] = "idle"
        runtime.SYNC_RUNTIME_STATE["finishedAt"] = datetime.utcnow().isoformat()
        runtime.SYNC_RUNTIME_STATE["exitCode"] = process.returncode
        runtime.SYNC_RUNTIME_STATE["error"] = (
            None if process.returncode == 0 else f"process exited with code {process.returncode}"
        )
        runtime.SYNC_RUNTIME_STATE["pid"] = None
    except Exception as exc:
        runtime.SYNC_RUNTIME_STATE["state"] = "idle"
        runtime.SYNC_RUNTIME_STATE["finishedAt"] = datetime.utcnow().isoformat()
        runtime.SYNC_RUNTIME_STATE["exitCode"] = -1
        runtime.SYNC_RUNTIME_STATE["error"] = str(exc)
        runtime.SYNC_RUNTIME_STATE["pid"] = None
    finally:
        runtime.SYNC_PROCESS = None


async def launch_startup_sync(mode: str = "startup") -> Dict[str, Any]:
    if runtime.SYNC_PROCESS and runtime.SYNC_PROCESS.returncode is None:
        raise HTTPException(status_code=409, detail="已有同步任务正在执行")

    env = os.environ.copy()
    env["STARTUP_AUTO_SYNC"] = "1"
    env["STARTUP_SYNC_MODE"] = mode
    process = await asyncio.create_subprocess_exec(
        "node",
        str(runtime.ROOT_DIR / "scripts" / "ensureStartupData.js"),
        cwd=str(runtime.ROOT_DIR),
        env=env,
    )
    runtime.SYNC_PROCESS = process
    runtime.SYNC_RUNTIME_STATE["state"] = "running"
    runtime.SYNC_RUNTIME_STATE["trigger"] = "startup-sync"
    runtime.SYNC_RUNTIME_STATE["mode"] = mode
    runtime.SYNC_RUNTIME_STATE["startedAt"] = datetime.utcnow().isoformat()
    runtime.SYNC_RUNTIME_STATE["finishedAt"] = None
    runtime.SYNC_RUNTIME_STATE["exitCode"] = None
    runtime.SYNC_RUNTIME_STATE["error"] = None
    runtime.SYNC_RUNTIME_STATE["pid"] = process.pid
    asyncio.create_task(_watch_sync_process(process))
    return get_sync_runtime_state()


@ROUTER.get("/health")
async def health():
    return {
        "cache": get_cache_backend_status(),
        "status": "ok",
    }


@ROUTER.get("/sync/runtime-status")
async def sync_runtime_status(_current_user: Dict[str, Any] = Depends(require_user)):
    return get_sync_runtime_state()


@ROUTER.post("/sync/startup-check", response_model=SyncTriggerResponse)
async def trigger_startup_sync(
    mode: Literal["startup", "market", "offline"] = Query("startup"),
    _current_user: Dict[str, Any] = Depends(require_user),
):
    state = await launch_startup_sync(mode)
    return SyncTriggerResponse(
        status=state["state"],
        trigger=state["trigger"],
        mode=state["mode"],
        startedAt=state["startedAt"],
        pid=state["pid"],
    )
