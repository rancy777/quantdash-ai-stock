# newsfilter_to_dingtalk.py  —— 2025-06-26 (原文+翻译+词典 / 输出本地 JSON)
# ------------------------------------------------------------------
# 依赖: playwright  bs4  googletrans==4.0.0-rc1
# ------------------------------------------------------------------

from __future__ import annotations
import os, re, sys, time, random, signal, hashlib, threading
import textwrap
from typing import Dict, List, Set
from urllib.parse import quote_plus
from datetime import datetime

from bs4 import BeautifulSoup, Tag
from playwright.sync_api import Page, sync_playwright
from news_store import append_news_item
# ---------- 翻译 ----------

import html, json, requests, functools, hashlib
import unicodedata
# ========= ❶  googletrans 打补丁（解决 raise_Exception 报错） =========
try:
    from googletrans import Translator             # type: ignore

    class _SafeTranslator(Translator):             # type: ignore
        def __init__(self, **kw):
            super().__init__(**kw)
            # 某些版本没有 raise_Exception，运行时会 AttributeError
            if not hasattr(self, "raise_Exception"):
                self.raise_Exception = lambda *a, **k: None  # type: ignore

    translator = _SafeTranslator(service_urls=[
        "translate.googleapis.com",
        "translate.google.com",
        "translate.google.cn",
    ])
except Exception as e:
    print("⚠ googletrans 不可用，翻译将回退原文:", e)
    translator = None
# ------------------------------------------------------------------

# ========= 自定义翻译词典 =========
CUSTOM_TERMS = {
    "CNBC": "CNBC",
    "Reuters": "路透社",
    "Bloomberg": "彭博社",
    "PR Newswire": "美通社",
    "Wall Street Journal": "《华尔街日报》",
    "Barrons": "《巴伦周刊》",
    "BusinessWire": "商业电讯",
    "GlobeNewswire": "环球新闻社",
    "AccessWire": "AccessWire",
    "Benzinga": "Benzinga",
    "S&P Global": "标普全球"
}
# ===============================================================

# ---------------- 基本配置 ----------------
REFRESH_MIN_SEC, REFRESH_MAX_SEC = 15, 35
RECENT_MAX_MIN  = 2
BROWSER_TRANSLATE = False         # 不用浏览器翻
ALWAYS_PY_TRANSLATE = True        # 始终 python 翻
CDP_PORT = 19223
MAX_ITEMS = int(os.getenv("NEWS_MAX_ITEMS", 200))

NEWS_URL = "https://newsfilter.io/latest/news"
CDP_URL  = f"http://127.0.0.1:{CDP_PORT}"

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]
_DESC_MAX = 120
_CJK_UNITS = {"秒":"s","分钟":"m","分":"m","小时":"h","天":"d"}
_CJK_RE   = re.compile(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]')

# ---------- playwright Helper ----------
def wait_cf(page: Page):
    for _ in range(60):
        if page.query_selector("script#__NF__") or page.query_selector("script[id^='__NEXT_DATA']"):
            return
        page.wait_for_timeout(500)

def smart_scroll(page: Page):
    last = -1
    for _ in range(random.randint(50, 80)):
        now = len(page.query_selector_all("div.sc-htoDjs"))
        if now == last:
            break
        last = now
        page.evaluate("window.scrollBy(0, document.body.scrollHeight)")
        page.wait_for_timeout(random.randint(500, 1500))

# ---------- DOM 解析 ----------
def _extract_from_dom(soup: BeautifulSoup) -> List[Dict]:
    rows = []
    for card in soup.select("div.sc-htoDjs"):
        t_tag = card.select_one("div.sc-gZMcBi span")
        if not t_tag:
            continue
        title = t_tag.text.strip()
        sib   = t_tag.find_parent("div").find_next_sibling("div")
        desc  = sib.get_text(" ", strip=True) if isinstance(sib, Tag) else ""
        a     = card.find_parent("a")
        url   = a["href"] if a and a.has_attr("href") else ""
        rid   = url or hashlib.md5(title.encode()).hexdigest()
        rel   = card.select_one("span.sc-bwzfXH")
        src   = card.select_one("span.sc-fjdhpX")
        syms  = card.select("span.sc-bxivhb")
        rows.append({
            "ID": rid,
            "Title_en": title,
            "Desc_en":  desc,
            "URL": url,
            "RelativeTime": rel.text.strip() if rel else "",
            "Source": src.text.strip() if src else "",
            "Symbols": ",".join(s.text.strip() for s in syms),
        })
    return rows

def extract_articles(html: str) -> List[Dict]:
    return _extract_from_dom(BeautifulSoup(html, "lxml"))

# ---------- 翻译 ----------
def has_cjk(s: str) -> bool:
    return bool(_CJK_RE.search(s))

def apply_terms(text: str) -> str:
    for en, cn in CUSTOM_TERMS.items():
        text = re.sub(rf"\b{re.escape(en)}\b", cn, text, flags=re.I)
    return text


# 简单 30 min 内存缓存
@functools.lru_cache(maxsize=4096)
def _cache(key):  # dummy 占位
    return None

def _clean(s: str) -> str:
    """去掉商标、不可打印字符，规范空格"""
    s = unicodedata.normalize("NFKC", s.replace("®", "").replace("™", ""))
    s = re.sub(r"[\u0000-\u001F]+", " ", s)         # 控制字符
    return re.sub(r"\s+", " ", s).strip()

def _google_try(segment: str) -> str | None:
    if translator is None:
        return None
    try:
        return translator.translate(segment, dest="zh-cn").text
    except Exception as e:
        #print("  └ googletrans 失败:", e)
        return None

