from __future__ import annotations

import json
import time
from http.client import RemoteDisconnected
from pathlib import Path
from typing import Any, Callable, Iterable, List, Optional, Sequence, TypeVar
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from data_paths import A_SHARE_DIR, DATA_DIR, resolve_existing_path, resolve_write_path

ROOT_DIR = Path(__file__).resolve().parent.parent

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"
    ),
    "Accept": "application/json,text/plain,*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

T = TypeVar("T")


def now_millis() -> int:
    return int(time.time() * 1000)


def fetch_json(url: str, timeout: int = 15) -> dict[str, Any]:
    req = Request(url, headers=DEFAULT_HEADERS)
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_with_fallbacks(url: str, timeout: int = 15) -> dict[str, Any]:
    pipelines = [
        url,
        f"https://corsproxy.io/?{quote(url, safe='')}",
        f"https://api.allorigins.win/raw?url={quote(url, safe='')}",
    ]
    last_error: Optional[Exception] = None

    for target in pipelines:
        try:
            return fetch_json(target, timeout=timeout)
        except (
            HTTPError,
            URLError,
            TimeoutError,
            RemoteDisconnected,
            ConnectionResetError,
            OSError,
            json.JSONDecodeError,
        ) as error:
            last_error = error
            time.sleep(0.2)

    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def save_json(file_name: str, payload: Any) -> Path:
    output_path = resolve_write_path(file_name)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_path


def read_json(file_name: str, default: Any = None) -> Any:
    file_path = resolve_existing_path(file_name)
    if not file_path.exists():
        return default
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


MARKET_DATA_DIR = A_SHARE_DIR
SYSTEM_DATA_DIR = DATA_DIR / "system"


def chunked(items: Sequence[T], chunk_size: int) -> List[Sequence[T]]:
    return [items[index:index + chunk_size] for index in range(0, len(items), chunk_size)]


def retry_collect(items: Iterable[T], worker: Callable[[T], Any]) -> list[Any]:
    results: list[Any] = []
    for item in items:
        results.append(worker(item))
    return results
