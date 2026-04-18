from __future__ import annotations

import importlib.util
import json
import os
import time
from typing import Any


REDIS_URL = os.environ.get("QUANTDASH_REDIS_URL", "").strip()
CACHE_PREFIX = os.environ.get("QUANTDASH_CACHE_PREFIX", "quantdash")
_MEMORY_CACHE: dict[str, tuple[float, str]] = {}
_REDIS_CLIENT: Any = None


def _redis_available() -> bool:
    return bool(REDIS_URL) and importlib.util.find_spec("redis.asyncio") is not None


def build_cache_key(namespace: str, key: str) -> str:
    return f"{CACHE_PREFIX}:{namespace}:{key}"


async def init_cache() -> None:
    global _REDIS_CLIENT

    if not _redis_available():
        _REDIS_CLIENT = None
        return

    try:
        from redis.asyncio import Redis  # type: ignore

        _REDIS_CLIENT = Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            health_check_interval=30,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        await _REDIS_CLIENT.ping()
    except Exception:
        _REDIS_CLIENT = None


async def close_cache() -> None:
    global _REDIS_CLIENT
    if _REDIS_CLIENT is None:
        return

    try:
        await _REDIS_CLIENT.close()
    finally:
        _REDIS_CLIENT = None


def get_cache_backend_status() -> dict[str, Any]:
    return {
        "backend": "redis" if _REDIS_CLIENT is not None else "memory",
        "redisConfigured": bool(REDIS_URL),
        "redisConnected": _REDIS_CLIENT is not None,
    }


async def get_json_cache(namespace: str, key: str) -> Any | None:
    cache_key = build_cache_key(namespace, key)
    if _REDIS_CLIENT is not None:
        try:
            cached = await _REDIS_CLIENT.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    memory_entry = _MEMORY_CACHE.get(cache_key)
    if not memory_entry:
        return None

    expires_at, payload = memory_entry
    if expires_at <= time.time():
        _MEMORY_CACHE.pop(cache_key, None)
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        _MEMORY_CACHE.pop(cache_key, None)
        return None


async def set_json_cache(namespace: str, key: str, value: Any, ttl_seconds: int) -> None:
    cache_key = build_cache_key(namespace, key)
    payload = json.dumps(value, ensure_ascii=False)

    if _REDIS_CLIENT is not None:
        try:
            await _REDIS_CLIENT.set(cache_key, payload, ex=max(ttl_seconds, 1))
            return
        except Exception:
            pass

    _MEMORY_CACHE[cache_key] = (time.time() + max(ttl_seconds, 1), payload)
