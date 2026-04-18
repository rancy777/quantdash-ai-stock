from __future__ import annotations

import asyncio
import hashlib
import json
import random
import re
import time
from datetime import datetime
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from fastapi import HTTPException

from server.shared.cache import get_cache_backend_status, get_json_cache, set_json_cache
from server.shared import runtime


ALLOWED_EASTMONEY_HOSTS = {
    "push2.eastmoney.com",
    "push2ex.eastmoney.com",
    "push2his.eastmoney.com",
    "datacenter-web.eastmoney.com",
}
DEFAULT_HEADERS = {
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": "https://quote.eastmoney.com/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
}
EASTMONEY_CACHE_TTL_SECONDS = 8
EASTMONEY_FAILURE_COOLDOWN_SECONDS = 20
EASTMONEY_MAX_CONCURRENCY = 4
EASTMONEY_MIN_INTERVAL_SECONDS = 0.35
EASTMONEY_INTERVAL_JITTER_MIN_SECONDS = 0.03
EASTMONEY_INTERVAL_JITTER_MAX_SECONDS = 0.12
EASTMONEY_RETRY_ATTEMPTS = 2
EASTMONEY_RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
EASTMONEY_SNAPSHOT_MAX_AGE_SECONDS = 12 * 60 * 60
EASTMONEY_REQUEST_SEMAPHORE = asyncio.Semaphore(EASTMONEY_MAX_CONCURRENCY)
EASTMONEY_PACE_LOCK = asyncio.Lock()
RESPONSE_CACHE: dict[str, dict[str, Any]] = {}
FAILURE_COOLDOWNS: dict[str, float] = {}
IN_FLIGHT_REQUESTS: dict[str, "asyncio.Task[dict[str, Any]]"] = {}
LAST_OUTBOUND_REQUEST_AT = 0.0
SNAPSHOT_DIR = runtime.SYSTEM_DIR / "eastmoney_snapshots"
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
MONITOR_STATE = {
    "requests": 0,
    "liveSuccesses": 0,
    "cacheHits": 0,
    "snapshotHits": 0,
    "failures": 0,
    "lastSuccessAt": None,
    "lastError": None,
    "lastErrorAt": None,
    "datasets": {},
}


def _validate_eastmoney_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="仅支持完整的东方财富 HTTP(S) 地址。")

    hostname = (parsed.hostname or "").lower()
    if hostname not in ALLOWED_EASTMONEY_HOSTS:
        raise HTTPException(status_code=400, detail=f"不允许代理的东方财富域名: {hostname or 'unknown'}")

    return parsed.geturl()


def _normalize_cache_key(url: str) -> str:
    parsed = urlparse(url)
    query_pairs = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "_":
            continue
        if key == "cb":
            query_pairs.append((key, ":dynamic"))
            continue
        query_pairs.append((key, value))
    normalized_query = urlencode(sorted(query_pairs))
    return urlunparse(parsed._replace(query=normalized_query))


def _build_timeout(timeout_ms: int) -> httpx.Timeout:
    bounded_timeout_ms = max(1000, min(timeout_ms, 20000))
    total_seconds = bounded_timeout_ms / 1000
    connect_seconds = min(8.0, max(1.0, total_seconds / 2))
    return httpx.Timeout(total_seconds, connect=connect_seconds)


async def _apply_request_pacing() -> None:
    global LAST_OUTBOUND_REQUEST_AT

    async with EASTMONEY_PACE_LOCK:
        now = time.monotonic()
        jitter = random.uniform(
            EASTMONEY_INTERVAL_JITTER_MIN_SECONDS,
            EASTMONEY_INTERVAL_JITTER_MAX_SECONDS,
        )
        wait_seconds = (LAST_OUTBOUND_REQUEST_AT + EASTMONEY_MIN_INTERVAL_SECONDS + jitter) - now
        if wait_seconds > 0:
            await asyncio.sleep(wait_seconds)
        LAST_OUTBOUND_REQUEST_AT = time.monotonic()


def _sanitize_snapshot_name(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_").lower()
    if not sanitized:
        sanitized = "eastmoney_snapshot"
    if len(sanitized) > 96:
        digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]
        sanitized = f"{sanitized[:80]}_{digest}"
    return sanitized


