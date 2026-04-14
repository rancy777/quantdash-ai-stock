from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"


def _load_items(file_path: Path) -> List[Dict]:
    if not file_path.exists():
        return []
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception:
        return []


def append_news_item(file_name: str, item: Dict, max_items: int = 200) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_path = DATA_DIR / file_name
    items = _load_items(file_path)
    deduped = [row for row in items if row.get("id") != item.get("id")]
    deduped.insert(0, item)
    deduped.sort(key=lambda row: row.get("createdAt", ""), reverse=True)
    file_path.write_text(
        json.dumps(deduped[:max_items], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
