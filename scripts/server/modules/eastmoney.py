from fastapi import APIRouter, Depends

from server.models import EastmoneyActionPayload, EastmoneyProviderPolicyPayload, EastmoneyProxyPayload
from server.modules.auth import require_user
from server.modules.eastmoney_actions import execute_eastmoney_action
from server.modules.eastmoney_fetch import fetch_eastmoney_json, get_eastmoney_monitor_status
from server.modules.eastmoney_policy import get_eastmoney_provider_policy, save_eastmoney_provider_policy
from server.modules.eastmoney_refresh import get_eastmoney_refresh_state, warm_eastmoney_datasets
from server.modules.eastmoney_secondary import get_secondary_provider_health, probe_secondary_provider


ROUTER = APIRouter(tags=["eastmoney"])


@ROUTER.post("/eastmoney/fetch")
async def proxy_eastmoney_json(payload: EastmoneyProxyPayload):
    return await fetch_eastmoney_json(payload.url, payload.timeoutMs)


@ROUTER.post("/eastmoney/action")
async def run_eastmoney_action(payload: EastmoneyActionPayload):
    return await execute_eastmoney_action(
        payload.action,
        payload.params,
        timeout_ms=payload.timeoutMs,
        prefer_snapshot=payload.preferSnapshot,
        force_refresh=payload.forceRefresh,
    )


@ROUTER.get("/eastmoney/status")
async def eastmoney_status(_current_user=Depends(require_user)):
    return {
        "monitor": get_eastmoney_monitor_status(),
        "providerPolicy": get_eastmoney_provider_policy(),
        "refresh": get_eastmoney_refresh_state(),
        "secondaryHealth": get_secondary_provider_health(),
    }


@ROUTER.get("/eastmoney/provider-policy")
async def eastmoney_provider_policy(_current_user=Depends(require_user)):
    return get_eastmoney_provider_policy()


@ROUTER.put("/eastmoney/provider-policy")
async def update_eastmoney_provider_policy(
    payload: EastmoneyProviderPolicyPayload,
    _current_user=Depends(require_user),
):
    next_mode = payload.globalMode or payload.mode or "primary_only"
    return save_eastmoney_provider_policy(next_mode, payload.datasetOverrides)


@ROUTER.get("/eastmoney/secondary-health")
async def eastmoney_secondary_health(_current_user=Depends(require_user)):
    return get_secondary_provider_health()


@ROUTER.post("/eastmoney/secondary-health/probe")
async def probe_eastmoney_secondary_health(_current_user=Depends(require_user)):
    return await probe_secondary_provider()


@ROUTER.post("/eastmoney/refresh")
async def refresh_eastmoney_snapshots(_current_user=Depends(require_user)):
    return await warm_eastmoney_datasets(trigger="manual")


__all__ = [
    "ROUTER",
    "eastmoney_secondary_health",
    "eastmoney_status",
    "eastmoney_provider_policy",
    "probe_eastmoney_secondary_health",
    "proxy_eastmoney_json",
    "refresh_eastmoney_snapshots",
    "run_eastmoney_action",
    "update_eastmoney_provider_policy",
]