def _snapshot_path(snapshot_key: str):
    return SNAPSHOT_DIR / f"{_sanitize_snapshot_name(snapshot_key)}.json"


def _load_snapshot_envelope(snapshot_key: str) -> dict[str, Any] | None:
    snapshot_path = _snapshot_path(snapshot_key)
    if not snapshot_path.exists():
        return None

    try:
        envelope = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        runtime.LOGGER.warning("Failed to read EastMoney snapshot %s: %s", snapshot_path.name, exc)
        return None

    saved_at = float(envelope.get("savedAt", 0) or 0)
    if saved_at <= 0:
        return None
    if time.time() - saved_at > EASTMONEY_SNAPSHOT_MAX_AGE_SECONDS:
        return None
    return envelope


def _save_snapshot_payload(snapshot_key: str, request_key: str, url: str, payload: Any) -> str | None:
    snapshot_path = _snapshot_path(snapshot_key)
    saved_at = time.time()
    envelope = {
        "snapshotKey": snapshot_key,
        "requestKey": request_key,
        "savedAt": saved_at,
        "updatedAt": datetime.utcfromtimestamp(saved_at).isoformat(),
        "url": url,
        "payload": payload,
    }
    try:
        snapshot_path.write_text(json.dumps(envelope, ensure_ascii=False), encoding="utf-8")
        return envelope["updatedAt"]
    except OSError as exc:
        runtime.LOGGER.warning("Failed to write EastMoney snapshot %s: %s", snapshot_path.name, exc)
        return None


def _update_dataset_monitor(dataset_key: str, **fields: Any) -> None:
    datasets = MONITOR_STATE.setdefault("datasets", {})
    current = datasets.get(dataset_key, {})
    current.update(fields)
    datasets[dataset_key] = current


def _note_success(dataset_key: str, source: str, updated_at: str | None) -> None:
    MONITOR_STATE["lastSuccessAt"] = datetime.utcnow().isoformat()
    if source == "live":
        MONITOR_STATE["liveSuccesses"] += 1
    elif source == "cache":
        MONITOR_STATE["cacheHits"] += 1
    elif source == "snapshot":
        MONITOR_STATE["snapshotHits"] += 1
    _update_dataset_monitor(dataset_key, lastSource=source, updatedAt=updated_at, lastError=None)


def _note_failure(dataset_key: str, error: str) -> None:
    MONITOR_STATE["failures"] += 1
    MONITOR_STATE["lastError"] = error
    MONITOR_STATE["lastErrorAt"] = datetime.utcnow().isoformat()
    _update_dataset_monitor(dataset_key, lastError=error, lastErrorAt=MONITOR_STATE["lastErrorAt"])


def _make_envelope(
    *,
    payload: Any,
    dataset_key: str,
    request_key: str,
    source: str,
    updated_at: str | None,
    provider: str = "eastmoney",
    is_snapshot_fallback: bool = False,
    is_cached: bool = False,
) -> dict[str, Any]:
    return {
        "data": payload,
        "meta": {
            "datasetKey": dataset_key,
            "provider": provider,
            "requestKey": request_key,
            "source": source,
            "updatedAt": updated_at,
            "isSnapshotFallback": is_snapshot_fallback,
            "isCached": is_cached,
        },
    }


def get_eastmoney_monitor_status() -> dict[str, Any]:
    return {
        **MONITOR_STATE,
        "cacheBackend": get_cache_backend_status(),
        "cacheEntries": len(RESPONSE_CACHE),
        "cooldownEntries": len(FAILURE_COOLDOWNS),
        "inFlightEntries": len(IN_FLIGHT_REQUESTS),
    }


