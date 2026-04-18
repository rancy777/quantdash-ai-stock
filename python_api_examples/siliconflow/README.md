# SiliconFlow Python 调用示例

这个目录专门放硅基流动 API 的 Python 调用代码。

## 文件说明

- `config.py`: 公共配置，统一读取 `api_key`、`base_url`、`model`
- `chat_completion.py`: 最基础的单轮对话调用
- `stream_chat.py`: 流式输出调用
- `multi_turn_chat.py`: 多轮对话调用

## 安装依赖

在项目根目录执行：

```powershell
venv\Scripts\pip install -r requirements.txt
```

## 推荐做法

先设置环境变量，再直接运行脚本：

```powershell
$env:SILICONFLOW_API_KEY="你的硅基流动密钥"
$env:SILICONFLOW_BASE_URL="https://api.siliconflow.cn/v1"
$env:SILICONFLOW_MODEL="Pro/zai-org/GLM-4.7"
venv\Scripts\python.exe python_api_examples/siliconflow/chat_completion.py
```

也可以每次通过命令行传参：

```powershell
venv\Scripts\python.exe python_api_examples/siliconflow/chat_completion.py --api-key "你的密钥" --model "Pro/zai-org/GLM-4.7" --user "你好，请介绍一下你自己"
```

## 和前端的对应关系

仓库里的 `AI对接 -> 模型对接` 页面已经有可填写字段：

- `模型名` 对应 Python 里的 `model`
- `Base URL` 对应 Python 里的 `base_url`
- `Token / API Key` 对应 Python 里的 `api_key`

现在默认模型列表里也已经补了 `硅基流动 / SiliconFlow`，你可以直接在前端填这三个值，不需要再手动记接口地址。
