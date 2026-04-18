[简体中文](./README.md) | English | [日本語](./README.ja.md)

# QuantDash A-Share Trading Dashboard

QuantDash is a Vite + React dashboard for A-share market review, sentiment tracking, sector rotation, AI-assisted post-market review, and pre-market planning.

It is designed as a single workspace for:

- market sentiment cycle tracking
- sell-pressure and risk observation
- limit-up structure and leader monitoring
- sector rotation and theme persistence
- stock review, K-line inspection, and pattern recognition
- AI daily review, pre-market plan, stock notes, and report summary
- reusable `skills` for personal analysis workflows

Full Chinese manual: [项目使用手册.md](./项目使用手册.md)

## Language

- Chinese: [README.md](./README.md)
- English: [README.en.md](./README.en.md)
- Japanese: [README.ja.md](./README.ja.md)

## Note

The Japanese README is provided as a lightweight reference for navigation. The Chinese README remains the primary and most complete version.

## Planned Updates

1. `LLM Wiki` knowledge base
2. automatic stock alert rules
3. improved Elliott Wave and Chan theory drawing tools
4. Hong Kong and US market data integration
5. KaiPanLa data integration

## Screenshots

![Screenshot 01](./images/3bf3d1dc-0c25-4d52-b944-c6e9b4389eaf.png)
![Screenshot 02](./images/4f6ef0a9-e07d-4232-9e5b-8f2bac492cf1.png)
![Screenshot 03](./images/f7af157d-7c69-4346-94b0-530801de7bb5.png)
![Screenshot 04](./images/18c31766-eccb-43fd-a08d-ab959cf38d9d.png)

## License

- This repository is provided under [`PolyForm Noncommercial 1.0.0`](./LICENSE).
- Commercial use is not allowed without separate authorization from the maintainer.
- The public repository does not include `.env.local`, local databases, third-party report originals, webpage snapshots, or personal research material.
- Before using, deploying, or redistributing the project, confirm both code-license scope and data-source licensing scope.

## Highlights

- `Sentiment Cycle`: sell-pressure ratio, repair rate, limit-up structure, leader status, high-risk board
- `Sector Cycle`: sector rotation, theme persistence, core sector tracking
- `Stock View`: stock list, K-line, one-day performance, pattern recognition
- `AI Module`: daily review, pre-market planning, stock notes, report summary
- `Information Hub`: local report list and key news aggregation
- `Skills`: reusable prompt rules and personal analysis frameworks
- `Model Access`: OpenAI, DeepSeek, Ollama, LM Studio, AnythingLLM, SiliconFlow, Volcano Ark
- `Extensions`: local MCP server and Feishu bot integration

## Supported Models / Platforms

| Model / Platform | Status | Notes |
| --- | --- | --- |
| [OpenAI](https://openai.com/) | ✅ | Works with OpenAI-compatible APIs |
| [Ollama](https://ollama.com/) | ✅ | Local LLM runtime |
| [LM Studio](https://lmstudio.ai/) | ✅ | Local LLM runtime |
| [AnythingLLM](https://anythingllm.com/) | ✅ | Local knowledge base and document QA |
| [DeepSeek](https://deepseek.com/) | ✅ | Supports `deepseek-reasoner`, `deepseek-chat`, and related routes |
| [SiliconFlow](https://siliconflow.cn/) | ✅ | OpenAI-compatible model aggregation platform |
| [Volcano Ark](https://www.volcengine.com/product/ark) | ✅ | Access platform for Doubao and other models |

## Quick Start

For frontend only:

1. `npm install`
2. `npm run dev`

For local sync jobs, Python collectors, report sync, or Feishu bot integration:

1. `npm install`
2. `pip install -r requirements.txt`
3. `Copy-Item .env.example .env.local`
4. configure local environment variables as needed
5. `npm run dev`

Recommended first-run check after cloning the public repo:

`npm run sync:startup-check`

Unified project entry:

- Start: `npm run start:project`
- Stop: `npm run stop:project`

Windows can still use `start_project.bat` / `start_project.ps1`, while macOS and Linux can use `start_project.sh` / `stop_project.sh`.

## Common Environment Variables

- `TUSHARE_API_KEY`
- `TUSHARE_API_BASE_URL`
- `PYWENCAI_COOKIE`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_BOT_AI_BASE_URL`
- `FEISHU_BOT_AI_API_KEY`
- `FEISHU_BOT_AI_MODEL`

If you only use the frontend and local file reads, these can remain unset.

## Data Policy

- This public repository does not ship full local market data, local auth state, or third-party source originals.
- To rebuild market snapshots locally, run `npm run sync:*` or the Python collection scripts.
- Data directory policy: [data/README.md](./data/README.md)

## Project Positioning

QuantDash is not just a chart viewer. It is meant to serve as a combined workspace for:

- watching the tape
- post-market review
- pre-market preparation
- structured note-taking
- AI-assisted analysis on top of local structured data
