from __future__ import annotations

from datetime import date
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException

from server.modules.eastmoney_fetch import fetch_eastmoney_json
from server.modules.eastmoney_policy import should_fallback_to_secondary, should_prefer_secondary
from server.modules.eastmoney_secondary import execute_secondary_action


MAJOR_INDEX_SECID_MAP = {
    "000001": "1.000001",
    "399001": "0.399001",
    "399006": "0.399006",
    "000688": "1.000688",
}
SECTOR_BOARD_FS_MAP = {
    "concept": "m:90+t:2+f:!50",
    "industry": "m:90+t:3+f:!50",
}


def _sanitize_dataset_key(value: str) -> str:
    sanitized = "".join(ch if ch.isalnum() else "_" for ch in value.lower())
    while "__" in sanitized:
        sanitized = sanitized.replace("__", "_")
    return sanitized.strip("_") or "eastmoney_dataset"


def _require_string(params: dict[str, Any], key: str) -> str:
    value = params.get(key)
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(status_code=400, detail=f"缺少必要参数: {key}")
    return value.strip()


def _get_int(params: dict[str, Any], key: str, default: int) -> int:
    value = params.get(key, default)
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"参数 {key} 必须为整数") from exc


def _get_bounded_int(
    params: dict[str, Any],
    key: str,
    default: int,
    *,
    minimum: int,
    maximum: int,
) -> int:
    value = _get_int(params, key, default)
    if value < minimum or value > maximum:
        raise HTTPException(status_code=400, detail=f"参数 {key} 必须在 {minimum}-{maximum} 之间")
    return value


def _symbol_to_secid(symbol: str) -> str:
    normalized = symbol.strip()
    if normalized in MAJOR_INDEX_SECID_MAP:
        return MAJOR_INDEX_SECID_MAP[normalized]
    market = "1" if normalized.startswith("6") else "0"
    return f"{market}.{normalized}"


def _today_compact_date() -> str:
    return date.today().strftime("%Y%m%d")


def _build_stock_kline_url(secid: str, period: int, limit: int) -> str:
    return (
        "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        f"?secid={secid}&fields1=f1&fields2=f51,f52,f53,f54,f55,f57,f58"
        f"&klt={period}&fqt=1&end=20500101&lmt={limit}"
    )


async def _fetch_market_rows(timeout_ms: int, prefer_snapshot: bool, force_refresh: bool) -> dict[str, Any]:
    page_size = 100
    rows: list[Any] = []
    envelopes: list[dict[str, Any]] = []

    for page_number in range(1, 81):
        dataset_key = f"full_market_rows_page_{page_number}"
        url = (
            "https://push2.eastmoney.com/api/qt/clist/get"
            f"?pn={page_number}&pz={page_size}&po=1&np=1"
            "&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f12"
            "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048"
            "&fields=f3,f6,f12,f14"
        )
        envelope = await fetch_eastmoney_json(
            url,
            timeout_ms=timeout_ms,
            dataset_key=dataset_key,
            prefer_snapshot=prefer_snapshot,
            force_refresh=force_refresh,
        )
        page_rows = envelope.get("data", {}).get("data", {}).get("diff")
        if not isinstance(page_rows, list) or not page_rows:
            break
        envelopes.append(envelope)
        rows.extend(page_rows)
        if len(page_rows) < page_size:
            break

    latest_meta = envelopes[-1].get("meta", {}) if envelopes else {}
    return {
        "data": rows,
        "meta": {
            **latest_meta,
            "datasetKey": "full_market_rows",
        },
    }


