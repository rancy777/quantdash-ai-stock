from __future__ import annotations

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from data_fetch_utils import MARKET_DATA_DIR, fetch_with_fallbacks, now_millis, save_json
from data_paths import resolve_existing_path


KLINE_DIR = MARKET_DATA_DIR / "klines"
KLINE_PERIODS = [101, 102, 103]
KLINE_CONCURRENCY = max(1, int(os.getenv("KLINE_CONCURRENCY", "5") or "5"))
KLINE_SYMBOL_LIMIT = max(0, int(os.getenv("KLINE_SYMBOL_LIMIT", "0") or "0"))
SKIP_KLINE_DOWNLOAD = os.getenv("SKIP_KLINE_DOWNLOAD") == "1"
KLINE_FORCE_FULL = os.getenv("KLINE_FORCE_FULL") == "1"
KLINE_RECENT_LIMIT = max(22, int(os.getenv("KLINE_RECENT_LIMIT", "30") or "30"))
STOCK_LIST_PAGE_SIZE = 500


def format_date(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


def build_stock_list_url(page: int, size: int = STOCK_LIST_PAGE_SIZE) -> str:
    return (
        "https://push2.eastmoney.com/api/qt/clist/get"
        f"?pn={page}&pz={size}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        "&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
        "&fields=f12,f14"
    )


def load_stock_snapshot() -> List[dict[str, Any]]:
    file_path = resolve_existing_path("stock_list_full.json")
    if not file_path.exists():
        return []
    try:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    if not isinstance(payload, list):
        return []

    stocks: List[dict[str, Any]] = []
    for item in payload:
        symbol = str(item.get("symbol") or item.get("code") or "")
        if not symbol:
            continue
        stocks.append(
            {
                "symbol": symbol,
                "name": item.get("name") or "",
                "market": 1 if symbol.startswith("6") else 0,
            }
        )
    return stocks


def fetch_all_tradable_stocks() -> List[dict[str, Any]]:
    cached = load_stock_snapshot()
    if cached:
        if KLINE_SYMBOL_LIMIT > 0:
            cached = cached[:KLINE_SYMBOL_LIMIT]
        print(f"[kline-py] Loaded {len(cached)} symbols from stock_list_full.json")
        return cached

    print("[kline-py] Fetching tradable stock universe from EastMoney...")
    stock_map: Dict[str, dict[str, Any]] = {}
    page = 1
    while True:
        payload = fetch_with_fallbacks(build_stock_list_url(page))
        stock_list = payload.get("data", {}).get("diff", [])
        if not isinstance(stock_list, list) or not stock_list:
            break

        for item in stock_list:
            symbol = str(item.get("f12") or "")
            if not symbol or symbol in stock_map:
                continue
            stock_map[symbol] = {
                "symbol": symbol,
                "name": item.get("f14") or "",
                "market": 1 if symbol.startswith("6") else 0,
            }

        total = int(payload.get("data", {}).get("total") or 0)
        total_pages = (total + STOCK_LIST_PAGE_SIZE - 1) // STOCK_LIST_PAGE_SIZE if total > 0 else 0
        if KLINE_SYMBOL_LIMIT > 0 and len(stock_map) >= KLINE_SYMBOL_LIMIT:
            break
        if (total_pages and page >= total_pages) or len(stock_list) < STOCK_LIST_PAGE_SIZE:
            break

        page += 1
        time.sleep(0.05)

    stocks = list(stock_map.values())
    if KLINE_SYMBOL_LIMIT > 0:
        stocks = stocks[:KLINE_SYMBOL_LIMIT]
    print(f"[kline-py] Prepared {len(stocks)} symbols for download")
    return stocks


def load_local_kline_file(symbol: str) -> dict[str, Any] | None:
    file_path = KLINE_DIR / f"{symbol}.json"
    if not file_path.exists():
        return None
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def has_all_local_periods(payload: dict[str, Any] | None) -> bool:
    if not payload or not isinstance(payload.get("periods"), dict):
        return False
    return all(
        isinstance(payload["periods"].get(str(period)), list) and payload["periods"][str(period)]
        for period in KLINE_PERIODS
    )


def build_manifest_entry(stock: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "symbol": stock["symbol"],
        "name": payload.get("name") or stock["name"],
        "updated": payload.get("updated"),
        "periods": sorted((payload.get("periods") or {}).keys()),
    }


def partition_stocks_for_sync(stocks: List[dict[str, Any]], today: str) -> tuple[List[dict[str, Any]], List[dict[str, Any]]]:
    pending: List[dict[str, Any]] = []
    manifest: List[dict[str, Any]] = []

    for stock in stocks:
        existing = load_local_kline_file(stock["symbol"])
        if (
            not KLINE_FORCE_FULL
            and existing
            and existing.get("updated") == today
            and has_all_local_periods(existing)
        ):
            manifest.append(build_manifest_entry(stock, existing))
            continue
        pending.append(stock)

    return pending, manifest


def fetch_stock_kline_series(symbol: str, period: int) -> List[dict[str, Any]]:
    market = "1" if symbol.startswith("6") else "0"
    secid = f"{market}.{symbol}"
    url = (
        "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        f"?secid={secid}&fields1=f1&fields2=f51,f52,f53,f54,f55,f57"
        f"&klt={period}&fqt=1&end=20500101&lmt={KLINE_RECENT_LIMIT}&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    klines = payload.get("data", {}).get("klines", [])
    if not isinstance(klines, list):
        return []

    results: List[dict[str, Any]] = []
    for item in klines:
        parts = str(item).split(",")
        if len(parts) < 6:
            continue
        date, open_price, close_price, high, low, volume = parts[:6]
        results.append(
            {
                "date": date,
                "open": float(open_price),
                "close": float(close_price),
                "high": float(high),
                "low": float(low),
                "volume": float(volume),
            }
        )
    return results


def merge_period_series(existing: object, fetched: List[dict[str, Any]]) -> List[dict[str, Any]]:
    merged_by_date: Dict[str, dict[str, Any]] = {}

    if isinstance(existing, list):
        for item in existing:
            if not isinstance(item, dict):
                continue
            date = str(item.get("date") or "")
            if not date:
                continue
            merged_by_date[date] = item

    for item in fetched:
        date = str(item.get("date") or "")
        if not date:
            continue
        merged_by_date[date] = item

    return [merged_by_date[date] for date in sorted(merged_by_date.keys())]


def sync_symbol_kline(stock: dict[str, Any], today: str) -> dict[str, Any] | None:
    existing = load_local_kline_file(stock["symbol"])
    if existing and existing.get("updated") == today and has_all_local_periods(existing):
        return {
            "symbol": stock["symbol"],
            "name": existing.get("name") or stock["name"],
            "updated": existing.get("updated"),
            "periods": sorted(existing.get("periods", {}).keys()),
        }

    periods_payload: Dict[str, List[dict[str, Any]]] = {}
    existing_periods = existing.get("periods", {}) if isinstance(existing, dict) else {}
    for period in KLINE_PERIODS:
        try:
            fetched_series = fetch_stock_kline_series(stock["symbol"], period)
        except Exception as error:
            print(f"[kline-py] Failed to fetch {stock['symbol']} period {period}: {error}")
            fetched_series = []
        merged_series = merge_period_series(existing_periods.get(str(period)), fetched_series)
        if merged_series:
            periods_payload[str(period)] = merged_series
        time.sleep(0.02)

    if not periods_payload:
        return None

    payload = {
        "symbol": stock["symbol"],
        "name": stock["name"],
        "market": stock["market"],
        "updated": today,
        "periods": periods_payload,
    }
    file_path = KLINE_DIR / f"{stock['symbol']}.json"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return {
        "symbol": stock["symbol"],
        "name": stock["name"],
        "updated": today,
        "periods": sorted(periods_payload.keys()),
    }


def build_kline_library() -> int:
    if SKIP_KLINE_DOWNLOAD:
        print("[kline-py] Skipping K-line download because SKIP_KLINE_DOWNLOAD=1")
        return 0

    KLINE_DIR.mkdir(parents=True, exist_ok=True)
    stocks = fetch_all_tradable_stocks()
    if not stocks:
        print("[kline-py] No stocks detected, skipping K-line library generation.")
        return 0

    today = format_date(datetime.now())
    pending_stocks, manifest = partition_stocks_for_sync(stocks, today)
    skipped_count = len(manifest)
    if skipped_count:
        print(f"[kline-py] Reusing {skipped_count} up-to-date symbols")
    if not pending_stocks:
        manifest.sort(key=lambda item: item["symbol"])
        save_json("kline-manifest.json", manifest)
        print(f"[kline-py] All {len(manifest)} symbols are already up-to-date.")
        return 0

    print(
        f"[kline-py] Syncing K-line snapshots for {len(pending_stocks)} pending symbols "
        f"with concurrency {KLINE_CONCURRENCY}..."
    )

    with ThreadPoolExecutor(max_workers=min(KLINE_CONCURRENCY, len(pending_stocks))) as executor:
        futures = {
            executor.submit(sync_symbol_kline, stock, today): stock["symbol"]
            for stock in pending_stocks
        }
        processed = 0
        for future in as_completed(futures):
            entry = future.result()
            if entry:
                manifest.append(entry)
            processed += 1
            if processed % 50 == 0 or processed == len(pending_stocks):
                print(f"[kline-py] Processed {processed}/{len(pending_stocks)} pending symbols")

    manifest.sort(key=lambda item: item["symbol"])
    save_json("kline-manifest.json", manifest)
    print(
        f"[kline-py] Finished syncing {len(pending_stocks)} pending symbols. "
        f"Manifest now covers {len(manifest)} symbols."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(build_kline_library())
    except Exception as exc:  # pragma: no cover
        print(f"[kline-py] failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