def _mymemory_try(segment: str) -> str:
    url = ("https://api.mymemory.translated.net/get"
           f"?q={requests.utils.quote(segment)}&langpair=en|zh-CN")
    try:
        r = requests.get(url, timeout=8)
        return html.unescape(r.json()["responseData"]["translatedText"])
    except Exception as e:
        print("  └ MyMemory 也失败:", e)
        return segment

def translate_text(txt: str) -> str:
    txt = _clean(txt)
    if not txt or has_cjk(txt):
        return apply_terms(txt)

    # ---------- 缓存 ----------
    key = hashlib.md5(txt.encode()).hexdigest()
    hit = _cache(key)
    if hit:
        return hit

    # ---------- 分块 ----------
    parts = textwrap.wrap(txt, width=450, break_long_words=False,
                          break_on_hyphens=False)
    out_chunks: list[str] = []

    for seg in parts:
        zh = _google_try(seg)
        if zh is None or not has_cjk(zh):
            zh = _mymemory_try(seg)
        out_chunks.append(zh)

        # 小睡 0.2-0.5 s，降低谷歌 404 机率
        time.sleep(random.uniform(0.2, 0.5))

    zh_full = apply_terms("".join(out_chunks))

    # ---------- 写缓存 ----------
    _cache.cache_clear()
    _cache.__wrapped__ = lambda k: zh_full if k == key else None
    return zh_full



def enrich(row: Dict):
    row["Title_cn"] = translate_text(row["Title_en"])
    row["Desc_cn"]  = translate_text(row["Desc_en"]) if row["Desc_en"] else ""

# ---------- 推送 ----------
def push_news(row: Dict):
    enrich(row)
    tm   = row["RelativeTime"] or time.strftime("%H:%M:%S")
    src  = CUSTOM_TERMS.get(row["Source"], row["Source"] or "--")
    url  = row["URL"]
    d_en = row["Desc_en"][:_DESC_MAX] + ("…" if len(row["Desc_en"]) > _DESC_MAX else "")
    d_cn = row["Desc_cn"][:_DESC_MAX] + ("…" if len(row["Desc_cn"]) > _DESC_MAX else "")
    content_parts = [f"原文：{row['Title_en']}", f"翻译：{row['Title_cn']}"]

    if row["Desc_en"]:
        content_parts.append(f"摘要：{d_en}")
        content_parts.append(f"摘要翻译：{d_cn}")

    append_news_item(
        "news_newsfilter.json",
        {
            "id": row["ID"],
            "title": row["Title_cn"] or row["Title_en"],
            "source": src or "NewsFilter",
            "time": tm,
            "content": "\n".join(content_parts),
            "createdAt": datetime.now().isoformat(),
            "url": url,
            "sentiment": None,
            "type": "report",
        },
        MAX_ITEMS,
    )

# ---------- 时间过滤 ----------
def _parse_rel(rel: str):
    if not rel: return None, None
    m = re.match(r"(\d+)\s*([smhd])", rel)
    if m: return int(m.group(1)), m.group(2)
    m = re.match(r"(\d+)\s*(秒|分钟|分|小时|天)", rel)
    if m: return int(m.group(1)), _CJK_UNITS[m.group(2)]
    return None, None

def _is_recent(rel: str) -> bool:
    n, u = _parse_rel(rel)
    if u is None: return False
    if u == "s":  return True
    if u == "m":  return n <= RECENT_MAX_MIN
    return False

# ---------- 主循环 ----------
def run_loop(page: Page, frame: Page, seen: Set[str]):
    print("🚀 NewsFilter 监控开始…")
    while True:
        try:
            page.reload(wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")          # ❷ 等待网络空闲
            wait_cf(page)
            frame.evaluate("window.scrollTo(0,0)")
            arts = extract_articles(frame.content())
            fresh = [r for r in arts if r["ID"] not in seen and _is_recent(r["RelativeTime"])]
            for r in fresh:
                seen.add(r["ID"])
                push_news(r)
                time.sleep(0.1)
        except Exception as e:
            print("NF 异常:", e)
        time.sleep(random.uniform(REFRESH_MIN_SEC, REFRESH_MAX_SEC))

# ---------- 入口 ----------
def main():
    def bye(sig, frm):
        print("\n👋 退出 NewsFilter 推送")
        sys.exit(0)
    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGINT, bye)

    ua = random.choice(USER_AGENTS)
    target = (f"https://translate.google.com/translate?hl=zh-CN&sl=auto&tl=zh-CN&u={quote_plus(NEWS_URL)}"
              if BROWSER_TRANSLATE else NEWS_URL)

    with sync_playwright() as p:
        try:
            browser = p.chromium.connect_over_cdp(CDP_URL, headers={"User-Agent": ua}, timeout=30000)
        except Exception as exc:
            raise RuntimeError(
                f"无法连接到 NewsFilter 所需的 Chrome 调试端口 {CDP_URL}。"
                " 请先启动带 --remote-debugging-port=19223 的 Chrome，"
                " 或运行项目根目录下的 start_newsfilter_chrome.bat。"
            ) from exc
        ctx   = browser.contexts[0]
        page  = ctx.new_page()
        page.set_viewport_size({"width": random.randint(960, 1680),
                                "height": random.randint(600, 1050)})
        page.goto(target, wait_until="domcontentloaded")
        wait_cf(page)

        frame = next((f for f in page.frames if "newsfilter.io" in f.url), page.main_frame)
        smart_scroll(frame)

        seen = {r["ID"] for r in extract_articles(frame.content())}
        print(f"🟢 NewsFilter 启动完成，已缓存 {len(seen)} 条")
        run_loop(page, frame, seen)

if __name__ == "__main__":
    main()
