from __future__ import annotations

import asyncio
import json
import os
import socket
from datetime import datetime

import httpx

from data_paths import SYSTEM_DIR


TARGETS = [
    "https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f104,f105,f106&secids=1.000001,0.399001&ut=bd1d9ddb04089700cf9c27f6f7426281",
    "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000001&fields1=f1&fields2=f51,f52,f53,f54,f55,f57&klt=101&fqt=1&end=20500101&lmt=10",
    "https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=10&sort=fbt%3Aasc&date=20260417",
]
OUTPUT_PATH = SYSTEM_DIR / "eastmoney_network_diagnostics.json"


async def probe_url(url: str, *, trust_env: bool) -> dict[str, object]:
    result: dict[str, object] = {"trustEnv": trust_env, "url": url}
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            headers={
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://quote.eastmoney.com/",
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/123.0.0.0 Safari/537.36"
                ),
            },
            timeout=httpx.Timeout(10.0, connect=5.0),
            trust_env=trust_env,
        ) as client:
            response = await client.get(url)
            result["statusCode"] = response.status_code
            result["ok"] = response.is_success
            result["contentType"] = response.headers.get("content-type")
            result["sample"] = response.text[:160]
    except Exception as exc:
        result["ok"] = False
        result["error"] = repr(exc)
    return result


def resolve_dns(hostname: str) -> dict[str, object]:
    try:
        infos = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
        addresses = sorted({item[4][0] for item in infos})
        return {"host": hostname, "ok": True, "addresses": addresses}
    except Exception as exc:
        return {"host": hostname, "ok": False, "error": repr(exc)}


async def main() -> None:
    SYSTEM_DIR.mkdir(parents=True, exist_ok=True)
    diagnostics = {
        "generatedAt": datetime.utcnow().isoformat(),
        "env": {
            "HTTP_PROXY": os.environ.get("HTTP_PROXY"),
            "HTTPS_PROXY": os.environ.get("HTTPS_PROXY"),
            "ALL_PROXY": os.environ.get("ALL_PROXY"),
            "NO_PROXY": os.environ.get("NO_PROXY"),
        },
        "dns": [
            resolve_dns("push2.eastmoney.com"),
            resolve_dns("push2his.eastmoney.com"),
            resolve_dns("push2ex.eastmoney.com"),
            resolve_dns("datacenter-web.eastmoney.com"),
        ],
        "probes": [],
    }

    for url in TARGETS:
        diagnostics["probes"].append(await probe_url(url, trust_env=False))
        diagnostics["probes"].append(await probe_url(url, trust_env=True))

    OUTPUT_PATH.write_text(json.dumps(diagnostics, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(diagnostics, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
