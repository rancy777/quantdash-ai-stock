from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

REQUEST_ID_HEADER = "X-Request-ID"
LOGGER = logging.getLogger("quantdash.screener")


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        started_at = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            LOGGER.exception(
                "Unhandled request error path=%s method=%s request_id=%s",
                request.url.path,
                request.method,
                request_id,
            )
            raise

        elapsed_ms = (time.perf_counter() - started_at) * 1000
        LOGGER.info(
            "request method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


def _build_error_payload(detail: str, request: Request, *, errors=None):
    payload = {
        "detail": detail,
        "requestId": getattr(request.state, "request_id", None),
    }
    if errors is not None:
        payload["errors"] = errors
    return payload


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        simplified = [
            {
                "field": ".".join(str(part) for part in error["loc"] if part != "body"),
                "message": error["msg"],
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content=_build_error_payload("请求参数校验失败", request, errors=simplified),
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        if exc.status_code >= 500:
            LOGGER.warning(
                "http_exception status=%s path=%s request_id=%s detail=%s",
                exc.status_code,
                request.url.path,
                getattr(request.state, "request_id", None),
                exc.detail,
            )
        return JSONResponse(
            status_code=exc.status_code,
            content=_build_error_payload(str(exc.detail), request),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        LOGGER.exception(
            "internal_error path=%s request_id=%s error=%s",
            request.url.path,
            getattr(request.state, "request_id", None),
            exc,
        )
        return JSONResponse(
            status_code=500,
            content=_build_error_payload("服务器内部错误", request),
        )


def setup_logging() -> None:
    if logging.getLogger().handlers:
        return
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
