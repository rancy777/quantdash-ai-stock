from __future__ import annotations

import os
import sys
import time
from typing import Any, Dict, List, Optional

from data_fetch_utils import chunked, fetch_with_fallbacks, now_millis, save_json


SECTOR_BOARD_CONFIG = {
    "concept": {"fs": "m:90+t:2+f:!50", "label": "概念板块"},
    "industry": {"fs": "m:90+t:3+f:!50", "label": "行业板块"},
}

BOARD_TYPE_ALIASES = {
    "all": ("concept", "industry"),
    "全部": ("concept", "industry"),
    "concept": ("concept",),
    "概念": ("concept",),
    "概念板块": ("concept",),
    "industry": ("industry",),
    "行业": ("industry",),
    "行业板块": ("industry",),
}


def resolve_requested_board_types() -> List[str]:
    raw = str(os.environ.get("SECTOR_BOARD_TYPES") or "").strip()
    if not raw:
        return ["concept", "industry"]

    requested: List[str] = []
    for token in [item.strip().lower() for item in raw.split(",") if item.strip()]:
        mapped = BOARD_TYPE_ALIASES.get(token)
        if not mapped:
            raise ValueError(
                "Unsupported SECTOR_BOARD_TYPES value: "
                f"{token}. Use concept, industry, all, 概念, 行业 or 全部."
            )
        for board_type in mapped:
            if board_type not in requested:
                requested.append(board_type)

    return requested or ["concept", "industry"]


def fetch_sector_board_list(board_type: str) -> List[dict[str, Any]]:
    config = SECTOR_BOARD_CONFIG[board_type]
    url = (
        "https://push2.eastmoney.com/api/qt/clist/get"
        "?pn=1&pz=30&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        f"&fs={config['fs']}&fields=f12,f14,f3&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    diff = payload.get("data", {}).get("diff", [])
    return diff if isinstance(diff, list) else []


def fetch_sector_board_history(code: str) -> List[dict[str, Any]]:
    url = (
        "https://push2his.eastmoney.com/api/qt/stock/kline/get"
        f"?secid=90.{code}"
        "&ut=fa5fd1943c7b386f172d6893dbfba10b"
        "&fields1=f1,f2,f3,f4,f5,f6"
        "&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
        f"&klt=101&fqt=0&end=20500101&lmt=10&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    klines = payload.get("data", {}).get("klines", [])
    name = payload.get("data", {}).get("name", code)
    if not isinstance(klines, list):
        return []

    rows: List[dict[str, Any]] = []
    for line in klines:
        parts = str(line).split(",")
        if len(parts) < 9:
            continue
        date = parts[0]
        try:
            pct_change = float(parts[8])
        except ValueError:
            continue
        rows.append({"code": code, "name": name, "pctChange": pct_change, "date": date})
    return rows


def collect_sector_history_rows(board_type: str) -> List[dict[str, Any]]:
    sector_list = fetch_sector_board_list(board_type)
    candidates = sector_list[:24]
    history_rows: List[dict[str, Any]] = []
    for group in chunked(candidates, 6):
        for item in group:
            try:
                history_rows.extend(fetch_sector_board_history(str(item.get("f12", ""))))
            except Exception:
                continue
        time.sleep(0.05)
    return history_rows


def build_sector_rotation_data(history_rows: List[dict[str, Any]]) -> dict[str, Any]:
    ranks = [1, 2, 3, 4, 5, 6, 7, 8]
    grouped_by_date: Dict[str, List[dict[str, Any]]] = {}
    for row in history_rows:
        grouped_by_date.setdefault(row["date"], []).append(row)

    sorted_dates = sorted(grouped_by_date.keys(), reverse=True)[:5]
    dates = [date[5:] for date in sorted_dates]
    data: Dict[str, Dict[int, dict[str, Any]]] = {}
    for index, full_date in enumerate(sorted_dates):
        date_label = dates[index]
        ranked_boards = sorted(
            grouped_by_date.get(full_date, []),
            key=lambda item: (-item["pctChange"], item["name"]),
        )[: len(ranks)]
        data[date_label] = {}
        for rank, item in enumerate(ranked_boards, start=1):
            data[date_label][rank] = {
                "code": item["code"],
                "name": item["name"],
                "pctChange": round(float(item["pctChange"]), 2),
                "rank": rank,
            }
    return {"dates": dates, "ranks": ranks, "data": data}


def build_sector_persistence_data(board_type: str, history_rows: List[dict[str, Any]]) -> Optional[dict[str, Any]]:
    grouped_by_date: Dict[str, List[dict[str, Any]]] = {}
    for row in history_rows:
        grouped_by_date.setdefault(row["date"], []).append(row)

    sorted_dates = sorted(grouped_by_date.keys())[-5:]
    ranked_by_date: List[dict[str, Any]] = []
    for full_date in sorted_dates:
        ranked_boards = sorted(
            grouped_by_date.get(full_date, []),
            key=lambda item: (-item["pctChange"], item["name"]),
        )
        leader = ranked_boards[0] if ranked_boards else None
        if leader:
            ranked_by_date.append(
                {"fullDate": full_date, "rankedBoards": ranked_boards, "leader": leader}
            )

    if not ranked_by_date:
        return None

    top_three_count_map: Dict[str, int] = {}
    for item in ranked_by_date:
        for board in item["rankedBoards"][:3]:
            top_three_count_map[board["name"]] = top_three_count_map.get(board["name"], 0) + 1

    entries: List[dict[str, Any]] = []
    for index, item in enumerate(ranked_by_date):
        leader = item["leader"]
        streak_days = 1
        for cursor in range(index - 1, -1, -1):
            if ranked_by_date[cursor]["leader"]["name"] == leader["name"]:
                streak_days += 1
            else:
                break
        prev_leader = ranked_by_date[index - 1]["leader"] if index > 0 else None
        strength_delta = (
            round(float(leader["pctChange"]) - float(prev_leader["pctChange"]), 2)
            if prev_leader and prev_leader["name"] == leader["name"]
            else None
        )
        entries.append(
            {
                "date": item["fullDate"][5:],
                "leaderName": leader["name"],
                "leaderCode": leader["code"],
                "leaderPctChange": round(float(leader["pctChange"]), 2),
                "streakDays": streak_days,
                "topThreeAppearances": top_three_count_map.get(leader["name"], 1),
                "strengthDelta": strength_delta,
            }
        )

    strongest_repeat = sorted(
        top_three_count_map.items(),
        key=lambda pair: (-pair[1], pair[0]),
    )[0]
    current_entry = entries[-1]
    return {
        "boardType": board_type,
        "currentLeaderName": current_entry["leaderName"],
        "currentLeaderCode": current_entry["leaderCode"],
        "currentLeaderPctChange": current_entry["leaderPctChange"],
        "currentStreakDays": current_entry["streakDays"],
        "currentTopThreeAppearances": current_entry["topThreeAppearances"],
        "strongestRepeatName": strongest_repeat[0],
        "strongestRepeatCount": strongest_repeat[1],
        "entries": entries,
    }


def main() -> int:
    for board_type in resolve_requested_board_types():
        print(f"[sector-py] Fetching {SECTOR_BOARD_CONFIG[board_type]['label']} snapshots...")
        rows = collect_sector_history_rows(board_type)
        rotation = build_sector_rotation_data(rows)
        persistence = build_sector_persistence_data(board_type, rows)
        save_json(f"sector_rotation_{board_type}.json", rotation)
        save_json(f"sector_persistence_{board_type}.json", persistence)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover
        print(f"[sector-py] failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
