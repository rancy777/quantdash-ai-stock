import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Callable, Dict, Optional, TypeVar

import httpx

from data_paths import DATA_DIR, SYSTEM_DIR
from server.shared.api import setup_logging
from server.shared.cache import close_cache, init_cache


MODEL_PROXY_TIMEOUT_SECONDS = float(os.environ.get("MODEL_PROXY_TIMEOUT_SECONDS", "120"))
MODEL_PROXY_CONNECT_TIMEOUT_SECONDS = float(
    os.environ.get("MODEL_PROXY_CONNECT_TIMEOUT_SECONDS", "15")
)
HTTP_MAX_CONNECTIONS = int(os.environ.get("HTTP_MAX_CONNECTIONS", "80"))
HTTP_MAX_KEEPALIVE_CONNECTIONS = int(os.environ.get("HTTP_MAX_KEEPALIVE_CONNECTIONS", "20"))
HTTP_TIMEOUT = httpx.Timeout(
    MODEL_PROXY_TIMEOUT_SECONDS,
    connect=MODEL_PROXY_CONNECT_TIMEOUT_SECONDS,
)
HTTP_LIMITS = httpx.Limits(
    max_connections=HTTP_MAX_CONNECTIONS,
    max_keepalive_connections=HTTP_MAX_KEEPALIVE_CONNECTIONS,
)
CLIENT = httpx.AsyncClient(timeout=HTTP_TIMEOUT, limits=HTTP_LIMITS)
EASTMONEY_CLIENT = httpx.AsyncClient(timeout=HTTP_TIMEOUT, limits=HTTP_LIMITS, trust_env=False)
setup_logging()
LOGGER = logging.getLogger("quantdash.screener")
ROOT_DIR = Path(__file__).resolve().parents[3]
DATA_DIR.mkdir(parents=True, exist_ok=True)
SYSTEM_DIR.mkdir(parents=True, exist_ok=True)
AUTH_DB_PATH = SYSTEM_DIR / "auth.db"
IO_EXECUTOR = ThreadPoolExecutor(
    max_workers=max(4, int(os.environ.get("QUANTDASH_IO_WORKERS", "8"))),
    thread_name_prefix="quantdash-io",
)
SYNC_PROCESS: Optional[asyncio.subprocess.Process] = None
EASTMONEY_REFRESH_TASK: Optional[asyncio.Task[Any]] = None
SYNC_RUNTIME_STATE: Dict[str, Any] = {
    "state": "idle",
    "trigger": None,
    "mode": None,
    "startedAt": None,
    "finishedAt": None,
    "exitCode": None,
    "error": None,
    "pid": None,
}
EASTMONEY_REFRESH_STATE: Dict[str, Any] = {
    "state": "idle",
    "trigger": None,
    "startedAt": None,
    "finishedAt": None,
    "completed": 0,
    "failures": 0,
    "lastError": None,
    "scheduleEnabled": False,
    "intervalSeconds": None,
}
T = TypeVar("T")


async def run_blocking(func: Callable[..., T], *args, **kwargs) -> T:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(IO_EXECUTOR, lambda: func(*args, **kwargs))


@asynccontextmanager
async def lifespan(app):
    try:
        await init_cache()
        yield
    finally:
        await close_cache()
        IO_EXECUTOR.shutdown(wait=False, cancel_futures=True)
        await EASTMONEY_CLIENT.aclose()
        await CLIENT.aclose()
