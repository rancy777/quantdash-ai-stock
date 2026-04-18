import os
from datetime import datetime
from typing import Any, Dict, List, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException

from server.models import (
    FeishuBotConfigPayload,
    FeishuBotConfigTestResult,
    ModelInvokePayload,
    ModelInvokeResponse,
)
from server.modules.auth import require_user
from server.shared import runtime


ROUTER = APIRouter(tags=["integrations"])
ENV_LOCAL_PATH = runtime.ROOT_DIR / ".env.local"
PYWENCAI_COOKIE_ENV_KEYS = ("PYWENCAI_COOKIE", "WENCAI_COOKIE")
FEISHU_ENV_KEY_MAP = {
    "appId": "FEISHU_APP_ID",
    "appSecret": "FEISHU_APP_SECRET",
    "verificationToken": "FEISHU_BOT_VERIFICATION_TOKEN",
    "aiBaseUrl": "FEISHU_BOT_AI_BASE_URL",
    "aiApiKey": "FEISHU_BOT_AI_API_KEY",
    "aiModel": "FEISHU_BOT_AI_MODEL",
}
FEISHU_SECRET_FIELDS = {"appSecret", "verificationToken", "aiApiKey"}


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


def load_feishu_bot_config() -> FeishuBotConfigPayload:
    env_map = _parse_env_local_map()
    payload: Dict[str, str] = {}
    for field_name, env_key in FEISHU_ENV_KEY_MAP.items():
        payload[field_name] = env_map.get(env_key, os.environ.get(env_key, ""))
    return FeishuBotConfigPayload(**payload)


def _mask_secret(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        return ""
    visible_suffix = trimmed[-4:] if len(trimmed) > 4 else ""
    return f"{'*' * max(8, min(len(trimmed), 12))}{visible_suffix}"


def _mask_feishu_bot_config(payload: FeishuBotConfigPayload) -> FeishuBotConfigPayload:
    data = payload.model_dump()
    for field_name in FEISHU_SECRET_FIELDS:
        data[field_name] = _mask_secret(str(data.get(field_name, "")))
    return FeishuBotConfigPayload(**data)


def _resolve_secret_update(submitted: str, current: str) -> str:
    normalized_submitted = submitted.strip()
    normalized_current = current.strip()
    if normalized_current and normalized_submitted == _mask_secret(normalized_current):
        return normalized_current
    return normalized_submitted


def _merge_masked_feishu_payload(payload: FeishuBotConfigPayload) -> FeishuBotConfigPayload:
    current = load_feishu_bot_config()
    data = payload.model_dump()
    current_data = current.model_dump()

    for field_name in FEISHU_SECRET_FIELDS:
        data[field_name] = _resolve_secret_update(
            str(data.get(field_name, "")),
            str(current_data.get(field_name, "")),
        )

    return FeishuBotConfigPayload(**data)


def save_feishu_bot_config(payload: FeishuBotConfigPayload) -> FeishuBotConfigPayload:
    normalized_payload = _merge_masked_feishu_payload(payload)
    updates = {
        env_key: getattr(normalized_payload, field_name, "").strip()
        for field_name, env_key in FEISHU_ENV_KEY_MAP.items()
    }
    _write_env_local_updates(updates)
    return load_feishu_bot_config()


def _load_env_value(*keys: str) -> str:
    env_map = _parse_env_local_map()
    for key in keys:
        value = env_map.get(key, os.environ.get(key, "")).strip()
        if value:
            return value
    return ""


def load_pywencai_cookie() -> str:
    return _load_env_value(*PYWENCAI_COOKIE_ENV_KEYS)


def _build_feishu_test_result(
    kind: Literal["success", "warning", "error"],
    status_label: str,
    detail: str,
) -> FeishuBotConfigTestResult:
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


async def invoke_model_proxy(payload: ModelInvokePayload) -> str:
    base_url = payload.baseUrl.strip().rstrip("/")
    model = payload.model.strip()
    api_key = payload.apiKey.strip()
    system_prompt = payload.systemPrompt.strip()
    user_prompt = payload.userPrompt.strip()

    if not base_url or not model or not user_prompt:
        raise HTTPException(status_code=400, detail="模型调用缺少 baseUrl、model 或 userPrompt。")

    try:
        if payload.protocol == "anthropic":
            response = await runtime.CLIENT.post(
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
            response = await runtime.CLIENT.post(
                f"{base_url}/v1beta/models/{model}:generateContent",
                params={"key": api_key},
                headers={"content-type": "application/json"},
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": "\n\n".join(filter(None, [system_prompt, user_prompt]))}],
                        }
                    ]
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
        response = await runtime.CLIENT.post(
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


async def test_feishu_bot_config_payload(payload: FeishuBotConfigPayload) -> FeishuBotConfigTestResult:
    normalized_payload = _merge_masked_feishu_payload(payload)
    app_id = normalized_payload.appId.strip()
    app_secret = normalized_payload.appSecret.strip()
    if not app_id or not app_secret:
        return _build_feishu_test_result("warning", "缺少飞书凭证", "请先填写 FEISHU_APP_ID 和 FEISHU_APP_SECRET。")

    try:
        response = await runtime.CLIENT.post(
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
        return _build_feishu_test_result("error", "飞书鉴权失败", _format_proxy_exception(exc))

    ai_base_url = normalized_payload.aiBaseUrl.strip().rstrip("/")
    ai_model = normalized_payload.aiModel.strip()
    ai_api_key = normalized_payload.aiApiKey.strip()
    if not ai_base_url or not ai_model:
        return _build_feishu_test_result(
            "success",
            "飞书凭证可用",
            "飞书 App 鉴权通过。AI 模型参数未填写完整，机器人将退回本地兜底分析。",
        )

    try:
        response = await runtime.CLIENT.post(
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
            f"飞书 App 鉴权已通过，但 AI 接口测试失败: {_format_proxy_exception(exc)}",
        )

    return _build_feishu_test_result("success", "飞书与 AI 均可用", "飞书 App 鉴权通过，AI 接口也已返回有效响应。")


@ROUTER.get("/integrations/feishu/config", response_model=FeishuBotConfigPayload)
async def get_feishu_bot_config(_current_user: Dict[str, Any] = Depends(require_user)):
    return _mask_feishu_bot_config(load_feishu_bot_config())


@ROUTER.put("/integrations/feishu/config", response_model=FeishuBotConfigPayload)
async def put_feishu_bot_config(
    payload: FeishuBotConfigPayload,
    _current_user: Dict[str, Any] = Depends(require_user),
):
    return _mask_feishu_bot_config(save_feishu_bot_config(payload))


@ROUTER.post("/integrations/feishu/test", response_model=FeishuBotConfigTestResult)
async def test_feishu_bot_config(
    payload: FeishuBotConfigPayload,
    _current_user: Dict[str, Any] = Depends(require_user),
):
    return await test_feishu_bot_config_payload(payload)


@ROUTER.post("/integrations/model/invoke", response_model=ModelInvokeResponse)
async def invoke_model(
    payload: ModelInvokePayload,
    _current_user: Dict[str, Any] = Depends(require_user),
):
    return ModelInvokeResponse(content=await invoke_model_proxy(payload))
