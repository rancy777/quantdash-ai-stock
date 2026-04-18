import hashlib
import hmac
import json
import re
import secrets
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException

from server.models import (
    AuthRequest,
    AuthResponse,
    ChangePasswordRequest,
    MeResponse,
    MonitorCondition,
    WatchlistEntry,
)
from server.shared.cache import get_json_cache, set_json_cache
from server.shared.db import get_db_connection
from server.shared import runtime


ROUTER = APIRouter(tags=["auth"])
AUTH_TOKEN_TTL = timedelta(days=7)
MAX_LOGIN_ATTEMPTS = 5
LOGIN_THROTTLE_WINDOW_SECONDS = 15 * 60
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")


def init_auth_db() -> None:
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS watchlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                data TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )


def _hash_password(password: str, salt_hex: Optional[str] = None) -> Tuple[str, str]:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return salt.hex(), hashed.hex()


def _verify_password(password: str, salt_hex: str, password_hash: str) -> bool:
    _, hash_attempt = _hash_password(password, salt_hex=salt_hex)
    return hmac.compare_digest(hash_attempt, password_hash)


def _normalize_username(username: str) -> str:
    return username.strip()


def _cleanup_sessions(conn) -> None:
    conn.execute(
        "DELETE FROM sessions WHERE expires_at <= ?",
        (datetime.utcnow().isoformat(),),
    )


def _validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="密码至少需要 8 个字符")
    if password.lower() == password or password.upper() == password:
        raise HTTPException(status_code=400, detail="密码需同时包含大小写字母")
    if not any(ch.isdigit() for ch in password):
        raise HTTPException(status_code=400, detail="密码需至少包含 1 个数字")


def create_user(username: str, password: str) -> Tuple[int, str]:
    normalized = _normalize_username(username)
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise HTTPException(status_code=400, detail="用户名仅支持 3-32 位字母、数字、点、下划线和中划线")
    _validate_password_strength(password)

    salt, password_hash = _hash_password(password)
    with get_db_connection() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
                (normalized, password_hash, salt, datetime.utcnow().isoformat()),
            )
            return int(cur.lastrowid), normalized
        except Exception as exc:
            if "UNIQUE constraint failed" in str(exc):
                raise HTTPException(status_code=400, detail="用户名已存在") from exc
            raise


def get_user_by_username(username: str):
    normalized = _normalize_username(username)
    with get_db_connection(row_factory=True) as conn:
        cur = conn.execute("SELECT * FROM users WHERE username = ?", (normalized,))
        return cur.fetchone()


def get_user_row_by_id(user_id: int):
    with get_db_connection(row_factory=True) as conn:
        cur = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        return cur.fetchone()


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    row = get_user_by_username(username)
    if not row:
        return None
    if not _verify_password(password, row["salt"], row["password_hash"]):
        return None
    return {"id": row["id"], "username": row["username"]}


def update_user_password(user_id: int, old_password: str, new_password: str) -> None:
    row = get_user_row_by_id(user_id)
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not _verify_password(old_password, row["salt"], row["password_hash"]):
        raise HTTPException(status_code=400, detail="原密码不正确")
    _validate_password_strength(new_password)
    if new_password == old_password:
        raise HTTPException(status_code=400, detail="新密码不能与原密码相同")
    salt, password_hash = _hash_password(new_password)
    with get_db_connection() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
            (password_hash, salt, user_id),
        )


