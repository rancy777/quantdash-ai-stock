from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from data_paths import A_SHARE_REPORTS_DIR, DATA_DIR, resolve_existing_path, resolve_write_path

ROOT_DIR = Path(__file__).resolve().parent.parent
REPORT_DIR = A_SHARE_REPORTS_DIR
AUTO_REPORT_DIR = REPORT_DIR / "auto"
MANIFEST_PATH = resolve_write_path("research_reports_manifest.json", kind="research_manifest")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

REPORT_ITEM_LIMIT = 40
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}
TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".csv", ".json", ".log"}
OFFICE_EXTENSIONS = {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"}


@dataclass(frozen=True)
class ReportSource:
    id: str
    title: str
    url: str
    category: str
    source_label: str
    column_type: str
    tags: tuple[str, ...]


REPORT_SOURCES: tuple[ReportSource, ...] = (
    ReportSource(
        id="eastmoney-stock-report",
        title="东方财富个股研报",
        url="https://data.eastmoney.com/report/stock.jshtml",
        category="eastmoney/stock",
        source_label="东方财富",
        column_type="个股研报",
        tags=("自动抓取", "东财", "个股"),
    ),
    ReportSource(
        id="eastmoney-industry-report",
        title="东方财富行业研报",
        url="https://data.eastmoney.com/report/industry.jshtml",
        category="eastmoney/industry",
        source_label="东方财富",
        column_type="行业研报",
        tags=("自动抓取", "东财", "行业"),
    ),
    ReportSource(
        id="eastmoney-strategy-report",
        title="东方财富策略报告",
        url="https://data.eastmoney.com/report/strategyreport.jshtml",
        category="eastmoney/strategy",
        source_label="东方财富",
        column_type="策略报告",
        tags=("自动抓取", "东财", "策略"),
    ),
    ReportSource(
        id="eastmoney-macro-report",
        title="东方财富宏观研究",
        url="https://data.eastmoney.com/report/macresearch.jshtml",
        category="eastmoney/macro",
        source_label="东方财富",
        column_type="宏观研究",
        tags=("自动抓取", "东财", "宏观"),
    ),
    ReportSource(
        id="eastmoney-brokerreport",
        title="东方财富券商晨会",
        url="https://data.eastmoney.com/report/brokerreport.jshtml",
        category="eastmoney/brokerreport",
        source_label="东方财富",
        column_type="券商晨会",
        tags=("自动抓取", "东财", "晨会"),
    ),
)


SNAPSHOT_SOURCES: tuple[dict[str, str | tuple[str, ...]], ...] = (
    {
        "id": "eastmoney-report-center",
        "title": "东方财富研报中心",
        "url": "https://data.eastmoney.com/report/",
        "category": "eastmoney/overview",
        "source_label": "东方财富",
        "tags": ("自动抓取", "东财", "总览快照"),
    },
    {
        "id": "tfzq-research-business",
        "title": "天风证券研究业务页",
        "url": "https://www.tfzq.com/about/ywjsyjyw.html",
        "category": "brokers/tfzq",
        "source_label": "天风证券",
        "tags": ("自动抓取", "券商", "天风证券"),
    },
    {
        "id": "tfzq-research-authorization",
        "title": "天风证券研报转载授权声明",
        "url": "https://www.tfzq.com/8960378933631516929.html",
        "category": "brokers/tfzq",
        "source_label": "天风证券",
        "tags": ("自动抓取", "券商", "授权声明", "天风证券"),
    },
)


def parse_bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def parse_csv_env(name: str) -> set[str]:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return set()
    return {item.strip() for item in raw.split(",") if item.strip()}


def parse_int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


SELECTED_SOURCE_KEYS = parse_csv_env("REPORT_SOURCE_KEYS")
INCLUDE_SNAPSHOTS = parse_bool_env("REPORT_INCLUDE_SNAPSHOTS", True)
REPORT_ITEM_LIMIT_EFFECTIVE = parse_int_env("REPORT_ITEM_LIMIT_OVERRIDE", REPORT_ITEM_LIMIT)
DOWNLOAD_PDFS = parse_bool_env("REPORT_DOWNLOAD_PDFS", True)


def fetch_text(url: str, timeout: int = 20) -> str:
    req = Request(url, headers=DEFAULT_HEADERS)
    with urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="ignore")


def fetch_bytes(url: str, timeout: int = 30) -> bytes:
    req = Request(url, headers=DEFAULT_HEADERS)
    with urlopen(req, timeout=timeout) as response:
        return response.read()


