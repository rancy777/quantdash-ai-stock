import argparse
import os
from typing import Optional

from openai import OpenAI

DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_MODEL = "Pro/zai-org/GLM-4.7"
DEFAULT_SYSTEM_PROMPT = "你是一个有用的助手"


def build_parser(description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--api-key", default=os.getenv("SILICONFLOW_API_KEY", "").strip())
    parser.add_argument("--base-url", default=os.getenv("SILICONFLOW_BASE_URL", DEFAULT_BASE_URL).strip())
    parser.add_argument("--model", default=os.getenv("SILICONFLOW_MODEL", DEFAULT_MODEL).strip())
    parser.add_argument("--system", default=os.getenv("SILICONFLOW_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT).strip())
    parser.add_argument("--user", default="", help="用户消息，留空时使用脚本内默认值。")
    return parser


def require_api_key(api_key: str) -> str:
    value = api_key.strip()
    if not value:
        raise ValueError(
            "缺少 API Key。请通过 --api-key 传入，或先设置环境变量 SILICONFLOW_API_KEY。"
        )
    return value


def build_client(api_key: str, base_url: Optional[str] = None) -> OpenAI:
    return OpenAI(
        api_key=require_api_key(api_key),
        base_url=(base_url or DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL,
    )
