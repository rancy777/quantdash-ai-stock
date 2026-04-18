from __future__ import annotations

import asyncio
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from server.shared.cache import get_json_cache, set_json_cache
from server.shared import runtime


ROUTER = APIRouter(tags=["github"])
GITHUB_API_BASE = "https://api.github.com"
REPO_FULL_NAME = os.environ.get("GITHUB_REPO_FULL_NAME", "rancy777/quantdash-ai-stock").strip()
REPO_URL = f"https://github.com/{REPO_FULL_NAME}"
PACKAGE_JSON_PATH = runtime.ROOT_DIR / "package.json"
STATUS_PATH = runtime.SYSTEM_DIR / "github_update_status.json"
GITHUB_UPDATES_CACHE_TTL_SECONDS = 10 * 60


def _empty_status() -> dict[str, Any]:
    return {
        "checkedAt": None,
        "currentBranch": None,
        "currentCommitSha": None,
        "currentCommitShort": None,
        "currentVersion": None,
        "defaultBranch": None,
        "error": None,
        "hasCommitUpdate": False,
        "hasReleaseUpdate": False,
        "hasUpdate": False,
        "latestCommit": None,
        "latestRelease": None,
        "repoFullName": REPO_FULL_NAME,
        "repoUrl": REPO_URL,
        "source": "none",
    }


def _read_status_file() -> dict[str, Any]:
    if not STATUS_PATH.exists():
        return _empty_status()
    try:
        payload = json.loads(STATUS_PATH.read_text(encoding="utf-8"))
        return {**_empty_status(), **payload}
    except (OSError, json.JSONDecodeError):
        return _empty_status()


def _write_status_file(payload: dict[str, Any]) -> None:
    try:
        STATUS_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except OSError as exc:
        runtime.LOGGER.warning("Failed to write GitHub update status: %s", exc)


def _run_git_command(args: list[str]) -> str | None:
    git_dir = runtime.ROOT_DIR / ".git"
    if not git_dir.exists():
        return None
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=str(runtime.ROOT_DIR),
            capture_output=True,
            text=True,
            timeout=4,
            check=False,
        )
    except Exception:
        return None
    if result.returncode != 0:
        return None
    output = result.stdout.strip()
    return output or None


def _load_package_version() -> str | None:
    try:
        payload = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    value = str(payload.get("version", "")).strip()
    return value or None