def solve_pdf_cookie_challenge(html: str) -> str | None:
    status_match = re.search(
        r"WTKkN:(\d+),bOYDu:(\d+),dtzqS:function\(a,n\)\{return a\+n\},wyeCN:(\d+)",
        html,
    )
    ssid_match = re.search(r"t,\s*(\d+)\)\;continue;case\"4\"", html)
    if not status_match or not ssid_match:
        return None

    status_value = sum(int(part) for part in status_match.groups())
    ssid_value = ssid_match.group(1)
    return f"__tst_status={status_value}#; EO_Bot_Ssid={ssid_value};"


def fetch_pdf_bytes(url: str, timeout: int = 30) -> bytes:
    data = fetch_bytes(url, timeout=timeout)
    if data.startswith(b"%PDF"):
        return data

    html = data.decode("utf-8", errors="ignore")
    cookie = solve_pdf_cookie_challenge(html)
    if not cookie:
        return data

    headers = {
        **DEFAULT_HEADERS,
        "Cookie": cookie,
        "Referer": "https://data.eastmoney.com/",
    }
    req = Request(url, headers=headers)
    with urlopen(req, timeout=timeout) as response:
        return response.read()


def ensure_auto_dir() -> None:
    AUTO_REPORT_DIR.mkdir(parents=True, exist_ok=True)


def format_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    if size < 1024 * 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} MB"
    return f"{size / (1024 * 1024 * 1024):.1f} GB"


def infer_preview_type(extension: str) -> str:
    if extension == ".pdf":
        return "pdf"
    if extension in IMAGE_EXTENSIONS:
        return "image"
    if extension in TEXT_EXTENSIONS:
        return "text"
    if extension in OFFICE_EXTENSIONS:
        return "office"
    return "other"


def normalize_slashes(value: str) -> str:
    return value.replace("\\", "/")


def sanitize_file_name(value: str) -> str:
    safe = re.sub(r"[<>:\"/\\|?*]+", "-", value)
    safe = re.sub(r"\s+", "-", safe).strip("-")
    return safe.lower() or "report"


