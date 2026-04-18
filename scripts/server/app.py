from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.modules.auth import ROUTER as AUTH_ROUTER
from server.modules.eastmoney import ROUTER as EASTMONEY_ROUTER
from server.modules.eastmoney_refresh import (
    start_eastmoney_refresh_scheduler,
    stop_eastmoney_refresh_scheduler,
)
from server.modules.github_updates import (
    ROUTER as GITHUB_UPDATES_ROUTER,
    warm_github_update_check_on_startup,
)
from server.modules.integrations import ROUTER as INTEGRATIONS_ROUTER
from server.modules.screener import ROUTER as SCREENER_ROUTER
from server.modules.sync_runtime import ROUTER as SYNC_ROUTER
from server.modules.watchlist import ROUTER as WATCHLIST_ROUTER
from server.shared.api import RequestContextMiddleware, register_exception_handlers
from server.shared import runtime


@asynccontextmanager
async def app_lifespan(app: FastAPI):
    async with runtime.lifespan(app):
        await start_eastmoney_refresh_scheduler()
        await warm_github_update_check_on_startup()
        try:
            yield
        finally:
            await stop_eastmoney_refresh_scheduler()


APP = FastAPI(title="QuantDash Screener Service", lifespan=app_lifespan)
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)
APP.add_middleware(RequestContextMiddleware)
register_exception_handlers(APP)
APP.include_router(SYNC_ROUTER)
APP.include_router(INTEGRATIONS_ROUTER)
APP.include_router(EASTMONEY_ROUTER)
APP.include_router(GITHUB_UPDATES_ROUTER)
APP.include_router(AUTH_ROUTER)
APP.include_router(WATCHLIST_ROUTER)
APP.include_router(SCREENER_ROUTER)