async def fetch_eastmoney_json(
    url: str,
    timeout_ms: int = 8000,
    *,
    dataset_key: str | None = None,
    prefer_snapshot: bool = False,
    force_refresh: bool = False,
) -> dict[str, Any]:
    target_url = _validate_eastmoney_url(url)
    request_key = _normalize_cache_key(target_url)
    dataset_key = dataset_key or request_key
    timeout = _build_timeout(timeout_ms)
    now = time.monotonic()

    MONITOR_STATE["requests"] += 1

    if not force_refresh:
        external_cached = await get_json_cache("eastmoney_envelope", request_key)
        if isinstance(external_cached, dict) and external_cached.get("data") is not None:
            payload = external_cached.get("data")
            updated_at = external_cached.get("updatedAt")
            is_snapshot_fallback = bool(external_cached.get("isSnapshotFallback"))
            envelope = _make_envelope(
                payload=payload,
                dataset_key=dataset_key,
                request_key=request_key,
                source="cache",
                updated_at=updated_at,
                provider="eastmoney",
                is_snapshot_fallback=is_snapshot_fallback,
                is_cached=True,
            )
            _note_success(dataset_key, "cache", updated_at)
            return envelope

        cached = RESPONSE_CACHE.get(request_key)
        if cached and cached.get("expiresAt", 0) > now:
            envelope = _make_envelope(
                payload=cached["payload"],
                dataset_key=dataset_key,
                request_key=request_key,
                source="cache",
                updated_at=cached.get("updatedAt"),
                provider="eastmoney",
                is_snapshot_fallback=bool(cached.get("isSnapshotFallback")),
                is_cached=True,
            )
            _note_success(dataset_key, "cache", cached.get("updatedAt"))
            return envelope

        if prefer_snapshot:
            snapshot_envelope = _load_snapshot_envelope(dataset_key)
            if snapshot_envelope is not None:
                payload = snapshot_envelope.get("payload")
                updated_at = snapshot_envelope.get("updatedAt")
                RESPONSE_CACHE[request_key] = {
                    "payload": payload,
                    "expiresAt": time.monotonic() + EASTMONEY_CACHE_TTL_SECONDS,
                    "updatedAt": updated_at,
                    "isSnapshotFallback": True,
                }
                envelope = _make_envelope(
                    payload=payload,
                    dataset_key=dataset_key,
                    request_key=request_key,
                    source="snapshot",
                    updated_at=updated_at,
                    provider="eastmoney",
                    is_snapshot_fallback=True,
                )
                await set_json_cache(
                    "eastmoney_envelope",
                    request_key,
                    {
                        "data": payload,
                        "updatedAt": updated_at,
                        "isSnapshotFallback": True,
                    },
                    EASTMONEY_CACHE_TTL_SECONDS,
                )
                _note_success(dataset_key, "snapshot", updated_at)
                return envelope

        cooldown_until = FAILURE_COOLDOWNS.get(request_key)
        if cooldown_until and cooldown_until > now:
            snapshot_envelope = _load_snapshot_envelope(dataset_key)
            if snapshot_envelope is not None:
                payload = snapshot_envelope.get("payload")
                updated_at = snapshot_envelope.get("updatedAt")
                RESPONSE_CACHE[request_key] = {
                    "payload": payload,
                    "expiresAt": time.monotonic() + EASTMONEY_CACHE_TTL_SECONDS,
                    "updatedAt": updated_at,
                    "isSnapshotFallback": True,
                }
                envelope = _make_envelope(
                    payload=payload,
                    dataset_key=dataset_key,
                    request_key=request_key,
                    source="snapshot",
                    updated_at=updated_at,
                    provider="eastmoney",
                    is_snapshot_fallback=True,
                )
                await set_json_cache(
                    "eastmoney_envelope",
                    request_key,
                    {
                        "data": payload,
                        "updatedAt": updated_at,
                        "isSnapshotFallback": True,
                    },
                    EASTMONEY_CACHE_TTL_SECONDS,
                )
                _note_success(dataset_key, "snapshot", updated_at)
                return envelope
            raise HTTPException(status_code=503, detail="东方财富接口处于失败冷却中，请稍后再试")

    in_flight = IN_FLIGHT_REQUESTS.get(request_key)
    if in_flight:
        return await in_flight

    async def _run_request() -> dict[str, Any]:
        async with EASTMONEY_REQUEST_SEMAPHORE:
            last_http_exception: HTTPException | None = None
            for attempt in range(1, EASTMONEY_RETRY_ATTEMPTS + 1):
                try:
                    await _apply_request_pacing()
                    response = await runtime.EASTMONEY_CLIENT.get(
                        target_url,
                        follow_redirects=True,
                        headers=DEFAULT_HEADERS,
                        timeout=timeout,
                    )
                    response.raise_for_status()
                    try:
                        payload = response.json()
                    except ValueError as exc:
                        raise HTTPException(status_code=502, detail="东方财富接口返回了非 JSON 内容") from exc

                    updated_at = _save_snapshot_payload(dataset_key, request_key, target_url, payload)
                    RESPONSE_CACHE[request_key] = {
                        "payload": payload,
                        "expiresAt": time.monotonic() + EASTMONEY_CACHE_TTL_SECONDS,
                        "updatedAt": updated_at,
                        "isSnapshotFallback": False,
                    }
                    await set_json_cache(
                        "eastmoney_envelope",
                        request_key,
                        {
                            "data": payload,
                            "updatedAt": updated_at,
                            "isSnapshotFallback": False,
                        },
                        EASTMONEY_CACHE_TTL_SECONDS,
                    )
                    FAILURE_COOLDOWNS.pop(request_key, None)
                    _note_success(dataset_key, "live", updated_at)
                    return _make_envelope(
                        payload=payload,
                        dataset_key=dataset_key,
                        request_key=request_key,
                        source="live",
                        updated_at=updated_at,
                        provider="eastmoney",
                    )
                except httpx.HTTPStatusError as exc:
                    status_code = exc.response.status_code
                    last_http_exception = HTTPException(
                        status_code=status_code,
                        detail=f"东方财富接口返回 {status_code}",
                    )
                    if status_code not in EASTMONEY_RETRYABLE_STATUS_CODES or attempt >= EASTMONEY_RETRY_ATTEMPTS:
                        break
                except httpx.TimeoutException as exc:
                    last_http_exception = HTTPException(status_code=504, detail="东方财富接口请求超时")
                    if attempt >= EASTMONEY_RETRY_ATTEMPTS:
                        break
                except httpx.HTTPError as exc:
                    last_http_exception = HTTPException(status_code=502, detail=f"东方财富接口请求失败: {exc}")
                    if attempt >= EASTMONEY_RETRY_ATTEMPTS:
                        break

                await asyncio.sleep(0.2 * attempt + random.uniform(0.05, 0.2))

            snapshot_envelope = _load_snapshot_envelope(dataset_key)
            if snapshot_envelope is not None:
                payload = snapshot_envelope.get("payload")
                updated_at = snapshot_envelope.get("updatedAt")
                RESPONSE_CACHE[request_key] = {
                    "payload": payload,
                    "expiresAt": time.monotonic() + EASTMONEY_CACHE_TTL_SECONDS,
                    "updatedAt": updated_at,
                    "isSnapshotFallback": True,
                }
                FAILURE_COOLDOWNS[request_key] = time.monotonic() + EASTMONEY_FAILURE_COOLDOWN_SECONDS
                await set_json_cache(
                    "eastmoney_envelope",
                    request_key,
                    {
                        "data": payload,
                        "updatedAt": updated_at,
                        "isSnapshotFallback": True,
                    },
                    EASTMONEY_CACHE_TTL_SECONDS,
                )
                _note_success(dataset_key, "snapshot", updated_at)
                return _make_envelope(
                    payload=payload,
                    dataset_key=dataset_key,
                    request_key=request_key,
                    source="snapshot",
                    updated_at=updated_at,
                    provider="eastmoney",
                    is_snapshot_fallback=True,
                )

            FAILURE_COOLDOWNS[request_key] = time.monotonic() + EASTMONEY_FAILURE_COOLDOWN_SECONDS
            error_detail = last_http_exception.detail if last_http_exception else "东方财富接口请求失败"
            _note_failure(dataset_key, str(error_detail))
            raise last_http_exception or HTTPException(status_code=502, detail="东方财富接口请求失败")

    task = asyncio.create_task(_run_request())
    IN_FLIGHT_REQUESTS[request_key] = task
    try:
        return await task
    finally:
        current_task = IN_FLIGHT_REQUESTS.get(request_key)
        if current_task is task:
            IN_FLIGHT_REQUESTS.pop(request_key, None)


__all__ = ["fetch_eastmoney_json", "get_eastmoney_monitor_status"]
