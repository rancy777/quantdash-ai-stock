# GitHub 公开前检查清单

## 必做

- 选定并补充 `LICENSE`
- 确认 `LICENSE` 与 README 中的数据公开说明一致
- 如果限制商业使用，确认 README 与仓库描述没有继续宣称 `MIT` 或标准开源许可
- 确认 `.env.local`、本地数据库、会话信息未进入首个提交
- 审核 `data/` 下是否包含不适合公开分发的数据
- 审核 `data/research_reports/auto/` 这类第三方研报原文是否允许公开再分发
- 补充仓库描述、主题、首页链接、截图
- 确认 `README.md` 能让陌生开发者完成最小启动

## 建议

- 首次公开前执行一次目录清理，只保留源码、脚本、必要示例和说明文档
- 把本地配置改为 `.env.example` + `.env.local` 模式
- 补 `CONTRIBUTING.md` 和 `SECURITY.md`
- 首个公开版本打一个 tag，例如 `v0.1.0`
- 如果后续准备接收外部 PR，再补 issue / PR 模板

## 当前仓库特别注意

- Git 仓库已初始化，发布前请先检查首个提交实际会包含哪些文件
- `node_modules/`、`dist/`、`venv/` 只保留本地，不要进仓库
- `.codex/` 属于本地协作配置，不建议放进公开仓库
- `data/auth.db` 与 `data/system/auth.db` 含本地认证状态，不应公开
- `data/klines/`、`data/markets/*/klines/`、`single_day_snapshots/` 这类大体积本地数据建议不要放进首个公开版本
- `草原高手数据/` 这类个人研究资料建议只本地保留
- 自动抓取的研报、资讯、网页快照可能涉及第三方版权或使用条款，建议不要直接放进公开仓库
