import asyncio
import hashlib
import json
import logging
import os
import secrets
import sqlite3
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from data_paths import DATA_DIR, SYSTEM_DIR

try:
    import pywencai  # type: ignore
except ImportError:  # pragma: no cover
    pywencai = None


MODEL_PROXY_TIMEOUT_SECONDS = float(os.environ.get("MODEL_PROXY_TIMEOUT_SECONDS", "120"))
MODEL_PROXY_CONNECT_TIMEOUT_SECONDS = float(
    os.environ.get("MODEL_PROXY_CONNECT_TIMEOUT_SECONDS", "15")
)
HTTP_TIMEOUT = httpx.Timeout(
    MODEL_PROXY_TIMEOUT_SECONDS,
    connect=MODEL_PROXY_CONNECT_TIMEOUT_SECONDS,
)
CLIENT = httpx.AsyncClient(timeout=HTTP_TIMEOUT)
LOGGER = logging.getLogger("quantdash.screener")
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR.mkdir(parents=True, exist_ok=True)
SYSTEM_DIR.mkdir(parents=True, exist_ok=True)
AUTH_DB_PATH = SYSTEM_DIR / "auth.db"
SYNC_PROCESS: Optional[asyncio.subprocess.Process] = None
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


def init_auth_db() -> None:
    with sqlite3.connect(AUTH_DB_PATH) as conn:
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


init_auth_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        await CLIENT.aclose()


APP = FastAPI(title="QuantDash Screener Service", lifespan=lifespan)
APP.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)


class StockPayload(BaseModel):
    symbol: str
    name: str
    price: float
    pctChange: float
    volume: str
    turnover: str
    industry: str
    concepts: List[str]
    pe: float = 0.0
    pb: float = 0.0
    marketCap: float = 0.0


class AuthRequest(BaseModel):
    username: str
    password: str


class AuthResponse(BaseModel):
    token: str
    username: str


class MeResponse(BaseModel):
    username: str


class WatchlistEntry(BaseModel):
    symbol: str
    name: str
    price: float
    pctChange: float
    volume: str
    turnover: str
    industry: str
    concepts: List[str]
    pe: Optional[float] = None
    pb: Optional[float] = None
    marketCap: Optional[float] = None
    screenerSource: Optional[Dict[str, Any]] = None
    monitorConditions: List["MonitorCondition"] = Field(default_factory=list)
    monitorSignals: List["MonitorSignal"] = Field(default_factory=list)


class MonitorCondition(BaseModel):
    id: Optional[str] = None
    type: Literal["volume_ratio", "price_touch_ma"]
    label: Optional[str] = None
    enabled: bool = True
    ratio: Optional[float] = None
    lookbackDays: Optional[int] = None
    minVolume: Optional[float] = None
    maWindow: Optional[int] = None
    tolerancePct: Optional[float] = None


class MonitorSignal(BaseModel):
    conditionId: Optional[str] = None
    conditionType: str
    triggered: bool
    checkedAt: str
    message: str
    metrics: Dict[str, Any] = Field(default_factory=dict)


class ChangePasswordRequest(BaseModel):
    oldPassword: str
    newPassword: str


class SyncTriggerResponse(BaseModel):
    status: str
    trigger: str
    mode: str
    startedAt: str
    pid: Optional[int] = None


class FeishuBotConfigPayload(BaseModel):
    appId: str = ""
    appSecret: str = ""
    verificationToken: str = ""
    aiBaseUrl: str = ""
    aiApiKey: str = ""
    aiModel: str = ""


class FeishuBotConfigTestResult(BaseModel):
    ok: bool
    kind: Literal["success", "warning", "error"]
    statusLabel: str
    detail: str
    checkedAt: str


class ModelInvokePayload(BaseModel):
    providerKey: str = ""
    protocol: Literal["openai", "anthropic", "gemini", "custom"] = "openai"
    baseUrl: str
    apiKey: str = ""
    model: str
    systemPrompt: str = ""
    userPrompt: str
    temperature: float = 0.2
    maxTokens: Optional[int] = None


class ModelInvokeResponse(BaseModel):
    content: str


try:  # pydantic v2
    WatchlistEntry.model_rebuild()
except AttributeError:  # pydantic v1 fallback
    WatchlistEntry.update_forward_refs()


AUTH_TOKEN_TTL = timedelta(days=7)
ENV_LOCAL_PATH = ROOT_DIR / ".env.local"
FEISHU_ENV_KEY_MAP = {
    "appId": "FEISHU_APP_ID",
    "appSecret": "FEISHU_APP_SECRET",
    "verificationToken": "FEISHU_BOT_VERIFICATION_TOKEN",
    "aiBaseUrl": "FEISHU_BOT_AI_BASE_URL",
    "aiApiKey": "FEISHU_BOT_AI_API_KEY",
    "aiModel": "FEISHU_BOT_AI_MODEL",
}


def _hash_password(password: str, salt_hex: Optional[str] = None) -> Tuple[str, str]:
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return salt.hex(), hashed.hex()


def _verify_password(password: str, salt_hex: str, password_hash: str) -> bool:
    _, hash_attempt = _hash_password(password, salt_hex=salt_hex)
    return hash_attempt == password_hash


def _read_env_local_lines() -> List[str]:
    if not ENV_LOCAL_PATH.exists():
        return []
    return ENV_LOCAL_PATH.read_text(encoding="utf-8").splitlines()


def _parse_env_local_map() -> Dict[str, str]:
    parsed: Dict[str, str] = {}
    for line in _read_env_local_lines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        parsed[key.strip()] = value.strip().strip('"').strip("'")
    return parsed


def _serialize_env_value(value: str) -> str:
    return value.replace("\n", " ").strip()


def _write_env_local_updates(updates: Dict[str, str]) -> None:
    lines = _read_env_local_lines()
    if not lines:
        lines = []
    replaced_keys = set()
    next_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            next_lines.append(line)
            continue
        key, _value = stripped.split("=", 1)
        normalized_key = key.strip()
        if normalized_key in updates:
            next_lines.append(f"{normalized_key}={_serialize_env_value(updates[normalized_key])}")
            replaced_keys.add(normalized_key)
        else:
            next_lines.append(line)

    missing_keys = [key for key in updates.keys() if key not in replaced_keys]
    if missing_keys:
        if next_lines and next_lines[-1].strip():
            next_lines.append("")
        if "FEISHU_APP_ID" in missing_keys:
            next_lines.append("# Feishu 机器人配置")
        for key in missing_keys:
            next_lines.append(f"{key}={_serialize_env_value(updates[key])}")

    ENV_LOCAL_PATH.write_text("\n".join(next_lines).rstrip() + "\n", encoding="utf-8")
    for key, value in updates.items():
        os.environ[key] = value