def create_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    now = datetime.utcnow()
    expires_at = now + AUTH_TOKEN_TTL
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (user_id, token, now.isoformat(), expires_at.isoformat()),
        )
    return token


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    with get_db_connection(row_factory=True) as conn:
        _cleanup_sessions(conn)
        cur = conn.execute(
            """
            SELECT users.id, users.username, sessions.token, sessions.expires_at
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ? AND sessions.expires_at > ?
            """,
            (token, datetime.utcnow().isoformat()),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {"id": row["id"], "username": row["username"], "token": row["token"]}


def revoke_session(token: str) -> None:
    with get_db_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def get_user_watchlist(user_id: int) -> List[Dict[str, Any]]:
    with get_db_connection(row_factory=True) as conn:
        cur = conn.execute("SELECT data FROM watchlists WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        if not row:
            return []
        try:
            payload = json.loads(row["data"]) or []
            return payload if isinstance(payload, list) else []
        except json.JSONDecodeError:
            runtime.LOGGER.warning("Failed to decode watchlist for user %s", user_id)
            return []


def save_user_watchlist(user_id: int, items: List[Dict[str, Any]]) -> None:
    if len(items) > 500:
        raise HTTPException(status_code=400, detail="自选列表数量不能超过 500")
    payload = json.dumps(items, ensure_ascii=False)
    now = datetime.utcnow().isoformat()
    with get_db_connection() as conn:
        conn.execute(
            """
            INSERT INTO watchlists (user_id, data, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
            """,
            (user_id, payload, now),
        )


def ensure_condition_defaults(condition: MonitorCondition) -> MonitorCondition:
    if not condition.id:
        condition.id = secrets.token_hex(8)
    if condition.type == "volume_ratio":
        if not condition.ratio or condition.ratio <= 0:
            condition.ratio = 2.0
        if not condition.lookbackDays or condition.lookbackDays < 3:
            condition.lookbackDays = 5
    if condition.type == "price_touch_ma":
        if condition.maWindow not in (5, 10, 20):
            condition.maWindow = 5
        if not condition.tolerancePct or condition.tolerancePct <= 0:
            condition.tolerancePct = 0.003
    return condition


def sanitize_watchlist_entry(entry: WatchlistEntry) -> Dict[str, Any]:
    sanitized_conditions: List[Dict[str, Any]] = []
    for condition in entry.monitorConditions:
        sanitized = ensure_condition_defaults(condition)
        sanitized_conditions.append(sanitized.dict())
    payload = entry.dict()
    payload.pop("monitorSignals", None)
    payload["monitorConditions"] = sanitized_conditions
    return payload


def sanitize_watchlist_payload(items: List[WatchlistEntry]) -> List[Dict[str, Any]]:
    return [sanitize_watchlist_entry(item) for item in items]


def extract_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="缺少授权信息")
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        raise HTTPException(status_code=401, detail="授权格式不正确")
    token = value.strip()
    if len(token) < 32:
        raise HTTPException(status_code=401, detail="授权令牌无效")
    return token


def _login_throttle_key(username: str) -> str:
    return _normalize_username(username).lower() or "anonymous"


async def ensure_login_allowed(username: str) -> None:
    record = await get_json_cache("auth_login", _login_throttle_key(username))
    if not isinstance(record, dict):
        return
    attempts = int(record.get("attempts", 0) or 0)
    if attempts >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(status_code=429, detail="登录尝试过于频繁，请稍后再试")


async def record_login_failure(username: str) -> None:
    cache_key = _login_throttle_key(username)
    record = await get_json_cache("auth_login", cache_key)
    attempts = 1
    if isinstance(record, dict):
        attempts = int(record.get("attempts", 0) or 0) + 1
    await set_json_cache(
        "auth_login",
        cache_key,
        {"attempts": attempts, "updatedAt": datetime.utcnow().isoformat()},
        LOGIN_THROTTLE_WINDOW_SECONDS,
    )


async def clear_login_failures(username: str) -> None:
    await set_json_cache(
        "auth_login",
        _login_throttle_key(username),
        {"attempts": 0, "updatedAt": datetime.utcnow().isoformat()},
        1,
    )


async def require_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = extract_token(authorization)
    user = await runtime.run_blocking(get_user_by_token, token)
    if not user:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return user


@ROUTER.post("/auth/register", response_model=AuthResponse)
async def register_endpoint(payload: AuthRequest):
    user_id, normalized = await runtime.run_blocking(create_user, payload.username, payload.password)
    token = await runtime.run_blocking(create_session, user_id)
    return AuthResponse(token=token, username=normalized)


@ROUTER.post("/auth/login", response_model=AuthResponse)
async def login_endpoint(payload: AuthRequest):
    await ensure_login_allowed(payload.username)
    user = await runtime.run_blocking(authenticate_user, payload.username, payload.password)
    if not user:
        await record_login_failure(payload.username)
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    await clear_login_failures(payload.username)
    token = await runtime.run_blocking(create_session, user["id"])
    return AuthResponse(token=token, username=user["username"])


@ROUTER.get("/auth/me", response_model=MeResponse)
async def me_endpoint(current_user: Dict[str, Any] = Depends(require_user)):
    return MeResponse(username=current_user["username"])


@ROUTER.post("/auth/logout")
async def logout_endpoint(current_user: Dict[str, Any] = Depends(require_user)):
    await runtime.run_blocking(revoke_session, current_user["token"])
    return {"status": "ok"}


@ROUTER.post("/auth/change-password")
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(require_user),
):
    await runtime.run_blocking(
        update_user_password,
        current_user["id"],
        payload.oldPassword,
        payload.newPassword,
    )
    return {"status": "ok"}


init_auth_db()
