from __future__ import annotations

from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
MARKETS_DIR = DATA_DIR / "markets"
A_SHARE_DIR = MARKETS_DIR / "a_share"
SYSTEM_DIR = DATA_DIR / "system"
RESEARCH_REPORTS_DIR = DATA_DIR / "research_reports"
A_SHARE_REPORTS_DIR = RESEARCH_REPORTS_DIR / "a_share"

SYSTEM_FILES = {"sync_status.json", "auth.db"}
REPORT_MANIFEST_FILES = {"research_reports_manifest.json", "research_reports/a_share/manifest.json"}


def resolve_write_path(file_name: str, kind: str = "auto") -> Path:
    normalized = str(file_name).replace("\\", "/").lstrip("/")

    if kind == "system" or (kind == "auto" and normalized in SYSTEM_FILES):
        return SYSTEM_DIR / normalized

    if kind == "research_manifest" or normalized in REPORT_MANIFEST_FILES:
        return A_SHARE_REPORTS_DIR / "manifest.json"

    if kind == "research_dir":
        return A_SHARE_REPORTS_DIR / normalized

    if normalized.startswith(("markets/", "system/", "research_reports/")):
        return DATA_DIR / normalized

    return A_SHARE_DIR / normalized


def resolve_read_candidates(file_name: str, kind: str = "auto") -> list[Path]:
    normalized = str(file_name).replace("\\", "/").lstrip("/")
    primary = resolve_write_path(normalized, kind=kind)

    if kind == "research_manifest" or normalized in REPORT_MANIFEST_FILES:
        return [A_SHARE_REPORTS_DIR / "manifest.json", DATA_DIR / "research_reports_manifest.json"]

    if kind == "system" or (kind == "auto" and normalized in SYSTEM_FILES):
        return [SYSTEM_DIR / normalized, DATA_DIR / normalized]

    if normalized.startswith(("markets/", "system/", "research_reports/")):
        return [DATA_DIR / normalized]

    legacy = DATA_DIR / normalized
    if primary == legacy:
        return [primary]

    return [primary, legacy]


def resolve_existing_path(file_name: str, kind: str = "auto") -> Path:
    candidates = resolve_read_candidates(file_name, kind=kind)
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]