async def execute_eastmoney_action(
    action: str,
    params: dict[str, Any] | None = None,
    *,
    timeout_ms: int = 8000,
    prefer_snapshot: bool = False,
    force_refresh: bool = False,
) -> dict[str, Any]:
    normalized_params = params or {}

    if should_prefer_secondary(action, normalized_params):
        try:
            return await execute_secondary_action(action, normalized_params)
        except HTTPException:
            pass

    try:
        if action == "major_indexes":
            secids = ",".join(MAJOR_INDEX_SECID_MAP.values())
            url = (
                "https://push2.eastmoney.com/api/qt/ulist.np/get"
                "?fltt=2&invt=2&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20,f100"
                f"&secids={secids}&ut=bd1d9ddb04089700cf9c27f6f7426281"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key="major_indexes",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "stock_list_page":
            page = _get_bounded_int(normalized_params, "page", 1, minimum=1, maximum=200)
            page_size = _get_bounded_int(normalized_params, "pageSize", 100, minimum=1, maximum=200)
            url = (
                "https://push2.eastmoney.com/api/qt/clist/get"
                f"?pn={page}&pz={page_size}&po=1&np=1"
                "&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3"
                "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
                "&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20,f100"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"stock_list_page_{page}_{page_size}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "chinext_list":
            page_size = _get_bounded_int(normalized_params, "pageSize", 50, minimum=1, maximum=200)
            url = (
                "https://push2.eastmoney.com/api/qt/clist/get"
                f"?pn=1&pz={page_size}&po=1&np=1"
                "&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3"
                "&fs=m:0+t:80&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"chinext_list_{page_size}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "stock_kline":
            symbol = str(normalized_params.get("symbol", "")).strip()
            secid = str(normalized_params.get("secid", "")).strip() or _symbol_to_secid(symbol)
            period = _get_bounded_int(normalized_params, "period", 101, minimum=1, maximum=101)
            limit = _get_bounded_int(normalized_params, "limit", 200, minimum=1, maximum=500)
            url = _build_stock_kline_url(secid, period, limit)
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"stock_kline_{_sanitize_dataset_key(secid)}_{period}_{limit}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "index_kline":
            symbol = _require_string(normalized_params, "symbol")
            secid = str(normalized_params.get("secid", "")).strip() or _symbol_to_secid(symbol)
            period = _get_bounded_int(normalized_params, "period", 101, minimum=1, maximum=101)
            limit = _get_bounded_int(normalized_params, "limit", 200, minimum=1, maximum=500)
            url = _build_stock_kline_url(secid, period, limit)
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"index_kline_{_sanitize_dataset_key(secid)}_{period}_{limit}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "sector_board_list":
            board_type = _require_string(normalized_params, "boardType")
            fs = SECTOR_BOARD_FS_MAP.get(board_type)
            if not fs:
                raise HTTPException(status_code=400, detail=f"不支持的 boardType: {board_type}")
            url = (
                "https://push2.eastmoney.com/api/qt/clist/get"
                "?pn=1&pz=30&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281"
                "&fltt=2&invt=2&fid=f3"
                f"&fs={quote(fs, safe='')}&fields=f12,f14,f3"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"sector_board_list_{board_type}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "sector_board_history":
            code = _require_string(normalized_params, "code")
            url = (
                "https://push2his.eastmoney.com/api/qt/stock/kline/get"
                f"?secid=90.{code}&ut=fa5fd1943c7b386f172d6893dbfba10b"
                "&fields1=f1,f2,f3,f4,f5,f6"
                "&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
                "&klt=101&fqt=0&end=20500101&lmt=10"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"sector_board_history_{_sanitize_dataset_key(code)}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action in {"limit_up_pool", "broken_pool", "limit_down_pool"}:
            raw_date = str(normalized_params.get("date", "")).strip().replace("-", "")
            api_date = raw_date or _today_compact_date()
            if action == "limit_up_pool":
                url = (
                    "https://push2ex.eastmoney.com/getTopicZTPool"
                    "?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt"
                    f"&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date={api_date}"
                )
            elif action == "broken_pool":
                url = (
                    "https://push2ex.eastmoney.com/getTopicZBPool"
                    "?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt"
                    f"&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date={api_date}"
                )
            else:
                url = (
                    "https://push2ex.eastmoney.com/getTopicDTPool"
                    "?ut=7eea3edcaed734bea9cbfc24409ed989"
                    f"&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date={api_date}"
                )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"{action}_{api_date}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "market_breadth_overview":
            url = (
                "https://push2.eastmoney.com/api/qt/ulist.np/get"
                "?fltt=2&invt=2&fields=f104,f105,f106"
                "&secids=1.000001,0.399001&ut=bd1d9ddb04089700cf9c27f6f7426281"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key="market_breadth_overview",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "full_market_rows":
            return await _fetch_market_rows(timeout_ms, prefer_snapshot, force_refresh)

        if action == "full_market_pct_snapshot":
            url = (
                "https://push2.eastmoney.com/api/qt/clist/get"
                "?pn=1&pz=6000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281"
                "&fltt=2&invt=2&fid=f12&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
                "&fields=f3"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key="full_market_pct_snapshot",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "emotion_index_series":
            secid = _require_string(normalized_params, "secid")
            limit = _get_bounded_int(normalized_params, "limit", 12, minimum=1, maximum=120)
            url = (
                "https://push2his.eastmoney.com/api/qt/stock/kline/get"
                f"?secid={secid}&ut=fa5fd1943c7b386f172d6893dbfba10b"
                "&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58"
                f"&klt=101&fqt=0&end=20500101&lmt={limit}"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"emotion_index_series_{_sanitize_dataset_key(secid)}_{limit}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "ashare_average_pe":
            url = (
                "https://push2.eastmoney.com/api/qt/clist/get"
                "?pn=1&pz=6000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281"
                "&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
                "&fields=f9"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key="ashare_average_pe",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "index_amount_series":
            secid = _require_string(normalized_params, "secid")
            limit = _get_bounded_int(normalized_params, "limit", 12, minimum=1, maximum=120)
            url = (
                "https://push2his.eastmoney.com/api/qt/stock/kline/get"
                f"?secid={secid}&ut=fa5fd1943c7b386f172d6893dbfba10b"
                "&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58"
                f"&klt=101&fqt=0&end=20500101&lmt={limit}"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"index_amount_series_{_sanitize_dataset_key(secid)}_{limit}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "futures_main_contract":
            code = _require_string(normalized_params, "code")
            filter_expr = quote(f'(TRADE_CODE="{code}")(IS_MAINCODE="1")', safe="")
            url = (
                "https://datacenter-web.eastmoney.com/api/data/v1/get"
                "?reportName=RPT_FUTU_POSITIONCODE&columns=TRADE_CODE,SECURITY_CODE,IS_MAINCODE"
                f"&filter={filter_expr}&pageNumber=1&pageSize=10"
                "&sortColumns=SECURITY_CODE&sortTypes=-1&source=WEB&client=WEB"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"futures_main_contract_{_sanitize_dataset_key(code)}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        if action == "futures_net_position":
            security_code = _require_string(normalized_params, "securityCode")
            inner_code = _require_string(normalized_params, "innerCode")
            limit = _get_int(normalized_params, "limit", 21)
            filter_expr = quote(
                f'(SECURITY_CODE="{security_code}")(TYSECURITY_INNER_CODE="{inner_code}")',
                safe="",
            )
            url = (
                "https://datacenter-web.eastmoney.com/api/data/v1/get"
                "?reportName=RPT_FUTU_NET_POSITION&columns=TRADE_DATE,TOTAL_LONG_POSITION,TOTAL_SHORT_POSITION"
                f"&filter={filter_expr}&pageNumber=1&pageSize={limit}"
                "&sortColumns=TRADE_DATE&sortTypes=-1&source=WEB&client=WEB"
            )
            return await fetch_eastmoney_json(
                url,
                timeout_ms=timeout_ms,
                dataset_key=f"futures_net_position_{_sanitize_dataset_key(security_code)}_{_sanitize_dataset_key(inner_code)}",
                prefer_snapshot=prefer_snapshot,
                force_refresh=force_refresh,
            )

        raise HTTPException(status_code=400, detail=f"不支持的 EastMoney action: {action}")
    except HTTPException:
        if should_fallback_to_secondary(action, normalized_params):
            return await execute_secondary_action(action, normalized_params)
        raise


__all__ = ["execute_eastmoney_action"]
