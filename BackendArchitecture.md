# Backend Architecture

QuantDash 后端默认遵循“按业务域拆分”的结构，不采用单一全局 `controllers/services/models` 目录。

## 总原则

- 数据采集与批处理默认优先 Python。
- FastAPI 路由层保持轻量，只做参数接收、鉴权和响应组装。
- 复杂抓取、策略判断、第三方对接应拆到 action 级文件，不继续堆大模块。

## 目录规则

- `scripts/server/app.py` 负责应用组装和 router 注册。
- `scripts/server/modules/<domain>.py` 只保留 domain 入口或轻量编排。
- 当某个模块继续增长时，拆成 `<domain>_<action>.py`，例如：
  - `screener_market_data.py`
  - `screener_quote_data.py`
  - `screener_kline_data.py`
- 共享运行时、日志、HTTP client、环境路径统一放 `scripts/server/shared/*`。

## 职责边界

- `auth`：鉴权、用户上下文、watchlist 持久化相关校验。
- `watchlist`：监控条件计算、监控信号附加，不负责选股候选获取。
- `screener`：路由编排和策略入口，不直接塞行情抓取细节。
- `integrations`：飞书、模型代理、外部服务配置与测试。
- `sync runtime / data scripts`：采集、同步、离线数据处理。

## 代码规则

- controller / route 不直接写大段抓取逻辑。
- repository 或持久化读写逻辑不要依赖上层业务模块。
- utility 若只服务单一 domain，应留在该 domain 下，不放到 `shared`。
- 兼容旧路径时，仅允许“读兼容”，写路径必须收口到当前主路径。

## 演进规则

- 文件超过一个清晰职责边界时就拆，不等到超大文件再处理。
- 新增能力优先新建文件，不往已有热点文件尾部持续追加。
- 拆分后要保留稳定的 facade / re-export，避免前端或其它模块调用面大幅震荡。

## 多数据源规则

- 外部市场数据默认以 `primary source + optional secondary source` 方式组织，不在前端页面里散落切换逻辑。
- 数据源切换策略应由 Python 侧统一执行，前端只负责展示策略、来源和时间戳。
- 第二数据源只接入“字段可稳定映射”的数据集，不强行覆盖 EastMoney 独有榜单类数据。
- 数据源策略优先支持：
  - 全局模式
  - 按数据集覆盖
  - 健康检查 / 探测
- 多数据源相关状态应通过轻量 status 接口汇总，不要求前端拼多个探测请求。