def _normalize_tag(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip()
    if normalized.lower().startswith("v"):
        normalized = normalized[1:]
    return normalized or None


def _resolve_local_repo_state() -> dict[str, Any]:
    current_commit = os.environ.get("QUANTDASH_APP_COMMIT") or _run_git_command(["rev-parse", "HEAD"])
    current_branch = os.environ.get("QUANTDASH_APP_BRANCH") or _run_git_command(["rev-parse", "--abbrev-ref", "HEAD"])
    current_version = os.environ.get("QUANTDASH_APP_VERSION") or _load_package_version()
    return {
        "currentBranch": current_branch,
        "currentCommitSha": current_commit,
        "currentCommitShort": current_commit[:7] if current_commit else None,
        "currentVersion": current_version,
    }


async def _fetch_repo_metadata() -> dict[str, Any]:
    response = await runtime.CLIENT.get(
        f"{GITHUB_API_BASE}/repos/{REPO_FULL_NAME}",
        headers={"accept": "application/vnd.github+json"},
        timeout=8,
    )
    if not response.is_success:
        raise HTTPException(status_code=502, detail=f"GitHub 仓库信息请求失败: {response.status_code}")
    body = response.json()
    return {
        "defaultBranch": body.get("default_branch"),
        "htmlUrl": body.get("html_url") or REPO_URL,
    }


async def _fetch_latest_commit(default_branch: str | None) -> dict[str, Any] | None:
    branch = default_branch or "main"
    response = await runtime.CLIENT.get(
        f"{GITHUB_API_BASE}/repos/{REPO_FULL_NAME}/commits/{branch}",
        headers={"accept": "application/vnd.github+json"},
        timeout=8,
    )
    if not response.is_success:
        return None
    body = response.json()
    commit = body.get("commit") or {}
    author = commit.get("author") or {}
    sha = str(body.get("sha") or "").strip()
    if not sha:
        return None
    return {
        "author": author.get("name"),
        "committedAt": author.get("date"),
        "message": str(commit.get("message") or "").strip(),
        "sha": sha,
        "shortSha": sha[:7],
        "url": body.get("html_url"),
    }


async def _fetch_latest_release() -> dict[str, Any] | None:
    response = await runtime.CLIENT.get(
        f"{GITHUB_API_BASE}/repos/{REPO_FULL_NAME}/releases/latest",
        headers={"accept": "application/vnd.github+json"},
        timeout=8,
    )
    if response.status_code == 404:
        return None
    if not response.is_success:
        return None
    body = response.json()
    return {
        "name": str(body.get("name") or body.get("tag_name") or "").strip(),
        "publishedAt": body.get("published_at"),
        "tagName": str(body.get("tag_name") or "").strip(),
        "url": body.get("html_url"),
    }


async def fetch_github_update_status(force_refresh: bool = False) -> dict[str, Any]:
    if not force_refresh:
        cached = await get_json_cache("github_update_status", REPO_FULL_NAME)
        if isinstance(cached, dict):
            return {**_empty_status(), **cached}

    base = _empty_status()
    base.update(await runtime.run_blocking(_resolve_local_repo_state))

    try:
        repo_metadata = await _fetch_repo_metadata()
        latest_commit, latest_release = await asyncio.gather(
            _fetch_latest_commit(repo_metadata.get("defaultBranch")),
            _fetch_latest_release(),
        )
        base["checkedAt"] = datetime.utcnow().isoformat()
        base["defaultBranch"] = repo_metadata.get("defaultBranch")
        base["repoUrl"] = repo_metadata.get("htmlUrl") or REPO_URL
        base["latestCommit"] = latest_commit
        base["latestRelease"] = latest_release

        current_commit = base.get("currentCommitSha")
        current_version = _normalize_tag(base.get("currentVersion"))
        latest_release_version = _normalize_tag((latest_release or {}).get("tagName"))

        base["hasCommitUpdate"] = bool(current_commit and latest_commit and current_commit != latest_commit.get("sha"))
        base["hasReleaseUpdate"] = bool(current_version and latest_release_version and current_version != latest_release_version)
        base["hasUpdate"] = bool(base["hasCommitUpdate"] or base["hasReleaseUpdate"])
        if base["hasReleaseUpdate"]:
            base["source"] = "release"
        elif base["hasCommitUpdate"]:
            base["source"] = "commit"
        else:
            base["source"] = "none"
        base["error"] = None
    except HTTPException as exc:
        runtime.LOGGER.warning("GitHub update check failed: %s", exc.detail)
        base["checkedAt"] = datetime.utcnow().isoformat()
        base["error"] = str(exc.detail)
    except Exception as exc:
        runtime.LOGGER.exception("Unexpected GitHub update check error")
        base["checkedAt"] = datetime.utcnow().isoformat()
        base["error"] = f"检查更新失败: {exc}"

    await set_json_cache("github_update_status", REPO_FULL_NAME, base, GITHUB_UPDATES_CACHE_TTL_SECONDS)
    _write_status_file(base)
    return base


async def warm_github_update_check_on_startup() -> None:
    try:
        await fetch_github_update_status(force_refresh=True)
    except Exception:
        runtime.LOGGER.exception("GitHub update warm-up failed")


@ROUTER.get("/github/updates/status")
async def github_updates_status():
    cached = await get_json_cache("github_update_status", REPO_FULL_NAME)
    if isinstance(cached, dict):
        return {**_empty_status(), **cached}
    return _read_status_file()


@ROUTER.post("/github/updates/check")
async def github_updates_check():
    return await fetch_github_update_status(force_refresh=True)


__all__ = [
    "ROUTER",
    "fetch_github_update_status",
    "github_updates_check",
    "github_updates_status",
    "warm_github_update_check_on_startup",
]
