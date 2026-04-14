from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Set

from data_fetch_utils import MARKET_DATA_DIR, fetch_with_fallbacks, now_millis, read_json as read_local_json, save_json

RECENT_SENTIMENT_TRADING_DAYS = 22


def format_date(value: datetime) -> str:
    return value.strftime("%Y-%m-%d")


def read_json(file_name: str) -> Any:
    return read_local_json(file_name, None)


def get_trading_dates(end_date: datetime, count: int) -> List[str]:
    dates: List[str] = []
    cursor = end_date
    guard = 0
    while len(dates) < count and guard < 120:
        if cursor.weekday() < 5:
            dates.append(format_date(cursor))
        cursor = cursor - timedelta(days=1)
        guard += 1
    return dates


def fetch_index_klines() -> List[dict[str, Any]]:
    url = (
        "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        "?secid=1.000001&fields1=f1&fields2=f51,f52,f53,f54,f55,f57"
        f"&klt=101&fqt=1&end=20500101&lmt=260&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    klines = payload.get("data", {}).get("klines", [])
    if not isinstance(klines, list):
        return []
    result = []
    for item in klines:
        date, open_price, close_price, high, low, volume = str(item).split(",")[:6]
        result.append(
            {
                "date": date,
                "open": float(open_price),
                "close": float(close_price),
                "high": float(high),
                "low": float(low),
                "volume": float(volume),
            }
        )
    return result


def fetch_limit_pool(date_str: str, pool_type: str) -> List[dict[str, Any]]:
    api_date = date_str.replace("-", "")
    if pool_type == "up":
        url = (
            "https://push2ex.eastmoney.com/getTopicZTPool"
            "?ut=7eea3edcaed734bea9cbfc24409ed989"
            f"&dpt=wz.ztzt&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date={api_date}&_={now_millis()}"
        )
    else:
        url = (
            "https://push2ex.eastmoney.com/getTopicDTPool"
            "?ut=7eea3edcaed734bea9cbfc24409ed989"
            f"&Pageindex=0&pagesize=1000&sort=fbt%3Aasc&date={api_date}&_={now_millis()}"
        )
    payload = fetch_with_fallbacks(url)
    data = payload.get("data") or {}
    pool = data.get("pool", [])
    return pool if isinstance(pool, list) else []


def estimate_rise_count(kline: dict[str, Any] | None, limit_up_count: int, limit_down_count: int) -> int:
    change_pct = ((kline["close"] - kline["open"]) / kline["open"]) * 100 if kline else 0
    derived = 2000 + change_pct * 650 + (limit_up_count - limit_down_count) * 4
    return max(200, min(4500, round(derived)))


def build_rise_count_map_from_klines(target_dates: List[str]) -> Dict[str, int]:
    kline_dir = Path(MARKET_DATA_DIR) / "klines"
    if not kline_dir.exists():
        return {}

    target_set: Set[str] = set(target_dates)
    if not target_set:
        return {}

    rise_counts: Dict[str, int] = {date_str: 0 for date_str in target_dates}
    scanned_files = 0

    for file_path in kline_dir.glob("*.json"):
        if file_path.name == ".gitkeep":
            continue
        try:
            payload = json.loads(file_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        periods = payload.get("periods", {}) if isinstance(payload, dict) else {}
        daily_series = periods.get("101", []) if isinstance(periods, dict) else []
        if not isinstance(daily_series, list) or len(daily_series) < 2:
            continue

        prev_close: float | None = None
        for row in daily_series:
            if not isinstance(row, dict):
                continue
            date_str = str(row.get("date") or "")
            close = row.get("close")
            try:
                close_value = float(close)
            except (TypeError, ValueError):
                prev_close = None
                continue

            if prev_close is not None and date_str in target_set and close_value > prev_close:
                rise_counts[date_str] = rise_counts.get(date_str, 0) + 1

            prev_close = close_value

        scanned_files += 1

    if scanned_files:
        print(f"[market-core-py] Calculated historical rise counts from {scanned_files} kline files")

    return rise_counts


def build_sentiment_entry(
    date_str: str,
    kline_lookup: Dict[str, dict[str, Any]],
    prev_counts: Dict[int, int] | None,
    real_rise_count: int | None = None,
) -> dict[str, Any]:
    print(f"[market-core-py] Fetching sentiment pools for {date_str}")
    try:
        up_pool = fetch_limit_pool(date_str, "up")
    except Exception as exc:
        print(f"[market-core-py] up pool failed for {date_str}: {exc}", file=sys.stderr)
        up_pool = []
    time.sleep(0.08)
    try:
        down_pool = fetch_limit_pool(date_str, "down")
    except Exception as exc:
        print(f"[market-core-py] down pool failed for {date_str}: {exc}", file=sys.stderr)
        down_pool = []
    counts: Dict[int, int] = {}
    for item in up_pool:
        board = int(item.get("lbc") or item.get("boardCount") or 0)
        counts[board] = counts.get(board, 0) + 1
    active_boards = [board for board, count in counts.items() if board > 0 and count > 0]
    max_height = max(active_boards) if active_boards else 0
    sum_rates = 0.0
    stages = 0
    if prev_counts:
        for board in range(2, 15):
            prev_val = prev_counts.get(board, 0)
            curr_val = counts.get(board + 1, 0)
            if prev_val > 0:
                sum_rates += curr_val / prev_val
                stages += 1
    limit_up_count = len(up_pool)
    limit_down_count = len(down_pool)
    derived_rise = real_rise_count if real_rise_count and real_rise_count > 0 else estimate_rise_count(kline_lookup.get(date_str), limit_up_count, limit_down_count)
    value = round((sum_rates / stages) * 10, 2) if stages > 0 else (5 if limit_up_count > 50 else 2)
    time.sleep(0.12)
    return {
        "date": date_str,
        "value": value,
        "height": max_height,
        "limitUpCount": limit_up_count,
        "limitDownCount": limit_down_count,
        "riseCount": derived_rise,
        "rawZt": {"counts": counts, "total": limit_up_count},
    }


def build_sentiment_data() -> List[dict[str, Any]]:
    klines = fetch_index_klines()
    if not klines:
        return []
    trading_dates = [item["date"] for item in klines][-RECENT_SENTIMENT_TRADING_DAYS:]
    rise_count_map = build_rise_count_map_from_klines(trading_dates)
    kline_lookup = {item["date"]: item for item in klines}
    existing = read_json("sentiment.json")
    existing_by_date = {
        item.get("date"): item
        for item in existing
        if isinstance(item, dict) and isinstance(item.get("date"), str)
    } if isinstance(existing, list) else {}
    results: List[dict[str, Any]] = []
    recomputing = False
    for date_str in trading_dates:
        existing_item = existing_by_date.get(date_str)
        has_valid_pool = bool(
            isinstance(existing_item, dict)
            and int(existing_item.get("limitUpCount") or 0) > 0
            and isinstance(existing_item.get("rawZt"), dict)
        )
        if has_valid_pool and not recomputing:
            merged_item = dict(existing_item)
            real_rise = rise_count_map.get(date_str)
            if real_rise and real_rise > 0:
                merged_item["riseCount"] = real_rise
            results.append(merged_item)
            continue
        recomputing = True
        prev_counts = results[-1]["rawZt"]["counts"] if results and results[-1].get("rawZt") else None
        results.append(build_sentiment_entry(date_str, kline_lookup, prev_counts, rise_count_map.get(date_str)))
    return results


def fetch_limit_up_pool(date_str: str) -> List[dict[str, Any]]:
    pool = fetch_limit_pool(date_str, "up")
    return [
        {
            "symbol": str(item.get("c") or item.get("symbol") or ""),
            "name": item.get("n") or item.get("name") or "",
            "boardCount": int(item.get("lbc") or item.get("boardCount") or 0),
            "industry": item.get("hybk") or "",
        }
        for item in pool
    ]


def get_existing_ladder_snapshot() -> dict[str, Any] | None:
    payload = read_json("ladder.json")
    return payload if isinstance(payload, dict) else None


def clone_ladder_items(items: Any) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        return []
    return [dict(item) for item in items if isinstance(item, dict)]


def build_ladder_data() -> dict[str, Any]:
    target_date = format_date(datetime.now())
    trading_dates = get_trading_dates(datetime.now(), 22)
    date_labels = [date[5:] for date in trading_dates]
    board_counts = [
        {"label": "七板以上", "count": 7},
        {"label": "六连板", "count": 6},
        {"label": "五连板", "count": 5},
        {"label": "四连板", "count": 4},
        {"label": "三连板", "count": 3},
        {"label": "二连板", "count": 2},
    ]
    data_matrix: Dict[str, Dict[str, list[dict[str, Any]]]] = {
        row["label"]: {full_date[5:]: [] for full_date in trading_dates}
        for row in board_counts
    }
    existing = get_existing_ladder_snapshot()
    existing_full_dates = existing.get("fullDates") if isinstance(existing, dict) else None
    existing_by_label = {
        row.get("label"): row.get("data", {})
        for row in existing.get("boardCounts", [])
        if isinstance(row, dict) and isinstance(row.get("label"), str)
    } if isinstance(existing, dict) and isinstance(existing.get("boardCounts"), list) else {}

    if isinstance(existing_full_dates, list):
        for row in board_counts:
            label = row["label"]
            row_data = existing_by_label.get(label, {})
            if not isinstance(row_data, dict):
                continue
            for full_date in trading_dates:
                date_label = full_date[5:]
                if date_label in row_data and isinstance(row_data[date_label], list):
                    data_matrix[label][date_label] = clone_ladder_items(row_data[date_label])

    last_snapshot: Dict[int, list[dict[str, Any]]] | None = None
    recompute_from = len(trading_dates)
    for index, full_date in enumerate(trading_dates):
        date_label = full_date[5:]
        if any(data_matrix[row["label"]][date_label] for row in board_counts):
            continue
        recompute_from = index
        break

    if recompute_from > 0:
        previous_label = trading_dates[recompute_from - 1][5:]
        last_snapshot = {
            row["count"]: clone_ladder_items(data_matrix[row["label"]][previous_label])
            for row in board_counts
        }

    for full_date in trading_dates[recompute_from:]:
        print(f"[market-core-py] Fetching ladder pool for {full_date}")
        pool = fetch_limit_up_pool(full_date)
        label = full_date[5:]
        if pool:
            snapshot: Dict[int, list[dict[str, Any]]] = {}
            for stock in pool:
                symbol = stock["symbol"]
                bucket = 7 if stock["boardCount"] >= 7 else stock["boardCount"]
                target_row = next((row for row in board_counts if row["count"] == bucket), board_counts[0])
                data_matrix[target_row["label"]][label].append(
                    {
                        "symbol": symbol,
                        "name": stock["name"],
                        "price": 0,
                        "pctChange": 20 if symbol.startswith(("30", "68")) else 10,
                        "volume": "-",
                        "turnover": "-",
                        "industry": stock["industry"] or "市场热点",
                        "concepts": [stock["industry"] or "连板"],
                        "pe": 0,
                    }
                )
            for row in board_counts:
                snapshot[row["count"]] = [dict(item) for item in data_matrix[row["label"]][label]]
            last_snapshot = snapshot
        elif last_snapshot:
            for row in board_counts:
                fallback_source = 7 if row["count"] == 7 else row["count"] + 1
                fallback = last_snapshot.get(fallback_source, [])
                data_matrix[row["label"]][label] = [
                    {**item, "pctChange": max(float(item.get("pctChange", 0)) - 5, 0)}
                    for item in fallback
                ]
        time.sleep(0.12)

    return {
        "date": target_date,
        "dates": date_labels,
        "fullDates": trading_dates,
        "boardCounts": [
            {
                **row,
                "data": data_matrix[row["label"]],
            }
            for row in board_counts
        ],
    }


def build_performance_entry(current_date: str, next_date: str | None) -> dict[str, Any]:
    if next_date is None:
        last_pool = fetch_limit_up_pool(current_date)
        limit_up_count = len(last_pool)
        return {
            "date": current_date[5:],
            "fullDate": current_date,
            "limitUpCount": limit_up_count,
            "followThroughCount": 0,
            "brokenCount": limit_up_count,
            "successRate": 0,
            "avgBoardGain": 0,
        }

    print(f"[market-core-py] Calculating performance for {current_date}")
    today_pool = fetch_limit_up_pool(current_date)
    next_pool = fetch_limit_up_pool(next_date)
    limit_up_count = len(today_pool)
    if limit_up_count == 0:
        return {
            "date": current_date[5:],
            "fullDate": current_date,
            "limitUpCount": 0,
            "followThroughCount": 0,
            "brokenCount": 0,
            "successRate": 0,
            "avgBoardGain": 0,
        }
    next_map = {item["symbol"]: item["boardCount"] for item in next_pool}
    follow_through = 0
    board_gain = 0
    for stock in today_pool:
        next_board = next_map.get(stock["symbol"])
        if next_board and next_board > stock["boardCount"]:
            follow_through += 1
            board_gain += min(next_board - stock["boardCount"], 3)
    time.sleep(0.06)
    return {
        "date": current_date[5:],
        "fullDate": current_date,
        "limitUpCount": limit_up_count,
        "followThroughCount": follow_through,
        "brokenCount": max(limit_up_count - follow_through, 0),
        "successRate": follow_through / limit_up_count if limit_up_count else 0,
        "avgBoardGain": board_gain / limit_up_count if limit_up_count else 0,
    }


def build_performance_data() -> List[dict[str, Any]]:
    trading_dates = list(reversed(get_trading_dates(datetime.now(), 22)))
    output_dates = trading_dates[-15:]
    existing = read_json("performance.json")
    existing_by_date = {
        item.get("fullDate"): item
        for item in existing
        if isinstance(item, dict) and isinstance(item.get("fullDate"), str)
    } if isinstance(existing, list) else {}

    results: List[dict[str, Any]] = []
    recompute_from = 0
    for index, current_date in enumerate(output_dates):
        if current_date not in existing_by_date:
            recompute_from = max(0, index - 1)
            break
    else:
        if output_dates:
            latest_full_date = output_dates[-1]
            if latest_full_date in existing_by_date:
                recompute_from = max(0, len(output_dates) - 2)

    for index, current_date in enumerate(output_dates):
        if index < recompute_from and current_date in existing_by_date:
            results.append(existing_by_date[current_date])
            continue
        next_date = output_dates[index + 1] if index < len(output_dates) - 1 else None
        results.append(build_performance_entry(current_date, next_date))

    return results


def main() -> int:
    sentiment = build_sentiment_data()
    ladder = build_ladder_data()
    performance = build_performance_data()
    save_json("sentiment.json", sentiment)
    save_json("ladder.json", ladder)
    save_json("performance.json", performance)
    print("[market-core-py] wrote sentiment, ladder, performance")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover
        print(f"[market-core-py] failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