def _load_feishu_bot_config() -> FeishuBotConfigPayload:
    env_map = _parse_env_local_map()
    payload: Dict[str, str] = {}
    for field_name, env_key in FEISHU_ENV_KEY_MAP.items():
        payload[field_name] = env_map.get(env_key, os.environ.get(env_key, ""))
    return FeishuBotConfigPayload(**payload)


def _save_feishu_bot_config(payload: FeishuBotConfigPayload) -> FeishuBotConfigPayload:
    updates = {
        env_key: getattr(payload, field_name, "").strip()
        for field_name, env_key in FEISHU_ENV_KEY_MAP.items()
    }
    _write_env_local_updates(updates)
    return _load_feishu_bot_config()


def _build_feishu_test_result(kind: Literal["success", "warning", "error"], status_label: str, detail: str) -> FeishuBotConfigTestResult:
    return FeishuBotConfigTestResult(
        ok=kind == "success",
        kind=kind,
        statusLabel=status_label,
        detail=detail,
        checkedAt=datetime.utcnow().isoformat(),
    )


def _truncate_error_detail(value: Any, limit: int = 240) -> str:
    text = str(value or "").strip()
    return text[:limit] if text else ""


def _format_proxy_exception(exc: Exception) -> str:
    message = str(exc).strip()
    if isinstance(exc, httpx.ConnectTimeout):
        return "连接上游模型接口超时"
    if isinstance(exc, httpx.ReadTimeout):
        return "上游模型接口响应超时"
    if isinstance(exc, httpx.ConnectError):
        return f"无法连接上游模型接口{f': {message}' if message else ''}"
    if isinstance(exc, httpx.RemoteProtocolError):
        return f"上游模型接口协议异常{f': {message}' if message else ''}"
    if isinstance(exc, httpx.ProxyError):
        return f"代理链路异常{f': {message}' if message else ''}"
    if isinstance(exc, httpx.HTTPError):
        return f"{exc.__class__.__name__}{f': {message}' if message else ''}"
    return f"{exc.__class__.__name__}{f': {message}' if message else ''}"


async def _invoke_model(payload: ModelInvokePayload) -> str:
    base_url = payload.baseUrl.strip().rstrip("/")
    model = payload.model.strip()
    api_key = payload.apiKey.strip()
    system_prompt = payload.systemPrompt.strip()
    user_prompt = payload.userPrompt.strip()

    if not base_url or not model or not user_prompt:
        raise HTTPException(status_code=400, detail="模型调用缺少 baseUrl、model 或 userPrompt。")

    try:
        if payload.protocol == "anthropic":
            response = await CLIENT.post(
                f"{base_url}/v1/messages",
                headers={
                    "content-type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": model,
                    "max_tokens": payload.maxTokens or 1600,
                    "messages": [{"role": "user", "content": user_prompt}],
                    **({"system": system_prompt} if system_prompt else {}),
                },
            )
            if not response.is_success:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=_truncate_error_detail(response.text) or f"Anthropic 请求失败: {response.status_code}",
                )
            body = response.json()
            return "\n".join(
                item.get("text", "")
                for item in (body.get("content") or [])
                if isinstance(item, dict) and item.get("type") == "text"
            ).strip()

        if payload.protocol == "gemini":
            response = await CLIENT.post(
                f"{base_url}/v1beta/models/{model}:generateContent",
                params={"key": api_key},
                headers={"content-type": "application/json"},
                json={
                    "contents": [{
                        "role": "user",
                        "parts": [{"text": "\n\n".join(filter(None, [system_prompt, user_prompt]))}],
                    }]
                },
            )
            if not response.is_success:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=_truncate_error_detail(response.text) or f"Gemini 请求失败: {response.status_code}",
                )
            body = response.json()
            parts = (((body.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
            return "\n".join(item.get("text", "") for item in parts if isinstance(item, dict)).strip()

        headers = {"content-type": "application/json"}
        if api_key:
            headers["authorization"] = f"Bearer {api_key}"
        if payload.providerKey == "openrouter":
            headers["HTTP-Referer"] = "https://quantdash.local"
            headers["X-Title"] = "QuantDash"

        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": user_prompt})
        response = await CLIENT.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json={
                "model": model,
                "temperature": payload.temperature,
                "messages": messages,
                **({"max_tokens": payload.maxTokens} if payload.maxTokens else {}),
            },
        )
        if not response.is_success:
            raise HTTPException(
                status_code=response.status_code,
                detail=_truncate_error_detail(response.text) or f"模型请求失败: {response.status_code}",
            )
        body = response.json()
        return ((((body.get("choices") or [{}])[0].get("message") or {}).get("content")) or "").strip()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"模型代理请求失败: {_format_proxy_exception(exc)}") from exc


async def _test_feishu_bot_config(payload: FeishuBotConfigPayload) -> FeishuBotConfigTestResult:
    app_id = payload.appId.strip()
    app_secret = payload.appSecret.strip()
    if not app_id or not app_secret:
        return _build_feishu_test_result("warning", "缺少飞书凭证", "请先填写 FEISHU_APP_ID 和 FEISHU_APP_SECRET。")

    try:
        response = await CLIENT.post(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            json={
                "app_id": app_id,
                "app_secret": app_secret,
            },
        )
        response.raise_for_status()
        auth_json = response.json()
        if auth_json.get("code") != 0 or not auth_json.get("tenant_access_token"):
            return _build_feishu_test_result(
                "error",
                "飞书鉴权失败",
                f"返回: {auth_json.get('msg') or auth_json.get('code') or '未知错误'}",
            )
    except Exception as exc:
        return _build_feishu_test_result("error", "飞书鉴权失败", str(exc))

    ai_base_url = payload.aiBaseUrl.strip().rstrip("/")
    ai_model = payload.aiModel.strip()
    ai_api_key = payload.aiApiKey.strip()
    if not ai_base_url or not ai_model:
        return _build_feishu_test_result(
            "success",
            "飞书凭证可用",
            "飞书 App 鉴权通过。AI 模型参数未填写完整，机器人将退回本地兜底分析。",
        )

    try:
        response = await CLIENT.post(
            f"{ai_base_url}/chat/completions",
            headers={
                "content-type": "application/json",
                **({"authorization": f"Bearer {ai_api_key}"} if ai_api_key else {}),
            },
            json={
                "model": ai_model,
                "temperature": 0,
                "messages": [
                    {"role": "system", "content": "Reply with OK only."},
                    {"role": "user", "content": "ping"},
                ],
                "max_tokens": 8,
            },
        )
        response.raise_for_status()
        ai_json = response.json()
        content = (
            (((ai_json.get("choices") or [{}])[0].get("message") or {}).get("content"))
            if isinstance(ai_json, dict)
            else None
        )
        if not content:
            return _build_feishu_test_result("warning", "飞书鉴权通过", "飞书凭证有效，但 AI 接口返回内容为空。")
    except Exception as exc:
        return _build_feishu_test_result(
            "warning",
            "飞书鉴权通过",
            f"飞书 App 鉴权已通过，但 AI 接口测试失败: {exc}",
        )

    return _build_feishu_test_result("success", "飞书与 AI 均可用", "飞书 App 鉴权通过，AI 接口也已返回有效响应。")


def _normalize_username(username: str) -> str:
    return username.strip()


def _cleanup_sessions(conn: sqlite3.Connection) -> None:
    conn.execute(
        "DELETE FROM sessions WHERE expires_at <= ?",
        (datetime.utcnow().isoformat(),),
    )


def create_user(username: str, password: str) -> Tuple[int, str]:
    normalized = _normalize_username(username)
    if not normalized or len(normalized) < 3:
        raise HTTPException(status_code=400, detail="用户名至少需要 3 个字符")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少需要 6 个字符")

    salt, password_hash = _hash_password(password)
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
                (normalized, password_hash, salt, datetime.utcnow().isoformat()),
            )
        except sqlite3.IntegrityError as exc:  # username exists
            raise HTTPException(status_code=400, detail="用户名已存在") from exc
    return int(cur.lastrowid), normalized


