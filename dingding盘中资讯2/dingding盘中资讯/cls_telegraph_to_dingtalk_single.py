# cls_telegraph_to_dingtalk_single.py  —— 2025-06-26 (含原文链接)
# ------------------------------------------------------------
# 财联社 7×24 电报 → 本地 JSON（可配置等级过滤 + 点击原文）
# 依赖: requests
# ------------------------------------------------------------
import os, time, hashlib, random, re, json
from datetime import datetime
from typing import List, Dict
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, build_opener, Request
from news_store import append_news_item

# ===================== 可配置 =====================
LEVEL_FILTER      = {"A", "B"}          # ← 想推哪些等级就填哪些
RN                = int(os.getenv("CLS_RN", 50))
FETCH_INTERVAL    = int(os.getenv("FETCH_SEC", 5))
LAST_TS_FILE      = os.getenv("LAST_TS_FILE", "last_cls_ts.txt")
MAX_ITEMS         = int(os.getenv("CLS_MAX_ITEMS", 200))
PROXY_MODE        = (os.getenv("CLS_PROXY_MODE", "system") or "system").strip().lower()
BOOTSTRAP_MINUTES = int(os.getenv("CLS_BOOTSTRAP_MINUTES", 240))
# =================================================

CLS_API   = "https://www.cls.cn/nodeapi/telegraphList"
HEADERS   = {"User-Agent": "Mozilla/5.0",
             "Referer": "https://www.cls.cn/telegraph"}
TAG_RE    = re.compile(r"<[^>]+>")         # 去 HTML 标签
DATA_FILE = Path(__file__).resolve().parents[2] / "data" / "news_cls.json"

# ---- 网络会话：默认跟随系统代理/VPN，必要时可切回直连 ----
if PROXY_MODE == "direct":
    opener = build_opener(ProxyHandler({}))
else:
    opener = build_opener()

# ---------------- 网络 ----------------
def _md5(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()

def build_url(ts: int) -> str:
    q = (f"app=CailianpressWeb&category=&lastTime={ts}&last_time={ts}&os=web"
         f"&refresh_type=1&rn={RN}&sv=7.7.5")
    sign = _md5(_md5(q))                  # 外层再 md5 一次=官方算法
    return f"{CLS_API}?{q}&sign={sign}"

def load_last_ts() -> int:
    bootstrap_ts = int(time.time()) - BOOTSTRAP_MINUTES * 60
    try:
        if not DATA_FILE.exists() or not json.loads(DATA_FILE.read_text(encoding="utf-8") or "[]"):
            return bootstrap_ts
    except Exception:
        return bootstrap_ts
    try:
        saved = int(open(LAST_TS_FILE, "r", encoding="utf-8").read().strip())
        if saved > 0:
            return saved
    except Exception:
        pass
    return bootstrap_ts

def save_last_ts(ts: int) -> None:
    with open(LAST_TS_FILE, "w", encoding="utf-8") as fp:
        fp.write(str(ts))

def fetch_latest(ts: int, retries=3) -> List[Dict]:
    url = build_url(ts)
    for i in range(retries):
        try:
            request = Request(url, headers=HEADERS)
            with opener.open(request, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
            return payload["data"]["roll_data"]
        except (HTTPError, URLError, TimeoutError, KeyError, json.JSONDecodeError) as e:
            if i == retries - 1:
                raise e
            time.sleep(2 ** i + random.random())

# ---------------- 业务逻辑 ----------------
def want(lv: str) -> bool:
    return isinstance(lv, str) and lv.upper() in LEVEL_FILTER

def to_news_item(it: Dict) -> Dict | None:
    lv = (it.get("level") or "").upper()
    if not want(lv):
        return None

    created_at = datetime.fromtimestamp(int(it["ctime"])).isoformat()
    tm   = datetime.fromtimestamp(int(it["ctime"])).strftime("%H:%M:%S")
    text = TAG_RE.sub("", (it.get("brief") or it.get("content") or "")).strip()
    title = (it.get("title") or "").strip()
    url   = it.get("shareurl") or ""
    content = f"[L={lv}] {text}".strip()
    unique_id = str(it.get("id") or f"cls-{it.get('ctime')}-{hashlib.md5(title.encode('utf-8')).hexdigest()[:8]}")
    return {
        "id": unique_id,
        "title": title or "财联社快讯",
        "source": "财联社",
        "time": tm,
        "content": content,
        "createdAt": created_at,
        "url": url,
        "sentiment": None,
        "type": "news",
    }

# ---------------- 主循环 ----------------
def main():
    last_ts = load_last_ts()
    print("CLS 启动，last_ts =", datetime.fromtimestamp(last_ts).strftime("%H:%M:%S"))
    print("推送等级 =", LEVEL_FILTER)
    print("网络模式 =", "系统代理/VPN" if PROXY_MODE != "direct" else "直连")
    print("单次拉取条数 =", RN)

    while True:
        try:
            items = fetch_latest(int(time.time()))
            items = [it for it in items if int(it["ctime"]) > last_ts and want(it.get("level"))]
            items.sort(key=lambda x: int(x["ctime"]))

            for it in items:
                news_item = to_news_item(it)
                if news_item:
                    append_news_item("news_cls.json", news_item, MAX_ITEMS)
                    last_ts = int(it["ctime"])
                    save_last_ts(last_ts)
                    time.sleep(0.1)
        except Exception as e:
            print("CLS 抓取异常:", e)

        time.sleep(FETCH_INTERVAL)

# ---------------- 入口 ----------------
if __name__ == "__main__":
    main()
