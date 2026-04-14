# Contributing

欢迎提交 issue 和 PR。

## 开始之前

1. 先阅读 [README.md](./README.md) 和 [项目使用手册.md](./项目使用手册.md)。
2. 安装依赖：
   - `npm install`
   - `pip install -r requirements.txt`
3. 从 `.env.example` 复制一份本地配置：
   - Windows PowerShell: `Copy-Item .env.example .env.local`
4. 按需填写你自己的本地环境变量，不要提交 `.env.local`。

## 提交约定

- 数据采集相关改动优先放在 `Python` 脚本。
- 前端负责展示、上传、筛选、预览和交互。
- `Node` 层负责启动脚本、任务编排和兼容入口。
- 不要把本地数据库、会话信息、临时导出文件、下载的第三方报告原文提交到仓库。
- 较大的功能改动，先开 issue 说明背景、目标和影响范围。

## 提交前自查

- 前端或服务层改动后运行 `npm run build`
- 新增脚本时补充最小使用说明
- 检查是否误提交了密钥、Cookie、本地路径、账号数据
- 检查是否引入了不适合公开分发的第三方数据或文档快照

## PR 说明建议

- 改了什么
- 为什么改
- 如何验证
- 是否涉及环境变量、数据格式或迁移步骤

如果改动涉及许可证边界、第三方数据再分发或外部内容抓取规则，先开 issue 对齐范围再提交 PR。