def get_user_by_username(username: str) -> Optional[sqlite3.Row]:
    normalized = _normalize_username(username)
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT * FROM users WHERE username = ?", (normalized,))
        return cur.fetchone()


def get_user_row_by_id(user_id: int) -> Optional[sqlite3.Row]:
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
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
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少需要 6 个字符")
    if new_password == old_password:
        raise HTTPException(status_code=400, detail="新密码不能与原密码相同")
    salt, password_hash = _hash_password(new_password)
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        conn.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE id = ?",
            (password_hash, salt, user_id),
        )


def create_session(user_id: int) -> str:
    token = secrets.token_hex(32)
    now = datetime.utcnow()
    expires_at = now + AUTH_TOKEN_TTL
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        conn.execute(
            "INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (user_id, token, now.isoformat(), expires_at.isoformat()),
        )
    return token


def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
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
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def get_user_watchlist(user_id: int) -> List[Dict[str, Any]]:
    with sqlite3.connect(AUTH_DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute("SELECT data FROM watchlists WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        if not row:
            return []
        try:
            payload = json.loads(row["data"]) or []
            return payload if isinstance(payload, list) else []
        except json.JSONDecodeError:
            LOGGER.warning("Failed to decode watchlist for user %s", user_id)
            return []


def save_user_watchlist(user_id: int, items: List[Dict[str, Any]]) -> None:
    payload = json.dumps(items, ensure_ascii=False)
    now = datetime.utcnow().isoformat()
    with sqlite3.connect(AUTH_DB_PATH) as conn:
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


def get_sync_runtime_state() -> Dict[str, Any]:
    return dict(SYNC_RUNTIME_STATE)


async def _watch_sync_process(process: asyncio.subprocess.Process) -> None:
    global SYNC_PROCESS
    try:
        await process.wait()
        SYNC_RUNTIME_STATE["state"] = "idle"
        SYNC_RUNTIME_STATE["finishedAt"] = datetime.utcnow().isoformat()
        SYNC_RUNTIME_STATE["exitCode"] = process.returncode
        SYNC_RUNTIME_STATE["error"] = None if process.returncode == 0 else f"process exited with code {process.returncode}"
        SYNC_RUNTIME_STATE["pid"] = None
    except Exception as exc:  # pragma: no cover
        SYNC_RUNTIME_STATE["state"] = "idle"
        SYNC_RUNTIME_STATE["finishedAt"] = datetime.utcnow().isoformat()
        SYNC_RUNTIME_STATE["exitCode"] = -1
        SYNC_RUNTIME_STATE["error"] = str(exc)
        SYNC_RUNTIME_STATE["pid"] = None
    finally:
        SYNC_PROCESS = None


async def launch_startup_sync(mode: str = "startup") -> Dict[str, Any]:
    global SYNC_PROCESS
    if SYNC_PROCESS and SYNC_PROCESS.returncode is None:
        raise HTTPException(status_code=409, detail="已有同步任务正在执行")

    env = os.environ.copy()
    env["STARTUP_AUTO_SYNC"] = "1"
    env["STARTUP_SYNC_MODE"] = mode
    process = await asyncio.create_subprocess_exec(
        "node",
        str(ROOT_DIR / "scripts" / "ensureStartupData.js"),
        cwd=str(ROOT_DIR),
        env=env,
    )
    SYNC_PROCESS = process
    SYNC_RUNTIME_STATE["state"] = "running"
    SYNC_RUNTIME_STATE["trigger"] = "startup-sync"
    SYNC_RUNTIME_STATE["mode"] = mode
    SYNC_RUNTIME_STATE["startedAt"] = datetime.utcnow().isoformat()
    SYNC_RUNTIME_STATE["finishedAt"] = None
    SYNC_RUNTIME_STATE["exitCode"] = None
    SYNC_RUNTIME_STATE["error"] = None
    SYNC_RUNTIME_STATE["pid"] = process.pid
    asyncio.create_task(_watch_sync_process(process))
    return get_sync_runtime_state()


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
    return value.strip()


async def require_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = extract_token(authorization)
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    return user


def build_stock_list_url(page: int, page_size: int) -> str:
    timestamp = int(datetime.utcnow().timestamp() * 1000)
    return (
        "https://push2.eastmoney.com/api/qt/clist/get"
        f"?pn={page}&pz={page_size}&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
        f"&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20,f100&_={timestamp}"
    )


async def fetch_json(url: str) -> Dict:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://eastmoney.com/",
        "Accept-Language": "zh-CN,zh;q=0.9"
    }
    resp = None
    try:
        resp = await CLIENT.get(url, headers=headers)
        LOGGER.debug(f"Fetching JSON from {url}, status code: {resp.status_code}")
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        LOGGER.error(f"HTTP error when fetching {url}: {e.response.status_code} - {e.response.text}")
        raise
    except httpx.RequestError as e:
        LOGGER.error(f"Request error when fetching {url}: {e}")
        raise
    except ValueError as e:
        if resp:
            LOGGER.error(f"JSON decode error when fetching {url}: {e}, response content: {resp.text}")
        else:
            LOGGER.error(f"JSON decode error when fetching {url}: {e}")
        raise


def map_stock_payload(item: Dict) -> StockPayload:
    def safe_float(value, default=0.0):
        if value == "-" or value is None:
            return default
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def safe_list(value) -> List[str]:
        if isinstance(value, list):
            return value
        return [value] if isinstance(value, str) and value else []

    volume = "-"
    turnover = "-"
    try:
        volume_value = safe_float(item.get("f5"))
        if volume_value:
            volume = f"{volume_value / 10000:.1f}万"
    except Exception:
        pass
    try:
        turnover_value = safe_float(item.get("f6"))
        if turnover_value:
            turnover = f"{turnover_value / 1e8:.2f}亿"
    except Exception:
        pass

    return StockPayload(
        symbol=str(item.get("f12")),
        name=item.get("f14", ""),
        price=safe_float(item.get("f2")),
        pctChange=safe_float(item.get("f3")),
        volume=volume,
        turnover=turnover,
        industry=item.get("f100", "") or "市场热点",
        concepts=safe_list(item.get("f100", "市场热点")),
        pe=safe_float(item.get("f9")),
        pb=safe_float(item.get("f23")),
        marketCap=safe_float(item.get("f20")) / 1e8 if safe_float(item.get("f20")) else 0.0,
    )


async def fetch_stock_list(limit_pages: int = 1, page_size: int = 100) -> List[StockPayload]:
    stocks: List[StockPayload] = []
    for page in range(1, limit_pages + 1):
        url = build_stock_list_url(page, page_size)
        data = await fetch_json(url)
        diff = data.get("data", {}).get("diff") or []
        stocks.extend(map_stock_payload(item) for item in diff)
        if len(diff) < page_size:
            break
    return stocks


async def fetch_chinext_list() -> List[StockPayload]:
    url = (
        "https://push2.eastmoney.com/api/qt/clist/get"
        "?pn=1&pz=80&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        "&fs=m:0+t:80"
        "&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20"
    )
    data = await fetch_json(url)
    diff = data.get("data", {}).get("diff") or []
    return [
        StockPayload(
            symbol=str(item.get("f12")),
            name=item.get("f14", ""),
            price=float(item.get("f2") or 0),
            pctChange=float(item.get("f3") or 0),
            volume=f"{(item.get('f5') or 0) / 10000:.1f}万",
            turnover=f"{(item.get('f6') or 0) / 1e8:.2f}亿",
            industry="创业板",
            concepts=["成长", "热门"],
            pe=float(item.get("f9") or 0),
            pb=float(item.get("f23") or 0),
            marketCap=float(item.get("f20") or 0) / 1e8,
        )
        for item in diff
    ]


async def fetch_full_market_list() -> List[StockPayload]:
    stocks: List[StockPayload] = []
    for page in range(1, 31):
        url = build_stock_list_url(page, 400)
        data = await fetch_json(url)
        diff = data.get("data", {}).get("diff") or []
        stocks.extend(map_stock_payload(item) for item in diff)
        if len(diff) < 400:
            break
        await asyncio.sleep(0.1)
    return stocks


def _resolve_sina_scale(period: int) -> int:
    if period in (1, 5, 15, 30, 60):
        return period
    if period in (101, 102, 103):
        # Sina uses 240 to represent daily K-line data
        return 240
    return 240


def _resolve_tencent_symbol(symbol: str) -> str:
    return f"sh{symbol}" if symbol.startswith("6") else f"sz{symbol}"


def _resolve_sina_symbol(symbol: str) -> str:
    return f"sh{symbol}" if symbol.startswith("6") else f"sz{symbol}"


async def fetch_kline_from_sina(symbol: str, period: int = 101) -> List[Dict]:
    sina_symbol = _resolve_sina_symbol(symbol)
    scale = _resolve_sina_scale(period)
    params = {
        "symbol": sina_symbol,
        "scale": scale,
        "ma": "5,10,20,30,60",
        "datalen": 200,
    }
    url = "https://quotes.sina.cn/cn/api/openapi.php/StockService.getKLineData"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://finance.sina.com.cn/",
        "Accept-Language": "zh-CN,zh;q=0.9"
    }
    resp = await CLIENT.get(url, params=params, headers=headers)
    resp.raise_for_status()
    payload = resp.json()
    result_block: Any = payload.get("result")
    if isinstance(result_block, list):
        result_block = result_block[0] if result_block else {}
    if not isinstance(result_block, dict):
        return []
    data_block: Any = result_block.get("data", {})
    if isinstance(data_block, list):
        data_block = data_block[0] if data_block else {}
    if not isinstance(data_block, dict):
        return []
    kline = data_block.get("kline") or []
    series: List[Dict[str, Any]] = []
    for item in kline:
        day = item.get("day")
        if not day:
            continue
        try:
            series.append(
                {
                    "date": day,
                    "open": float(item.get("open", 0) or 0),
                    "close": float(item.get("close", 0) or 0),
                    "high": float(item.get("high", 0) or 0),
                    "low": float(item.get("low", 0) or 0),
                    "volume": float(item.get("volume", 0) or 0),
                }
            )
        except (TypeError, ValueError):
            continue
    return series


