from __future__ import annotations

import asyncio
import json
from pathlib import Path

from data_paths import SYSTEM_DIR
from server.modules.eastmoney_refresh import warm_eastmoney_datasets


OUTPUT_PATH = SYSTEM_DIR / "eastmoney_refresh_last_run.json"


async def main() -> None:
    result = await warm_eastmoney_datasets(trigger="script")
    OUTPUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    Path(SYSTEM_DIR).mkdir(parents=True, exist_ok=True)
    asyncio.run(main())
