from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from server.modules.eastmoney_policy import get_eastmoney_provider_policy  # noqa: E402
from server.modules.eastmoney_secondary import (  # noqa: E402
    get_secondary_provider_health,
    probe_secondary_provider,
)


async def main() -> None:
    policy = get_eastmoney_provider_policy()
    result = {
        "health": get_secondary_provider_health(),
        "policy": policy,
    }

    if policy["secondaryAvailable"]:
        result["probe"] = await probe_secondary_provider()
    else:
        result["probe"] = {
            "available": False,
            "detail": policy["secondaryReason"],
        }

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
