## Feishu Integration

当前文件：

- `bot-server.js`
  飞书长连接机器人服务，负责接收消息、读取本地情绪快照、调用 AI、回发结果。

当前能力：

- 长连接事件接收
- 文本消息问答
- 指定日期情绪周期分析
- 复用 `scripts/sentimentSnapshot.js` 的同口径数据

后续建议继续拆分：

- `client.js`
  飞书开放平台 API 封装
- `message-parser.js`
  用户意图和日期解析
- `prompts.js`
  盘后复盘 / 盘前计划 / 单日分析模板
- `scheduler.py` 或 `scheduler.js`
  定时推送入口