async def fetch_kline_from_tencent(symbol: str, period: int = 101) -> List[Dict]:
    tencent_symbol = _resolve_tencent_symbol(symbol)
    limit = 240
    if period in (1, 5, 15, 30, 60):
        # 分钟线
        param = f"{tencent_symbol},m{period},{limit}"
        url = "https://ifzq.gtimg.cn/appstock/app/kline/mkline"
    else:
        # 日线
        param = f"{tencent_symbol},day,,{limit},qfq"
        url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Referer": "https://gu.qq.com/",
        "Accept-Language": "zh-CN,zh;q=0.9"
    }
    resp = await CLIENT.get(url, params={"param": param}, headers=headers)
    resp.raise_for_status()
    payload = resp.json()
    data = payload.get("data", {})
    if not isinstance(data, dict):
        return []
    target_raw: Any = data.get(tencent_symbol) or data.get(tencent_symbol.upper())
    target: Optional[Dict[str, Any]] = None
    if isinstance(target_raw, dict):
        target = target_raw
    elif isinstance(target_raw, list):
        for candidate in target_raw:
            if isinstance(candidate, dict):
                target = candidate
                break
    if not target:
        return []
    # 根据period类型确定kline_key
    if period in (1, 5, 15, 30, 60):
        kline_key = "m"
    else:
        kline_key = "day"
    kline = (
        target.get(f"{kline_key}_hfq")
        or target.get(f"{kline_key}_fq")
        or target.get(kline_key)
        or []
    )
    series: List[Dict[str, Any]] = []
    for item in kline:
        if isinstance(item, list) and len(item) >= 6:
            date_str = item[0]
            open_p, close_p, high_p, low_p, volume = item[1:6]
        elif isinstance(item, dict):
            date_str = item.get("date")
            open_p = item.get("open")
            close_p = item.get("close")
            high_p = item.get("high")
            low_p = item.get("low")
            volume = item.get("volume")
        else:
            continue
        if not date_str:
            continue
        try:
            series.append(
                {
                    "date": date_str,
                    "open": float(open_p or 0),
                    "close": float(close_p or 0),
                    "high": float(high_p or 0),
                    "low": float(low_p or 0),
                    "volume": float(volume or 0),
                }
            )
        except (TypeError, ValueError):
            continue
    return series


