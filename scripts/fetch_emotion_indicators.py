from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Dict, List

from data_fetch_utils import DATA_DIR, fetch_with_fallbacks, now_millis, save_json

INDEX_CONFIG = {
    "ftseA50": "100.XIN9",
    "nasdaq": "100.NDX",
    "dowJones": "100.DJIA",
    "sp500": "100.SPX",
    "offshoreRmb": "133.USDCNH",
}
INDEX_FUTURES_CONFIG = {
    "IF": {"label": "沪深300", "inner_code": "1000208870"},
    "IC": {"label": "中证500", "inner_code": "1000295095"},
    "IH": {"label": "上证50", "inner_code": "1000295097"},
    "IM": {"label": "中证1000", "inner_code": "1003154509"},
}
OUTPUT_PATH = DATA_DIR / "emotion_indicators.json"
INDEX_FUTURES_OUTPUT_PATH = DATA_DIR / "index_futures_long_short.json"
BULL_BEAR_OUTPUT_PATH = DATA_DIR / "bull_bear_signal.json"
MAX_REASONABLE_ASHARE_PE = 100.0
MAX_REASONABLE_ASHARE_PE_CHANGE_RATIO = 2.0
ASHARE_PE_PAGE_SIZE = 500
ASHARE_PE_MAX_PAGES = 12
FULL_MARKET_PAGE_SIZE = 100
FULL_MARKET_MAX_PAGES = 80
REQUEST_PAUSE_SECONDS = 0.15


def pause_briefly() -> None:
    time.sleep(REQUEST_PAUSE_SECONDS)