def strip_html(value: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def resolve_url(url: str) -> str:
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith("/"):
        return f"https://data.eastmoney.com{url}"
    return url


def parse_publish_iso(raw: str | None) -> str:
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = datetime.strptime(raw, "%Y-%m-%d %H:%M:%S.%f")
        return dt.replace(tzinfo=timezone.utc).isoformat()
    except ValueError:
        return datetime.now(timezone.utc).isoformat()


def extract_json_object(text: str, marker: str = "var initdata") -> dict[str, Any]:
    marker_index = text.find(marker)
    if marker_index < 0:
        raise ValueError(f"Marker not found: {marker}")

    start = text.find("{", marker_index)
    if start < 0:
        raise ValueError("JSON object start not found")

    depth = 0
    in_string = False
    escaped = False

    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == "\"":
                in_string = False
            continue

        if char == "\"":
            in_string = True
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                payload = text[start:index + 1]
                return json.loads(payload)

    raise ValueError("JSON object end not found")


def extract_div_block(html: str, marker: str) -> str:
    start = html.find(marker)
    if start < 0:
        return ""
    div_start = html.rfind("<div", 0, start)
    if div_start < 0:
        return ""

    depth = 0
    index = div_start
    while index < len(html):
        next_open = html.find("<div", index)
        next_close = html.find("</div>", index)
        if next_close < 0:
            break
        if next_open != -1 and next_open < next_close:
            depth += 1
            index = next_open + 4
            continue
        depth -= 1
        index = next_close + 6
        if depth == 0:
            return html[div_start:index]
    return ""


def extract_detail_content(detail_url: str) -> tuple[str, str | None]:
    try:
        html = fetch_text(detail_url)
    except Exception:
        return "", None

    pdf_match = re.search(r'<a[^>]+class="pdf-link"[^>]+href="([^"]+)"', html, re.IGNORECASE)
    pdf_url = resolve_url(pdf_match.group(1)) if pdf_match else None

    ctx_html = extract_div_block(html, 'class="ctx-content"')
    if not ctx_html:
        return "", pdf_url

    text = strip_html(ctx_html)
    text = text.replace("查看PDF原文", " ").strip()
    return text, pdf_url


def build_detail_url(source: ReportSource, item: dict[str, Any]) -> str:
    info_code = str(item.get("infoCode") or "").strip()
    encode_url = str(item.get("encodeUrl") or "").strip()

    if source.column_type == "个股研报" and info_code:
        return f"https://data.eastmoney.com/report/info/{info_code}.html"
    if source.column_type == "行业研报" and info_code:
        return f"https://data.eastmoney.com/report/zw_industry.jshtml?infocode={quote(info_code)}"
    if source.column_type == "券商晨会" and encode_url:
        return f"https://data.eastmoney.com/report/zw_brokerreport.jshtml?encodeUrl={quote(encode_url, safe='=+/')}"
    if source.column_type == "策略报告" and encode_url:
        return f"https://data.eastmoney.com/report/zw_strategy.jshtml?encodeUrl={quote(encode_url, safe='=+/')}"
    if source.column_type == "宏观研究" and encode_url:
        return f"https://data.eastmoney.com/report/zw_macresearch.jshtml?encodeUrl={quote(encode_url, safe='=+/')}"
    return source.url


def build_report_summary(
    source: ReportSource,
    item: dict[str, Any],
    detail_url: str,
    detail_excerpt: str,
    pdf_url: str | None,
) -> str:
    title = str(item.get("title") or "未命名研报").strip()
    org_name = str(item.get("orgSName") or item.get("orgName") or "未知机构").strip()
    publish_date = str(item.get("publishDate") or "").strip()
    rating = str(item.get("emRatingName") or item.get("sRatingName") or "未披露").strip()
    researcher = str(item.get("researcher") or "").strip()
    stock_name = str(item.get("stockName") or "").strip()
    stock_code = str(item.get("stockCode") or "").strip()
    industry_name = str(item.get("industryName") or item.get("indvInduName") or "").strip()
    pages = item.get("attachPages")
    size = item.get("attachSize")
    info_code = str(item.get("infoCode") or "").strip()

    summary_lines = [
        f"# {title}",
        "",
        f"- 来源页: {source.url}",
        f"- 详情链接: {detail_url}",
        f"- PDF链接: {pdf_url or '未解析到'}",
        f"- 抓取来源: {source.source_label}",
        f"- 研报分类: {source.column_type}",
        f"- 机构: {org_name}",
        f"- 评级: {rating or '未披露'}",
        f"- 发布日期: {publish_date or '未披露'}",
    ]

    if researcher:
        summary_lines.append(f"- 作者: {researcher}")
    if stock_name or stock_code:
        summary_lines.append(f"- 标的: {stock_name} {f'({stock_code})' if stock_code else ''}".strip())
    if industry_name:
        summary_lines.append(f"- 行业: {industry_name}")
    if pages:
        summary_lines.append(f"- 页数: {pages}")
    if size:
        summary_lines.append(f"- 附件大小: {size} KB")
    if info_code:
        summary_lines.append(f"- InfoCode: {info_code}")

    summary_lines.extend(
        [
            "",
            "## 摘要",
            "",
            f"{org_name} 发布的 {source.column_type} 条目，已抓取详情页正文摘要。",
            detail_excerpt or "详情页正文暂未解析成功，可先通过详情链接或 PDF 链接查看原文。",
            "",
        ]
    )

    return "\n".join(summary_lines)


def build_report_tags(source: ReportSource, item: dict[str, Any]) -> list[str]:
    tags = list(source.tags)
    rating = str(item.get("emRatingName") or item.get("sRatingName") or "").strip()
    org_name = str(item.get("orgSName") or item.get("orgName") or "").strip()
    industry_name = str(item.get("industryName") or item.get("indvInduName") or "").strip()
    if rating:
        tags.append(rating)
    if org_name:
        tags.append(org_name)
    if industry_name:
        tags.append(industry_name)
    deduped: list[str] = []
    for tag in tags:
        if tag and tag not in deduped:
            deduped.append(tag)
    return deduped


def build_report_relative_path(source: ReportSource, item: dict[str, Any]) -> str:
    publish_iso = parse_publish_iso(str(item.get("publishDate") or ""))
    publish_day = publish_iso[:10]
    info_code = str(item.get("infoCode") or "").strip() or sanitize_file_name(str(item.get("title") or "report"))
    file_name = f"{publish_day}-{sanitize_file_name(info_code)}.md"
    return normalize_slashes(f"auto/{source.category}/{file_name}")


def build_pdf_relative_path(markdown_relative_path: str) -> str:
    return re.sub(r"\.md$", ".pdf", markdown_relative_path, flags=re.IGNORECASE)


def load_existing_manifest() -> dict[str, dict[str, Any]]:
    if not MANIFEST_PATH.exists():
        return {}
    try:
        payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(payload, list):
        return {}
    return {
        str(item.get("id")): item
        for item in payload
        if isinstance(item, dict) and item.get("id")
    }


def build_manifest_entry(
    source: ReportSource,
    item: dict[str, Any],
    relative_path: str,
    output_path: Path,
    pdf_url: str | None,
    pdf_local_path: str | None,
) -> dict[str, Any]:
    publish_iso = parse_publish_iso(str(item.get("publishDate") or ""))
    stat = output_path.stat()
    title = str(item.get("title") or output_path.stem).strip()
    org_name = str(item.get("orgSName") or item.get("orgName") or source.source_label).strip()
    rating = str(item.get("emRatingName") or item.get("sRatingName") or "").strip()
    stock_name = str(item.get("stockName") or "").strip()
    stock_code = str(item.get("stockCode") or "").strip()
    industry_name = str(item.get("industryName") or item.get("indvInduName") or "").strip()
    detail_url = build_detail_url(source, item)

    summary_bits = [org_name, source.column_type]
    if rating:
        summary_bits.append(rating)
    if stock_name or stock_code:
        summary_bits.append(f"{stock_name}{f'({stock_code})' if stock_code else ''}")
    elif industry_name:
        summary_bits.append(industry_name)

    return {
        "id": relative_path,
        "name": output_path.name,
        "title": title,
        "relativePath": relative_path,
        "url": f"/research_reports/a_share/{relative_path}",
        "originUrl": detail_url,
        "pdfUrl": pdf_url,
        "pdfLocalUrl": f"/research_reports/a_share/{pdf_local_path}" if pdf_local_path else None,
        "pdfLocalPath": pdf_local_path,
        "extension": "md",
        "size": stat.st_size,
        "sizeLabel": format_bytes(stat.st_size),
        "updatedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "publishedAt": publish_iso,
        "previewType": infer_preview_type(".md"),
        "sourceType": "local",
        "sourceLabel": source.source_label,
        "sourceKey": source.id,
        "category": source.category,
        "reportKind": "entry",
        "stockCode": stock_code or None,
        "stockName": stock_name or None,
        "orgName": org_name or None,
        "rating": rating or None,
        "researcher": str(item.get("researcher") or "").strip() or None,
        "industryName": industry_name or None,
        "tags": build_report_tags(source, item),
        "summary": " / ".join(bit for bit in summary_bits if bit),
    }


def maybe_download_pdf(
    relative_path: str,
    pdf_url: str | None,
    existing_entry: dict[str, Any] | None,
) -> str | None:
    if not pdf_url or not DOWNLOAD_PDFS:
        return None

    existing_local_path = existing_entry.get("pdfLocalPath") if existing_entry else None
    if isinstance(existing_local_path, str):
        existing_local_file = REPORT_DIR / existing_local_path
        if existing_local_file.exists():
            return normalize_slashes(existing_local_path)

    pdf_relative_path = build_pdf_relative_path(relative_path)
    pdf_output_path = REPORT_DIR / pdf_relative_path
    if pdf_output_path.exists():
        return pdf_relative_path

    try:
        pdf_bytes = fetch_pdf_bytes(pdf_url)
    except Exception:
        return None

    if not pdf_bytes.startswith(b"%PDF"):
        return None

    pdf_output_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_output_path.write_bytes(pdf_bytes)
    return pdf_relative_path


def write_report_file(
    source: ReportSource,
    item: dict[str, Any],
    existing_entries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    relative_path = build_report_relative_path(source, item)
    output_path = REPORT_DIR / relative_path
    output_path.parent.mkdir(parents=True, exist_ok=True)

    existing_entry = existing_entries.get(relative_path)
    if existing_entry and output_path.exists():
        existing_pdf_url = existing_entry.get("pdfUrl")
        pdf_local_path = maybe_download_pdf(
            relative_path=relative_path,
            pdf_url=existing_pdf_url if isinstance(existing_pdf_url, str) else None,
            existing_entry=existing_entry,
        )
        return build_manifest_entry(
            source=source,
            item=item,
            relative_path=relative_path,
            output_path=output_path,
            pdf_url=existing_pdf_url if isinstance(existing_pdf_url, str) else None,
            pdf_local_path=pdf_local_path,
        )

    detail_url = build_detail_url(source, item)
    detail_text, pdf_url = extract_detail_content(detail_url)
    detail_excerpt = detail_text[:4000]
    content = build_report_summary(source, item, detail_url, detail_excerpt, pdf_url)
    output_path.write_text(content + "\n", encoding="utf-8")
    pdf_local_path = maybe_download_pdf(relative_path, pdf_url, existing_entry)

    return build_manifest_entry(
        source=source,
        item=item,
        relative_path=relative_path,
        output_path=output_path,
        pdf_url=pdf_url,
        pdf_local_path=pdf_local_path,
    )


def collect_source_reports(
    source: ReportSource,
    existing_entries: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    html = fetch_text(source.url)
    payload = extract_json_object(html)
    entries = payload.get("data") or []
    if not isinstance(entries, list):
        return []

    results: list[dict[str, Any]] = []
    for item in entries[:REPORT_ITEM_LIMIT_EFFECTIVE]:
        if isinstance(item, dict) and item.get("title"):
            results.append(write_report_file(source, item, existing_entries))
    return results


def write_manifest(entries: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def collect_snapshot_source(source: dict[str, str | tuple[str, ...]]) -> dict[str, Any]:
    html = fetch_text(str(source["url"]))
    text = strip_html(html)[:6000]
    fetched_at = datetime.now(timezone.utc)
    day = fetched_at.date().isoformat()
    directory = AUTO_REPORT_DIR / str(source["category"])
    directory.mkdir(parents=True, exist_ok=True)
    file_name = f"{day}-{sanitize_file_name(str(source['id']))}.md"
    output_path = directory / file_name
    content = "\n".join(
        [
            f"# {source['title']}",
            "",
            f"- 来源页: {source['url']}",
            f"- 抓取时间: {fetched_at.isoformat()}",
            "",
            "## 页面快照",
            "",
            text or "页面暂无可提取正文",
            "",
        ]
    )
    output_path.write_text(content + "\n", encoding="utf-8")
    stat = output_path.stat()
    relative_path = normalize_slashes(str(output_path.relative_to(REPORT_DIR)))
    return {
        "id": relative_path,
        "name": output_path.name,
        "title": str(source["title"]),
        "relativePath": relative_path,
        "url": f"/research_reports/a_share/{relative_path}",
        "originUrl": str(source["url"]),
        "pdfLocalUrl": None,
        "pdfLocalPath": None,
        "extension": "md",
        "size": stat.st_size,
        "sizeLabel": format_bytes(stat.st_size),
        "updatedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "publishedAt": fetched_at.isoformat(),
        "previewType": infer_preview_type(".md"),
        "sourceType": "local",
        "sourceLabel": str(source["source_label"]),
        "sourceKey": str(source["id"]),
        "category": str(source["category"]),
        "reportKind": "snapshot",
        "stockCode": None,
        "stockName": None,
        "orgName": str(source["source_label"]),
        "rating": None,
        "researcher": None,
        "industryName": None,
        "tags": list(source["tags"]),
        "summary": f"{source['source_label']} 页面快照",
    }


def cleanup_stale_auto_files(valid_ids: set[str]) -> None:
    if not AUTO_REPORT_DIR.exists():
        return
    for file_path in AUTO_REPORT_DIR.rglob("*"):
        if not file_path.is_file():
            continue
        relative_path = normalize_slashes(str(file_path.relative_to(REPORT_DIR)))
        if relative_path not in valid_ids:
            file_path.unlink(missing_ok=True)

    for directory in sorted(AUTO_REPORT_DIR.rglob("*"), reverse=True):
        if directory.is_dir() and not any(directory.iterdir()):
            directory.rmdir()


def main() -> None:
    ensure_auto_dir()
    existing_entries = load_existing_manifest()
    selected_keys = SELECTED_SOURCE_KEYS

    manifest: list[dict[str, Any]] = []
    if INCLUDE_SNAPSHOTS:
        for source in SNAPSHOT_SOURCES:
            source_id = str(source["id"])
            if selected_keys and source_id not in selected_keys:
                continue
            try:
                manifest.append(collect_snapshot_source(source))
                print(f"[reports] fetched snapshot from {source['title']}")
            except Exception as error:
                print(f"[reports] failed to fetch snapshot {source['title']}: {error}")

    for source in REPORT_SOURCES:
        if selected_keys and source.id not in selected_keys:
            continue
        try:
            items = collect_source_reports(source, existing_entries)
            manifest.extend(items)
            print(f"[reports] fetched {len(items)} items from {source.title}")
        except Exception as error:
            print(f"[reports] failed to fetch {source.title}: {error}")

    manifest.sort(key=lambda item: item.get("publishedAt") or item.get("updatedAt") or "", reverse=True)
    valid_paths = {
        str(item["id"])
        for item in manifest
        if item.get("id")
    }
    valid_paths.update(
        str(item["pdfLocalPath"])
        for item in manifest
        if item.get("pdfLocalPath")
    )
    cleanup_stale_auto_files(valid_paths)
    write_manifest(manifest)
    print(f"[reports] synced {len(manifest)} research report entries to {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