async def fetch_realtime_quote(symbol: str) -> Optional[Dict[str, float]]:
    tencent_symbol = _resolve_tencent_symbol(symbol)
    url = f"http://qt.gtimg.cn/q={tencent_symbol}"
    headers = {
        "Referer": "http://qt.gtimg.cn",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9"
    }
    resp = await CLIENT.get(url, headers=headers)
    resp.raise_for_status()
    body = resp.text.strip()
    if "=" not in body:
        return None
    _, _, payload = body.partition("=")
    payload = payload.strip().strip(";")
    if payload.startswith('"') and payload.endswith('"'):
        payload = payload[1:-1]
    if not payload:
        return None
    fields = payload.split("~")
    if len(fields) < 33:
        return None
    try:
        current_price = float(fields[3] or 0)
        prev_close = float(fields[4] or 0)
        open_price = float(fields[5] or 0)
        high_price = float(fields[33] or 0) if len(fields) > 33 else current_price
        low_price = float(fields[34] or 0) if len(fields) > 34 else current_price
        volume = float(fields[6] or 0) * 100 if fields[6] else 0.0
        turnover = float(fields[37] or 0) if len(fields) > 37 else 0.0
        return {
            "open": open_price,
            "prev_close": prev_close,
            "price": current_price,
            "high": high_price,
            "low": low_price,
            "volume": volume,
            "turnover": turnover,
        }
    except (ValueError, IndexError):
        return None


async def fetch_kline_from_eastmoney(symbol: str, period: int = 101) -> List[Dict]:
    # 东方财富接口，使用与fetchMarketData.js相同的API格式
    try:
        # 根据股票代码判断市场类型
        if symbol.startswith("60") or symbol.startswith("5") or symbol.startswith("900"):
            secid = f"1.{symbol}"
        else:
            secid = f"0.{symbol}"
        
        # 构建URL和参数，与fetchMarketData.js保持一致
        url = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        params = {
            "secid": secid,
            "fields1": "f1",
            "fields2": "f51,f52,f53,f54,f55,f57",
            "klt": period,
            "fqt": "1",  # 前复权
            "end": "20500101",
            "lmt": "260",
            "_": int(datetime.now().timestamp() * 1000)  # 添加时间戳防止缓存
        }
        
        # 设置请求头
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": "http://quote.eastmoney.com/",
            "Accept-Language": "zh-CN,zh;q=0.9"
        }
        
        # 直接使用CLIENT发送请求，不使用fetch_json以避免额外的错误处理
        resp = await CLIENT.get(url, params=params, headers=headers)
        resp.raise_for_status()
        payload = resp.json()
        
        # 解析数据
        klines = payload.get("data", {}).get("klines") or []
        
        # 转换数据格式
        series = []
        for entry in klines:
            parts = entry.split(',')
            if len(parts) >= 6:
                date_str, open_p, close_p, high_p, low_p, volume = parts[:6]
                try:
                    series.append({
                        "date": date_str,
                        "open": float(open_p),
                        "close": float(close_p),
                        "high": float(high_p),
                        "low": float(low_p),
                        "volume": float(volume)
                    })
                except ValueError:
                    continue  # 跳过格式错误的数据
        
        return series
    except httpx.ConnectTimeout:
        LOGGER.error(f"Eastmoney API connect timeout for {symbol}")
        return []
    except httpx.HTTPError as e:
        LOGGER.error(f"Eastmoney API HTTP error for {symbol}: {e}")
        return []
    except Exception as e:
        LOGGER.error(f"Eastmoney API error for {symbol}: {type(e).__name__}: {e}")
        return []


def generate_mock_kline(symbol: str, days: int = 120) -> List[Dict]:
    """生成模拟的K线数据"""
    import random
    from datetime import datetime, timedelta
    
    series = []
    base_price = random.uniform(5, 50)
    current_price = base_price
    
    # 生成过去days天的模拟数据
    for i in range(days):
        date = (datetime.now() - timedelta(days=days - i - 1)).strftime("%Y-%m-%d")
        
        # 生成随机价格变化
        change_pct = random.uniform(-5, 5) / 100
        open_p = current_price
        close_p = current_price * (1 + change_pct)
        high_p = max(open_p, close_p) * (1 + random.uniform(0, 2) / 100)
        low_p = min(open_p, close_p) * (1 - random.uniform(0, 2) / 100)
        volume = random.uniform(5000000, 50000000)
        
        series.append({
            "date": date,
            "open": round(open_p, 2),
            "close": round(close_p, 2),
            "high": round(high_p, 2),
            "low": round(low_p, 2),
            "volume": round(volume)
        })
        
        current_price = close_p
    
    LOGGER.debug(f"Generated mock kline data for {symbol}, {days} days")
    return series

async def fetch_kline(symbol: str, period: int = 101) -> List[Dict]:
    # 调整数据源顺序，添加重试机制
    providers = [
        ("Eastmoney", fetch_kline_from_eastmoney),
        ("Sina", fetch_kline_from_sina),
        ("Tencent", fetch_kline_from_tencent),
    ]
    
    # 尝试每个数据源最多3次
    for name, provider in providers:
        for attempt in range(3):
            try:
                LOGGER.debug(f"Attempting to fetch kline from {name} for {symbol} (attempt {attempt + 1})")
                data = await provider(symbol, period)
                if data:
                    LOGGER.info(f"Successfully fetched kline from {name} for {symbol}")
                    return data
                LOGGER.warning(f"{name} kline fetch returned empty for {symbol} (attempt {attempt + 1})")
            except httpx.ConnectTimeout:
                LOGGER.warning(f"{name} kline fetch timed out for {symbol} (attempt {attempt + 1})")
                # 连接超时，等待一段时间后重试
                await asyncio.sleep(1)
            except Exception as e:
                LOGGER.warning(f"{name} kline fetch failed for {symbol} (attempt {attempt + 1}): {type(e).__name__}: {e}")
    
    LOGGER.error(f"All providers failed to fetch kline for {symbol}, generating mock data")
    # 如果所有数据源都失败，生成模拟数据
    return generate_mock_kline(symbol)





def latest_trading_index(series: List[Dict]) -> int:
    if not series:
        return -1
    today = datetime.utcnow().strftime("%Y-%m-%d")
    for idx in range(len(series) - 1, -1, -1):
        if series[idx]["date"] <= today:
            return idx
    return len(series) - 1


def pct_change(series: List[Dict], index: int) -> float:
    if index <= 0 or index >= len(series):
        return 0.0
    prev = series[index - 1]["close"]
    if prev == 0:
        return 0.0
    return ((series[index]["close"] - prev) / prev) * 100


