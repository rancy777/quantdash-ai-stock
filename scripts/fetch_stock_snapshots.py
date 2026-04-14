from __future__ import annotations

import sys
import time
from typing import Any, Dict, List

from data_fetch_utils import fetch_with_fallbacks, now_millis, save_json


STOCK_LIST_PAGE_SIZE = 500
CONCEPT_BOARD_PAGE_SIZE = 100


def build_stock_list_url(page: int, fs_query: str, fields: str, size: int = STOCK_LIST_PAGE_SIZE) -> str:
    return (
        "https://push2.eastmoney.com/api/qt/clist/get"
        f"?pn={page}&pz={size}&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        f"&fs={fs_query}&fields={fields}&_={now_millis()}"
    )


def map_stock_from_item(
    item: Dict[str, Any],
    default_industry: str = "A股",
    default_concepts: List[str] | None = None,
) -> Dict[str, Any]:
    concepts = default_concepts or [
        item.get("f100") if item.get("f100") not in (None, "-") else default_industry
    ]
    volume = item.get("f5")
    turnover = item.get("f6")
    market_cap = item.get("f20")
    return {
        "symbol": str(item.get("f12", "")),
        "name": item.get("f14", ""),
        "price": 0 if item.get("f2") == "-" else float(item.get("f2") or 0),
        "pctChange": 0 if item.get("f3") == "-" else float(item.get("f3") or 0),
        "volume": "0" if volume == "-" else f"{(float(volume or 0) / 10000):.1f}万",
        "turnover": "0" if turnover == "-" else f"{(float(turnover or 0) / 100000000):.2f}亿",
        "industry": item.get("f100") if item.get("f100") not in (None, "-") else default_industry,
        "concepts": concepts,
        "pe": 0 if item.get("f9") == "-" else float(item.get("f9") or 0),
        "pb": 0 if item.get("f23") == "-" else float(item.get("f23") or 0),
        "marketCap": 0 if market_cap == "-" else round(float(market_cap or 0) / 100000000),
    }


def fetch_paged_stocks(
    *,
    fs_query: str,
    fields: str,
    mapper,
    max_pages: int = 30,
) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        payload = fetch_with_fallbacks(build_stock_list_url(page, fs_query, fields))
        diff = payload.get("data", {}).get("diff", [])
        if not isinstance(diff, list) or not diff:
            break
        rows.extend(mapper(item) for item in diff)
        total = int(payload.get("data", {}).get("total") or 0)
        total_pages = (total + STOCK_LIST_PAGE_SIZE - 1) // STOCK_LIST_PAGE_SIZE if total > 0 else None
        if (total_pages and page >= total_pages) or (not total_pages and len(diff) < STOCK_LIST_PAGE_SIZE):
            break
        time.sleep(0.08)
    return rows


def fetch_concept_board_list() -> List[Dict[str, Any]]:
    url = (
        "https://push2.eastmoney.com/api/qt/clist/get"
        "?pn=1&pz=500&po=1&np=1"
        "&ut=bd1d9ddb04089700cf9c27f6f7426281"
        "&fltt=2&invt=2&fid=f3"
        f"&fs=m:90+t:2+f:!50&fields=f12,f14&_={now_millis()}"
    )
    payload = fetch_with_fallbacks(url)
    diff = payload.get("data", {}).get("diff", [])
    return diff if isinstance(diff, list) else []


def fetch_concept_board_members(board_code: str, board_name: str) -> List[str]:
    symbols: List[str] = []
    for page in range(1, 200):
        url = (
            "https://push2.eastmoney.com/api/qt/clist/get"
            f"?pn={page}&pz={CONCEPT_BOARD_PAGE_SIZE}&po=1&np=1"
            "&ut=bd1d9ddb04089700cf9c27f6f7426281"
            "&fltt=2&invt=2&fid=f3"
            f"&fs=b:{board_code}+f:!50&fields=f12&_={now_millis()}"
        )
        payload = fetch_with_fallbacks(url)
        diff = payload.get("data", {}).get("diff", [])
        if not isinstance(diff, list) or not diff:
            break

        batch = [str(item.get("f12", "")) for item in diff if item.get("f12")]
        symbols.extend(batch)

        total = int(payload.get("data", {}).get("total") or 0)
        total_pages = (
            (total + CONCEPT_BOARD_PAGE_SIZE - 1) // CONCEPT_BOARD_PAGE_SIZE
            if total > 0
            else None
        )
        if (total_pages and page >= total_pages) or len(diff) < CONCEPT_BOARD_PAGE_SIZE:
            break

        time.sleep(0.05)

    deduped: List[str] = []
    seen: set[str] = set()
    for symbol in symbols:
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        deduped.append(symbol)
    print(f"[stocks-py] concept {board_name} -> {len(deduped)} symbols")
    return deduped


def build_stock_concept_map() -> Dict[str, List[str]]:
    print("[stocks-py] Fetching concept board membership from EastMoney...")
    try:
        concept_boards = fetch_concept_board_list()
    except Exception as error:
        print(f"[stocks-py] Failed to fetch concept board list: {error}")
        return {}
    concept_map: Dict[str, List[str]] = {}

    for index, board in enumerate(concept_boards, start=1):
        board_code = str(board.get("f12", "")).strip()
        board_name = str(board.get("f14", "")).strip()
        if not board_code or not board_name:
            continue

        try:
            symbols = fetch_concept_board_members(board_code, board_name)
        except Exception as error:
            print(f"[stocks-py] Failed to fetch concept members for {board_name}({board_code}): {error}")
            continue

        for symbol in symbols:
            concept_map.setdefault(symbol, []).append(board_name)

        if index % 20 == 0 or index == len(concept_boards):
            print(f"[stocks-py] Processed concept boards {index}/{len(concept_boards)}")
        time.sleep(0.05)

    for symbol, concepts in concept_map.items():
        concept_map[symbol] = sorted(set(concepts))

    return concept_map


def enrich_stock_concepts(stocks: List[Dict[str, Any]], concept_map: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    enriched: List[Dict[str, Any]] = []
    for stock in stocks:
        symbol = str(stock.get("symbol", "")).strip()
        concepts = concept_map.get(symbol) or stock.get("concepts") or [stock.get("industry") or "A股"]
        enriched.append(
            {
                **stock,
                "concepts": concepts,
            }
        )
    return enriched


def main() -> int:
    print("[stocks-py] Fetching stock snapshots...")
    common_fields = "f12,f14,f2,f3,f5,f6,f9,f23,f20,f100"
    concept_map = build_stock_concept_map()
    if not concept_map:
        print("[stocks-py] Concept map unavailable, continuing with industry fallback concepts")
    full_market = fetch_paged_stocks(
        fs_query="m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
        fields=common_fields,
        mapper=lambda item: map_stock_from_item(item),
        max_pages=30,
    )
    chinext = fetch_paged_stocks(
        fs_query="m:0+t:80",
        fields="f12,f14,f2,f3,f5,f6,f9,f23,f20",
        mapper=lambda item: map_stock_from_item(item, "创业板", ["成长", "热门"]),
        max_pages=2,
    )
    full_market = enrich_stock_concepts(full_market, concept_map)
    chinext = enrich_stock_concepts(chinext, concept_map)
    save_json("stock_list_full.json", full_market)
    save_json("stock_list_chinext.json", chinext)
    save_json("stock_concept_map.json", concept_map)
    print(f"[stocks-py] wrote {len(full_market)} full-market rows and {len(chinext)} chinext rows")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pragma: no cover
        print(f"[stocks-py] failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