def trimmed_mean(values: List[float], trim_ratio: float = 0.1) -> float:
    if not values:
        raise RuntimeError("No values available for trimmed mean")

    ordered = sorted(values)
    trim_count = int(len(ordered) * trim_ratio)
    if trim_count * 2 >= len(ordered):
        trim_count = max(0, (len(ordered) - 1) // 2)
    trimmed = ordered[trim_count: len(ordered) - trim_count] if trim_count else ordered
    if not trimmed:
        trimmed = ordered
    return sum(trimmed) / len(trimmed)


def fetch_index_series(secid: str, limit: int = 12) -> Dict[str, float]:
    url = (
        "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        f"?secid={secid}"
        "&ut=fa5fd1943c7b386f172d6893dbfba10b"
        "&fields1=f1,f2,f3,f4,f5,f6"
        "&fields2=f51,f52,f53,f54,f55,f56,f57,f58"
        f"&klt=101&fqt=0&end=20500101&lmt={limit}&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    klines = payload.get("data", {}).get("klines", [])
    if not isinstance(klines, list):
        raise RuntimeError(f"No kline data for {secid}")

    result: Dict[str, float] = {}
    for item in klines:
        parts = str(item).split(",")
        if len(parts) < 3:
            continue
        date, _, close = parts[:3]
        try:
            close_value = float(close)
        except ValueError:
            continue
        if close_value > 0:
            result[date] = close_value
    return result


def fetch_ashare_average_pe() -> float:
    values: List[float] = []
    for page_number in range(1, ASHARE_PE_MAX_PAGES + 1):
        url = (
            "https://push2.eastmoney.com/api/qt/clist/get"
            f"?pn={page_number}&pz={ASHARE_PE_PAGE_SIZE}&po=1&np=1"
            "&ut=bd1d9ddb04089700cf9c27f6f7426281"
            "&fltt=2&invt=2&fid=f3"
            "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
            f"&fields=f9&_={now_millis()}"
        )
        payload = fetch_with_fallbacks(url)
        rows = payload.get("data", {}).get("diff", [])
        if not isinstance(rows, list):
            raise RuntimeError("No A-share PE data")

        page_values = 0
        for row in rows:
            try:
                pe = float(row.get("f9"))
            except (TypeError, ValueError):
                continue
            if 0 < pe < 5000:
                values.append(pe)
                page_values += 1

        if len(rows) < ASHARE_PE_PAGE_SIZE:
            break
        if page_values == 0 and page_number >= 2:
            break
        pause_briefly()

    if not values:
        raise RuntimeError("No valid A-share PE values")

    return round(trimmed_mean(values), 2)


def normalize_ashare_average_pe(value: float, previous: object) -> float:
    previous_value = float(previous) if isinstance(previous, (int, float)) else None
    if value <= 0 or value > MAX_REASONABLE_ASHARE_PE:
        if previous_value and previous_value > 0:
            print(
                f"[emotion] valuation outlier {value:.2f}, fallback to previous {previous_value:.2f}",
                file=sys.stderr,
            )
            return round(previous_value, 2)
        print(
            f"[emotion] valuation outlier {value:.2f}, clamp to upper bound {MAX_REASONABLE_ASHARE_PE:.2f}",
            file=sys.stderr,
        )
        return round(MAX_REASONABLE_ASHARE_PE, 2)

    if previous_value and previous_value > 0:
        ratio = value / previous_value
        if ratio > MAX_REASONABLE_ASHARE_PE_CHANGE_RATIO or ratio < (1 / MAX_REASONABLE_ASHARE_PE_CHANGE_RATIO):
            print(
                f"[emotion] valuation jump {value:.2f} vs previous {previous_value:.2f}, fallback to previous",
                file=sys.stderr,
            )
            return round(previous_value, 2)

    return round(value, 2)


def fetch_index_futures_main_contract(code: str) -> str:
    url = (
        "https://datacenter-web.eastmoney.com/api/data/v1/get"
        "?reportName=RPT_FUTU_POSITIONCODE"
        "&columns=TRADE_CODE,SECURITY_CODE,IS_MAINCODE"
        f'&filter=(TRADE_CODE%3D%22{code}%22)(IS_MAINCODE%3D%221%22)'
        "&pageNumber=1&pageSize=10"
        "&sortColumns=SECURITY_CODE&sortTypes=-1"
        "&source=WEB&client=WEB"
        f"&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    rows = payload.get("result", {}).get("data", [])
    if not isinstance(rows, list):
        raise RuntimeError("No IF main contract data")

    for row in rows:
        if row.get("IS_MAINCODE") == "1" and isinstance(row.get("SECURITY_CODE"), str):
            return row["SECURITY_CODE"]

    raise RuntimeError(f"No {code} main contract found")


def fetch_single_index_futures_long_short_series(code: str, limit: int = 21) -> dict:
    config = INDEX_FUTURES_CONFIG[code]
    main_contract = fetch_index_futures_main_contract(code)
    url = (
        "https://datacenter-web.eastmoney.com/api/data/v1/get"
        "?reportName=RPT_FUTU_NET_POSITION"
        "&columns=TRADE_DATE,TOTAL_LONG_POSITION,TOTAL_SHORT_POSITION"
        f'&filter=(SECURITY_CODE%3D%22{main_contract}%22)(TYSECURITY_INNER_CODE%3D%22{config["inner_code"]}%22)'
        f"&pageNumber=1&pageSize={limit}"
        "&sortColumns=TRADE_DATE&sortTypes=-1"
        "&source=WEB&client=WEB"
        f"&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    rows = payload.get("result", {}).get("data", [])
    if not isinstance(rows, list):
        raise RuntimeError(f"No {code} long-short data")

    history: List[dict] = []
    for row in rows:
        trade_date = str(row.get("TRADE_DATE", ""))[:10]
        try:
            long_position = float(row.get("TOTAL_LONG_POSITION"))
            short_position = float(row.get("TOTAL_SHORT_POSITION"))
        except (TypeError, ValueError):
            continue
        if trade_date and short_position > 0:
            history.append(
                {
                    "date": trade_date,
                    "longPosition": int(round(long_position)),
                    "shortPosition": int(round(short_position)),
                }
            )

    history = sorted(history, key=lambda item: item["date"])[-12:]
    if not history:
        raise RuntimeError(f"No valid {code} long-short values")

    return {
        "code": code,
        "label": config["label"],
        "mainContract": main_contract,
        "history": history,
    }


def fetch_index_futures_long_short_ratio_series(limit: int = 21) -> Dict[str, float]:
    series = fetch_single_index_futures_long_short_series("IF", limit=limit)
    return {
        item["date"]: round(item["longPosition"] / item["shortPosition"], 4)
        for item in series["history"]
        if item["shortPosition"] > 0
    }


def build_index_futures_rows() -> List[dict]:
    return [fetch_single_index_futures_long_short_series(code) for code in INDEX_FUTURES_CONFIG]


def load_json_file(path: Path) -> object:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def load_market_volume_lookup() -> Dict[str, dict]:
    payload = load_json_file(DATA_DIR / "market_volume_trend.json")
    if not isinstance(payload, list):
        return {}

    lookup: Dict[str, dict] = {}
    for item in payload:
        if not isinstance(item, dict):
            continue
        date = str(item.get("date") or "")
        if not date:
            continue
        full_date = str(item.get("fullDate") or "")
        normalized = full_date if full_date else f"2026-{date}" if len(date) == 5 else date
        lookup[normalized] = item
    return lookup


def fetch_full_market_rows() -> List[dict]:
    rows: List[dict] = []
    for page_number in range(1, FULL_MARKET_MAX_PAGES + 1):
        url = (
            "https://push2.eastmoney.com/api/qt/clist/get"
            f"?pn={page_number}&pz={FULL_MARKET_PAGE_SIZE}&po=1&np=1"
            "&ut=bd1d9ddb04089700cf9c27f6f7426281"
            "&fltt=2&invt=2&fid=f12"
            "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048"
            f"&fields=f3,f6,f12,f14&_={now_millis()}"
        )
        try:
            payload = fetch_with_fallbacks(url)
        except Exception as exc:
            if rows:
                print(
                    f"[emotion] full-market page {page_number} failed, keep partial rows: {exc}",
                    file=sys.stderr,
                )
                break
            raise

        page_rows = payload.get("data", {}).get("diff", [])
        if not isinstance(page_rows, list) or not page_rows:
            break
        rows.extend(item for item in page_rows if isinstance(item, dict))
        if len(page_rows) < FULL_MARKET_PAGE_SIZE:
            break
        pause_briefly()
    if not rows:
        raise RuntimeError("No full-market rows returned for bull bear snapshot")
    return rows


def fetch_limit_pool_meta(date: str, pool_type: str) -> List[dict]:
    api_date = date.replace("-", "")
    url = (
        "https://push2ex.eastmoney.com/getTopicZTPool"
        "?ut=7eea3edcaed734bea9cbfc24409ed989"
        "&dpt=wz.ztzt&Pageindex=0&pagesize=1000&sort=fbt%3Aasc"
        f"&date={api_date}&_={now_millis()}"
    ) if pool_type == "zt" else (
        "https://push2ex.eastmoney.com/getTopicDTPool"
        "?ut=7eea3edcaed734bea9cbfc24409ed989"
        "&Pageindex=0&pagesize=1000&sort=fbt%3Aasc"
        f"&date={api_date}&_={now_millis()}"
    )

    payload = fetch_with_fallbacks(url)
    data = payload.get("data")
    if not isinstance(data, dict):
        return []
    pool = data.get("pool")
    if not isinstance(pool, list):
        return []
    return [
        {
            "symbol": str(item.get("c") or ""),
            "name": str(item.get("n") or ""),
        }
        for item in pool
        if isinstance(item, dict)
    ]


def is_st_stock_name(name: str) -> bool:
    normalized = str(name).upper().replace(" ", "")
    return "ST" in normalized


def safe_float(value: object) -> float | None:
    try:
        if value in (None, "", "-"):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_snapshot_date(date: str) -> str:
    if len(date) == 10 and date.count("-") == 2:
        return date
    if len(date) == 5 and date.count("-") == 1:
        return f"2026-{date}"
    return date


def build_bull_bear_signal_snapshot() -> dict:
    rows = fetch_full_market_rows()
    volume_lookup = load_market_volume_lookup()
    latest_volume_date = sorted(volume_lookup.keys())[-1] if volume_lookup else ""
    latest_date = normalize_snapshot_date(latest_volume_date) if latest_volume_date else ""
    if not latest_date:
        raise RuntimeError("No latest trading date for bull bear snapshot")

    limit_up_pool = fetch_limit_pool_meta(latest_date, "zt")
    limit_down_pool = fetch_limit_pool_meta(latest_date, "dt")
    limit_up_symbols = {item["symbol"] for item in limit_up_pool if item.get("symbol")}
    limit_down_symbols = {item["symbol"] for item in limit_down_pool if item.get("symbol")}

    rise_count = 0
    fall_count = 0
    flat_count = 0
    total_amount = 0.0
    up5_count = 0
    up1_count = 0
    flat_band_count = 0
    down1_count = 0
    down5_count = 0

    for row in rows:
        pct = safe_float(row.get("f3"))
        if pct is None:
            continue
        symbol = str(row.get("f12") or "")
        amount = safe_float(row.get("f6")) or 0.0
        if amount > 0:
            total_amount += amount

        if pct > 0:
            rise_count += 1
        elif pct < 0:
            fall_count += 1
        else:
            flat_count += 1

        if symbol in limit_up_symbols or symbol in limit_down_symbols:
            continue

        if pct >= 5:
            up5_count += 1
        elif pct >= 1:
            up1_count += 1
        elif pct > -1:
            flat_band_count += 1
        elif pct > -5:
            down1_count += 1
        else:
            down5_count += 1

    latest_volume = volume_lookup.get(latest_date, {}) if latest_date else {}
    amount_yi = int(round(float(latest_volume.get("amount") or total_amount / 100000000)))
    amount_change_rate = latest_volume.get("changeRate")
    if not isinstance(amount_change_rate, (int, float)):
        amount_change_rate = None

    limit_down_count = len(limit_down_pool)
    if limit_down_count == 0:
        limit_down_count = sum(
            1 for row in rows
            if (safe_float(row.get("f3")) or 0) <= -9.9
        )

    return {
        "date": latest_date,
        "riseCount": rise_count,
        "fallCount": fall_count,
        "flatCount": flat_count,
        "limitUpCount": len(limit_up_pool),
        "limitDownCount": limit_down_count,
        "naturalLimitUpCount": sum(1 for item in limit_up_pool if not is_st_stock_name(item.get("name", ""))),
        "naturalLimitDownCount": (
            sum(1 for item in limit_down_pool if not is_st_stock_name(item.get("name", "")))
            if limit_down_pool
            else sum(
                1
                for row in rows
                if (safe_float(row.get("f3")) or 0) <= -9.9 and not is_st_stock_name(str(row.get("f14") or ""))
            )
        ),
        "totalAmount": amount_yi,
        "amountChangeRate": amount_change_rate,
        "rangeBuckets": [
            {"label": "涨停", "count": len(limit_up_pool), "tone": "up"},
            {"label": "涨停~5%", "count": up5_count, "tone": "up"},
            {"label": "5~1%", "count": up1_count, "tone": "up"},
            {"label": "平盘", "count": flat_band_count, "tone": "flat"},
            {"label": "0~-1%", "count": down1_count, "tone": "down"},
            {"label": "-1~-5%", "count": down5_count, "tone": "down"},
            {"label": "跌停", "count": limit_down_count, "tone": "down"},
        ],
    }


def save_bull_bear_signal_snapshot(snapshot: dict) -> None:
    payload = load_json_file(BULL_BEAR_OUTPUT_PATH)
    history = payload if isinstance(payload, list) else []
    filtered = [
        item for item in history
        if isinstance(item, dict) and str(item.get("date") or "") != str(snapshot.get("date") or "")
    ]
    filtered.append(snapshot)
    filtered.sort(key=lambda item: str(item.get("date") or ""))
    save_json("bull_bear_signal.json", filtered)


def load_existing_rows() -> Dict[str, dict]:
    if not OUTPUT_PATH.exists():
        return {}
    try:
        payload = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(payload, list):
        return {}
    return {
        str(item.get("date")): item
        for item in payload
        if isinstance(item, dict) and isinstance(item.get("date"), str)
    }


def build_rows() -> List[dict]:
    existing = load_existing_rows()
    series_map = {name: fetch_index_series(secid) for name, secid in INDEX_CONFIG.items()}
    index_futures_long_short_series = fetch_index_futures_long_short_ratio_series()

    shared_dates = sorted(
        set.intersection(
            *(set(series.keys()) for series in series_map.values()),
            set(index_futures_long_short_series.keys()),
        )
    )[-10:]

    rows: List[dict] = []
    latest_shared_date = shared_dates[-1] if shared_dates else None
    previous_latest_row = existing.get(shared_dates[-2], {}) if len(shared_dates) >= 2 else {}
    latest_pe = normalize_ashare_average_pe(
        fetch_ashare_average_pe(),
        previous_latest_row.get("ashareAvgValuation"),
    ) if latest_shared_date else None

    for index, date in enumerate(shared_dates):
        previous = existing.get(date, {})
        valuation = previous.get("ashareAvgValuation")
        if index == len(shared_dates) - 1 or not isinstance(valuation, (int, float)) or valuation <= 0:
            valuation = latest_pe

        rows.append(
            {
                "date": date,
                "ftseA50": round(series_map["ftseA50"][date], 2),
                "nasdaq": round(series_map["nasdaq"][date], 2),
                "dowJones": round(series_map["dowJones"][date], 2),
                "sp500": round(series_map["sp500"][date], 2),
                "offshoreRmb": round(series_map["offshoreRmb"][date], 4),
                "ashareAvgValuation": round(float(valuation), 2),
                "indexFuturesLongShortRatio": round(index_futures_long_short_series[date], 4),
            }
        )

    if not rows:
        raise RuntimeError("No shared dates returned for emotion indicators")

    return rows


def main() -> int:
    rows = build_rows()
    futures_rows = build_index_futures_rows()
    bull_bear_snapshot = build_bull_bear_signal_snapshot()
    save_json("emotion_indicators.json", rows)
    save_json("index_futures_long_short.json", futures_rows)
    save_bull_bear_signal_snapshot(bull_bear_snapshot)
    print(f"[emotion] wrote {len(rows)} rows to {OUTPUT_PATH}")
    print(f"[emotion] wrote {len(futures_rows)} rows to {INDEX_FUTURES_OUTPUT_PATH}")
    print(f"[emotion] updated bull bear snapshot for {bull_bear_snapshot.get('date')} at {BULL_BEAR_OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover
        print(f"[emotion] failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