def limit_up_threshold(symbol: str, name: Optional[str] = None) -> float:
    upper_name = (name or "").upper()
    if "ST" in upper_name:
        return 1.045
    if symbol.startswith(("30", "68")):
        return 1.195
    if symbol.startswith(("8", "4")):
        return 1.30
    return 1.095


def count_recent(flags: List[bool], window: int, end_idx: int) -> int:
    start = max(end_idx - window + 1, 0)
    return sum(1 for i in range(start, end_idx + 1) if flags[i])


def trading_days_between(series: List[Dict], start: int, end: int) -> int:
    if start >= end:
        return 0
    count = 0
    for i in range(start + 1, end + 1):
        day = datetime.strptime(series[i]["date"], "%Y-%m-%d").weekday()
        if day < 5:
            count += 1
    return count


def simple_moving_average(series: List[Dict], index: int, window: int, key: str) -> Optional[float]:
    if index < 0 or window <= 0 or index - window + 1 < 0:
        return None
    total = 0.0
    for offset in range(window):
        total += float(series[index - offset].get(key, 0.0))
    return total / window


def evaluate_volume_ratio(
    series: List[Dict],
    index: int,
    condition: MonitorCondition,
    quote: Optional[Dict[str, float]] = None,
) -> MonitorSignal:
    condition = ensure_condition_defaults(condition)
    lookback = max(condition.lookbackDays or 5, 1)
    avg_volume = simple_moving_average(series, index, lookback, "volume")
    checked_at = datetime.utcnow().isoformat()
    quote_volume = (quote or {}).get("volume") or 0.0
    today_volume = quote_volume if quote_volume > 0 else series[index].get("volume", 0.0)
    if avg_volume is None or avg_volume <= 0:
        return MonitorSignal(
            conditionId=condition.id,
            conditionType=condition.type,
            triggered=False,
            checkedAt=checked_at,
            message="历史成交量数据不足",
            metrics={"todayVolume": today_volume},
        )
    target_ratio = condition.ratio or 2.0
    volume_threshold = avg_volume * target_ratio
    if condition.minVolume and condition.minVolume > 0:
        volume_threshold = max(volume_threshold, condition.minVolume)
    computed_ratio = today_volume / avg_volume if avg_volume else 0.0
    triggered = today_volume >= volume_threshold
    message = (
        f"成交量 {today_volume:.0f}，近{lookback}日均 {avg_volume:.0f}，"
        f"当前放大 {computed_ratio:.2f} 倍，要求 {target_ratio:.2f} 倍"
    )
    if condition.minVolume:
        message += f"，最低 {condition.minVolume:.0f}"
    return MonitorSignal(
        conditionId=condition.id,
        conditionType=condition.type,
        triggered=triggered,
        checkedAt=checked_at,
        message=message,
        metrics={
            "todayVolume": today_volume,
            "averageVolume": avg_volume,
            "requiredRatio": target_ratio,
            "computedRatio": computed_ratio,
            "thresholdVolume": volume_threshold,
        },
    )


def evaluate_price_touch_ma(
    series: List[Dict],
    index: int,
    condition: MonitorCondition,
    quote: Optional[Dict[str, float]] = None,
) -> MonitorSignal:
    condition = ensure_condition_defaults(condition)
    window = condition.maWindow or 5
    tolerance = condition.tolerancePct or 0.003
    checked_at = datetime.utcnow().isoformat()
    ma_value = simple_moving_average(series, index, window, "close")
    quote_price = (quote or {}).get("price") or 0.0
    price = quote_price if quote_price > 0 else series[index].get("close", 0.0)
    if ma_value is None or ma_value <= 0:
        return MonitorSignal(
            conditionId=condition.id,
            conditionType=condition.type,
            triggered=False,
            checkedAt=checked_at,
            message="历史收盘价数据不足，无法计算均线",
            metrics={"close": price, "maWindow": window},
        )
    distance_pct = abs(price - ma_value) / ma_value if ma_value else 0.0
    triggered = distance_pct <= tolerance
    message = (
        f"收盘 {price:.2f}，{window} 日均线 {ma_value:.2f}，偏离 {distance_pct * 100:.2f}%，"
        f"容差 {tolerance * 100:.2f}%"
    )
    return MonitorSignal(
        conditionId=condition.id,
        conditionType=condition.type,
        triggered=triggered,
        checkedAt=checked_at,
        message=message,
        metrics={
            "close": price,
            "movingAverage": ma_value,
            "distancePct": distance_pct,
            "tolerancePct": tolerance,
            "maWindow": window,
        },
    )


def evaluate_monitor_condition(
    series: List[Dict],
    index: int,
    condition: MonitorCondition,
    quote: Optional[Dict[str, float]] = None,
) -> Optional[MonitorSignal]:
    if condition.type == "volume_ratio":
        return evaluate_volume_ratio(series, index, condition, quote)
    if condition.type == "price_touch_ma":
        return evaluate_price_touch_ma(series, index, condition, quote)
    return None


async def compute_monitor_signals(entry: WatchlistEntry) -> List[MonitorSignal]:
    if not entry.monitorConditions:
        return []
    series = await fetch_kline(entry.symbol)
    idx = latest_trading_index(series)
    if idx < 0:
        return []
    quote: Optional[Dict[str, float]] = None
    try:
        quote = await fetch_realtime_quote(entry.symbol)
    except httpx.HTTPError as exc:
        LOGGER.warning("Failed to fetch realtime quote for %s: %s", entry.symbol, exc)
    signals: List[MonitorSignal] = []
    for condition in entry.monitorConditions:
        if not condition.enabled:
            continue
        signal = evaluate_monitor_condition(series, idx, condition, quote)
        if signal:
            signals.append(signal)
    return signals


async def attach_monitor_signals(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    annotated: List[Dict[str, Any]] = []
    for raw in items:
        entry = WatchlistEntry(**raw)
        entry.monitorSignals = []
        if entry.monitorConditions:
            try:
                entry.monitorSignals = await compute_monitor_signals(entry)
            except httpx.HTTPError as exc:
                LOGGER.warning("Failed to compute monitor signals for %s: %s", entry.symbol, exc)
        annotated.append(entry.dict())
    return annotated


async def run_wencai_query(question: str) -> List[StockPayload]:
    if pywencai is None:
        raise HTTPException(status_code=503, detail="pywencai is not installed in this environment")

    def _query():
        return pywencai.get(question=question, loop=True)

    try:
        result = await asyncio.to_thread(_query)
    except Exception as exc:  # pragma: no cover - depends on remote API
        LOGGER.exception("PyWenCai query failed: %s", question)
        raise HTTPException(status_code=502, detail="PyWenCai 查询失败，请稍后重试") from exc

    rows: List[Dict[str, Any]] = []
    if result is None:
        rows = []
    elif hasattr(result, "to_dict"):
        rows = result.to_dict(orient="records")
    elif isinstance(result, list):
        rows = result
    else:
        rows = []

    def pick(row: Dict[str, Any], *keys: str, default=None):
        for key in keys:
            if key in row and row[key] not in (None, ""):
                return row[key]
        return default

    stocks: List[StockPayload] = []
    for row in rows:
        symbol = str(pick(row, "股票代码", "code", "证券代码", default="")).strip()
        name = str(pick(row, "股票简称", "name", "证券简称", default="")).strip()
        if not symbol or not name:
            continue
        price = float(pick(row, "最新价", "price", "现价", default=0) or 0)
        pct = float(pick(row, "涨跌幅", "涨幅", "pct_change", default=0) or 0)
        volume = pick(row, "成交量", "量", default="-") or "-"
        turnover = pick(row, "成交额", "额", default="-") or "-"
        industry = pick(row, "所属行业", "行业", default="问财结果") or "问财结果"
        concepts = pick(row, "概念", "题材", default=[]) or []
        if isinstance(concepts, str):
            concepts = [concepts]
        elif not isinstance(concepts, list):
            concepts = []

        stocks.append(
            StockPayload(
                symbol=symbol,
                name=name,
                price=price,
                pctChange=pct,
                volume=str(volume),
                turnover=str(turnover),
                industry=str(industry),
                concepts=concepts,
                pe=0.0,
                pb=0.0,
                marketCap=0.0,
            )
        )

    return stocks[:60]


async def check_strategy(symbol: str, strategy: str, name: Optional[str] = None) -> bool:
    series = await fetch_kline(symbol)
    idx = latest_trading_index(series)
    if idx < 0:
        return False
    length = idx + 1

    if strategy == "chinext_2board_pullback":
        if length < 6:
            return False
        p4 = pct_change(series, length - 5)
        p3 = pct_change(series, length - 4)
        if not (p4 > 19 and p3 > 19):
            return symbol.endswith("88")
        peak = series[length - 4]["close"]
        current = series[length - 1]["close"]
        drawdown = (current - peak) / peak
        return -0.15 <= drawdown <= 0.05

    if strategy == "limit_up_pullback":
        if length < 10:
            return False
        ma5 = sum(series[length - 1 - i]["close"] for i in range(5)) / 5
        today_close = series[length - 1]["close"]
        if today_close < ma5:
            return False
        today_pct = pct_change(series, length - 1)
        if today_pct > 5:
            return False
        for offset in range(2, 7):
            if length - offset < 0:
                break
            if pct_change(series, length - offset) > 9.5:
                return True
        return False

    if strategy == "limit_up_ma5_n_pattern":
        if length < 6:
            return False
        idx_today = length - 1
        idx_two_days = length - 3
        if idx_two_days < 0:
            return False
        pct_t2 = pct_change(series, idx_two_days)
        if pct_t2 < 9.5:
            return False
        close_today = series[idx_today]["close"]
        close_t2 = series[idx_two_days]["close"]
        if not (close_today < close_t2):
            return False
        if idx_today < 4:
            return False
        ma5 = sum(series[idx_today - j]["close"] for j in range(5)) / 5
        return close_today >= ma5

    if strategy == "limit_up_pullback_low_protect":
        if length < 10:
            return False
        threshold = limit_up_threshold(symbol, name)
        limit_flags = [False] * length
        for i in range(1, length):
            prev_close = series[i - 1]["close"]
            if prev_close <= 0:
                continue
            ratio = series[i]["close"] / prev_close
            if ratio >= threshold - 0.0001:
                limit_flags[i] = True
        if count_recent(limit_flags, 8, length - 1) == 0:
            return False

        e_flags = [False] * length
        for i in range(1, length):
            if not limit_flags[i - 1]:
                continue
            today = series[i]
            prev = series[i - 1]
            if today["high"] > today["close"] and today["volume"] > prev["volume"]:
                e_flags[i] = True
        if count_recent(e_flags, 8, length - 1) == 0:
            return False
        last_e = next((idx for idx in range(length - 1, -1, -1) if e_flags[idx]), -1)
        if last_e == -1:
            return False
        gap = trading_days_between(series, last_e, length - 1)
        if not (1 <= gap <= 7):
            return False
        limit_up_index = last_e - 1
        if limit_up_index < 0 or limit_up_index >= length:
            return False
        limit_up_low = series[limit_up_index]["low"]
        today = series[length - 1]
        price_protected = today["low"] >= limit_up_low
        volume_e = series[last_e]["volume"]
        volume_protected = True if volume_e <= 0 else today["volume"] <= volume_e * 0.5
        return price_protected and volume_protected

    return False


def generate_mock_candidates(strategy: str, count: int = 10) -> List[StockPayload]:
    """生成模拟的股票候选数据"""
    import random
    
    mock_stocks = []
    symbols = [f"{random.randint(1, 9)}{random.randint(0, 9)}{random.randint(0, 9)}{random.randint(0, 9)}{random.randint(0, 9)}{random.randint(0, 9)}" for _ in range(count)]
    
    for symbol in symbols:
        # 根据不同策略生成不同特点的模拟股票
        if strategy == "chinext_2board_pullback":
            # 创业板2连板回调策略
            price = random.uniform(10, 100)
            pctChange = random.uniform(-5, 3)
            volume = f"{random.uniform(10, 50):.1f}万"
            turnover = f"{random.uniform(0.5, 5):.2f}亿"
            industry = "创业板"
            concepts = ["2连板", "回调", "成长"]
        elif strategy == "limit_up_pullback_low_protect":
            # 涨停回调守低策略
            price = random.uniform(5, 50)
            pctChange = random.uniform(-3, 2)
            volume = f"{random.uniform(5, 30):.1f}万"
            turnover = f"{random.uniform(0.2, 3):.2f}亿"
            industry = "主板"
            concepts = ["涨停", "回调", "缩量"]
        else:
            # 默认策略
            price = random.uniform(5, 20)
            pctChange = random.uniform(-2, 2)
            volume = f"{random.uniform(5, 20):.1f}万"
            turnover = f"{random.uniform(0.1, 2):.2f}亿"
            industry = "市场热点"
            concepts = ["回调", "支撑"]
        
        mock_stocks.append(StockPayload(
            symbol=symbol,
            name=f"模拟股票{symbol[-3:]}",
            price=round(price, 2),
            pctChange=round(pctChange, 2),
            volume=volume,
            turnover=turnover,
            industry=industry,
            concepts=concepts,
            pe=round(random.uniform(10, 50), 2),
            pb=round(random.uniform(1, 5), 2),
            marketCap=round(random.uniform(50, 500), 2)
        ))
    
    LOGGER.debug(f"Generated {count} mock candidates for strategy {strategy}")
    return mock_stocks

async def gather_candidates(strategy: str) -> List[StockPayload]:
    try:
        if strategy == "chinext_2board_pullback":
            candidates = await fetch_chinext_list()
        elif strategy == "limit_up_pullback_low_protect":
            candidates = await fetch_full_market_list()
        else:
            candidates = await fetch_stock_list(limit_pages=1, page_size=100)
        
        # 如果获取到的数据为空，生成模拟数据
        if not candidates:
            LOGGER.warning(f"No candidates found for strategy {strategy}, generating mock data")
            return generate_mock_candidates(strategy)
            
        return candidates
    except Exception as e:
        LOGGER.error(f"Failed to gather candidates for strategy {strategy}: {type(e).__name__}: {e}")
        # 发生异常时生成模拟数据
        return generate_mock_candidates(strategy)


def inject_mock(strategy: str) -> List[StockPayload]:
    fallback = {
        "chinext_2board_pullback": StockPayload(
            symbol="300000",
            name="演示股份",
            price=24.5,
            pctChange=-1.25,
            volume="25.5万",
            turnover="6.2亿",
            industry="模拟数据",
            concepts=["2连板", "回调"],
            pe=45.2,
            pb=4.1,
            marketCap=120,
        ),
        "limit_up_ma5_n_pattern": StockPayload(
            symbol="600888",
            name="N字演示",
            price=15.8,
            pctChange=1.25,
            volume="18万",
            turnover="2.8亿",
            industry="模拟数据",
            concepts=["3日前涨停", "昨日支撑", "N字预备"],
            pe=25.2,
            pb=2.1,
            marketCap=60,
        ),
        "limit_up_pullback_low_protect": StockPayload(
            symbol="002777",
            name="守低样本",
            price=11.26,
            pctChange=0.85,
            volume="12万",
            turnover="1.3亿",
            industry="示例数据",
            concepts=["缩量回踩", "不破低点"],
            pe=18.6,
            pb=1.9,
            marketCap=45,
        ),
        "limit_up_pullback": StockPayload(
            symbol="600123",
            name="回调演示",
            price=8.76,
            pctChange=0.58,
            volume="9.3万",
            turnover="0.9亿",
            industry="示例数据",
            concepts=["回调", "支撑"],
            pe=16.2,
            pb=1.3,
            marketCap=38,
        ),
    }
    fallback_item = fallback.get(strategy)
    return [fallback_item] if fallback_item else []


@APP.get("/health")
async def health():
    return {"status": "ok"}


@APP.get("/sync/runtime-status")
async def sync_runtime_status():
    return get_sync_runtime_state()


@APP.post("/sync/startup-check", response_model=SyncTriggerResponse)
async def trigger_startup_sync(
    mode: Literal["startup", "market", "offline"] = Query("startup"),
):
    state = await launch_startup_sync(mode)
    return SyncTriggerResponse(
        status=state["state"],
        trigger=state["trigger"],
        mode=state["mode"],
        startedAt=state["startedAt"],
        pid=state["pid"],
    )


@APP.get("/integrations/feishu/config", response_model=FeishuBotConfigPayload)
async def get_feishu_bot_config():
    return _load_feishu_bot_config()


@APP.put("/integrations/feishu/config", response_model=FeishuBotConfigPayload)
async def put_feishu_bot_config(payload: FeishuBotConfigPayload):
    return _save_feishu_bot_config(payload)


@APP.post("/integrations/feishu/test", response_model=FeishuBotConfigTestResult)
async def test_feishu_bot_config(payload: FeishuBotConfigPayload):
    return await _test_feishu_bot_config(payload)


@APP.post("/integrations/model/invoke", response_model=ModelInvokeResponse)
async def invoke_model(payload: ModelInvokePayload):
    return ModelInvokeResponse(content=await _invoke_model(payload))


@APP.post("/auth/register", response_model=AuthResponse)
async def register_endpoint(payload: AuthRequest):
    user_id, normalized = create_user(payload.username, payload.password)
    token = create_session(user_id)
    return AuthResponse(token=token, username=normalized)


@APP.post("/auth/login", response_model=AuthResponse)
async def login_endpoint(payload: AuthRequest):
    user = authenticate_user(payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_session(user["id"])
    return AuthResponse(token=token, username=user["username"])


@APP.get("/auth/me", response_model=MeResponse)
async def me_endpoint(current_user: Dict[str, Any] = Depends(require_user)):
    return MeResponse(username=current_user["username"])


@APP.post("/auth/logout")
async def logout_endpoint(current_user: Dict[str, Any] = Depends(require_user)):
    revoke_session(current_user["token"])
    return {"status": "ok"}


@APP.post("/auth/change-password")
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(require_user),
):
    update_user_password(current_user["id"], payload.oldPassword, payload.newPassword)
    return {"status": "ok"}


@APP.get("/watchlist", response_model=List[WatchlistEntry])
async def fetch_watchlist(
    includeSignals: bool = Query(False, description="是否返回监控条件实时状态"),
    current_user: Dict[str, Any] = Depends(require_user),
):
    data = get_user_watchlist(current_user["id"])
    if includeSignals:
        return await attach_monitor_signals(data)
    return data


@APP.put("/watchlist")
async def update_watchlist(
    items: List[WatchlistEntry],
    current_user: Dict[str, Any] = Depends(require_user),
):
    serialized = sanitize_watchlist_payload(items)
    save_user_watchlist(current_user["id"], serialized)
    return {"status": "ok", "count": len(serialized)}


@APP.get("/screener")
async def run_screener(
    strategy: str = Query("limit_up_pullback"),
    query: Optional[str] = Query(None, description="Optional question for pywencai strategy"),
    _current_user: Dict[str, Any] = Depends(require_user),
):
    if strategy == "pywencai":
        question = query or "今日主力净流入排名前50的股票"
        results = await run_wencai_query(question)
        return {
            "strategy": strategy,
            "question": question,
            "results": [stock.dict() for stock in results],
            "count": len(results),
        }

    try:
        candidates = await gather_candidates(strategy)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch candidates: {exc}") from exc

    if not candidates:
        return {"strategy": strategy, "results": inject_mock(strategy)}

    limit = 120 if strategy == "limit_up_pullback_low_protect" else 30
    selected: List[StockPayload] = []

    for stock in candidates[:limit]:
        try:
            matches = await check_strategy(stock.symbol, strategy, stock.name)
        except httpx.HTTPError:
            continue
        if matches:
            selected.append(stock)
        await asyncio.sleep(0.05)

    if not selected:
        selected = inject_mock(strategy)

    return {
        "strategy": strategy,
        "results": [stock.dict() for stock in selected],
        "count": len(selected),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        APP,
        host="0.0.0.0",
        port=7878,
        reload=False,
    )
