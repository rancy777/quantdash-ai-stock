from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StockPayload(StrictModel):
    symbol: str
    name: str
    price: float
    pctChange: float
    volume: str
    turnover: str
    industry: str
    concepts: List[str]
    pe: float = 0.0
    pb: float = 0.0
    marketCap: float = 0.0


class AuthRequest(StrictModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(StrictModel):
    token: str
    username: str


class MeResponse(StrictModel):
    username: str


class WatchlistEntry(StrictModel):
    symbol: str
    name: str
    price: float
    pctChange: float
    volume: str
    turnover: str
    industry: str
    concepts: List[str]
    pe: Optional[float] = None
    pb: Optional[float] = None
    marketCap: Optional[float] = None
    screenerSource: Optional[Dict[str, Any]] = None
    monitorConditions: List["MonitorCondition"] = Field(default_factory=list)
    monitorSignals: List["MonitorSignal"] = Field(default_factory=list)


class MonitorCondition(StrictModel):
    id: Optional[str] = None
    type: Literal["volume_ratio", "price_touch_ma"]
    label: Optional[str] = None
    enabled: bool = True
    ratio: Optional[float] = None
    lookbackDays: Optional[int] = None
    minVolume: Optional[float] = None
    maWindow: Optional[int] = None
    tolerancePct: Optional[float] = None


class MonitorSignal(StrictModel):
    conditionId: Optional[str] = None
    conditionType: str
    triggered: bool
    checkedAt: str
    message: str
    metrics: Dict[str, Any] = Field(default_factory=dict)


class ChangePasswordRequest(StrictModel):
    oldPassword: str = Field(min_length=8, max_length=128)
    newPassword: str = Field(min_length=8, max_length=128)


class SyncTriggerResponse(StrictModel):
    status: str
    trigger: str
    mode: str
    startedAt: str
    pid: Optional[int] = None


class FeishuBotConfigPayload(StrictModel):
    appId: str = ""
    appSecret: str = ""
    verificationToken: str = ""
    aiBaseUrl: str = ""
    aiApiKey: str = ""
    aiModel: str = ""


class FeishuBotConfigTestResult(StrictModel):
    ok: bool
    kind: Literal["success", "warning", "error"]
    statusLabel: str
    detail: str
    checkedAt: str


class ModelInvokePayload(StrictModel):
    providerKey: str = ""
    protocol: Literal["openai", "anthropic", "gemini", "custom"] = "openai"
    baseUrl: str = Field(min_length=8, max_length=512)
    apiKey: str = ""
    model: str = Field(min_length=1, max_length=128)
    systemPrompt: str = ""
    userPrompt: str = Field(min_length=1, max_length=20000)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    maxTokens: Optional[int] = Field(default=None, ge=1, le=32000)

    @field_validator("baseUrl")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("baseUrl 必须以 http:// 或 https:// 开头")
        return value.rstrip("/")


class ModelInvokeResponse(StrictModel):
    content: str


class EastmoneyProxyPayload(StrictModel):
    url: str = Field(min_length=12, max_length=2048)
    timeoutMs: int = Field(default=8000, ge=1000, le=20000)


EastmoneyActionName = Literal[
    "major_indexes",
    "stock_list_page",
    "chinext_list",
    "stock_kline",
    "index_kline",
    "sector_board_list",
    "sector_board_history",
    "limit_up_pool",
    "broken_pool",
    "limit_down_pool",
    "market_breadth_overview",
    "full_market_rows",
    "full_market_pct_snapshot",
    "emotion_index_series",
    "ashare_average_pe",
    "index_amount_series",
    "futures_main_contract",
    "futures_net_position",
]


class EastmoneyActionPayload(StrictModel):
    action: EastmoneyActionName
    params: Dict[str, Any] = Field(default_factory=dict)
    timeoutMs: int = Field(default=8000, ge=1000, le=20000)
    preferSnapshot: bool = False
    forceRefresh: bool = False


EastmoneyProviderPolicyMode = Literal["primary_only", "auto_fallback", "prefer_secondary"]


class EastmoneyProviderPolicyPayload(StrictModel):
    mode: Optional[EastmoneyProviderPolicyMode] = None
    globalMode: Optional[EastmoneyProviderPolicyMode] = None
    datasetOverrides: Dict[str, EastmoneyProviderPolicyMode] = Field(default_factory=dict)


class SkillLibraryEntry(StrictModel):
    id: str
    name: str
    description: str = ""
    instructions: str
    scopes: List[
        Literal[
            "reportSummary",
            "dailyReview",
            "ultraShortAnalysis",
            "premarketPlan",
            "stockObservation",
            "planValidation",
        ]
    ] = Field(default_factory=list)
    fileName: str
    sourceTitle: str
    updatedAt: str
    readOnly: bool = True


class SkillLibraryResponse(StrictModel):
    entries: List[SkillLibraryEntry] = Field(default_factory=list)


ScreenerStrategyMatcherKind = Literal["matcher_a", "matcher_b", "matcher_c", "matcher_d"]


class ScreenerStrategyMatcher(StrictModel):
    kind: ScreenerStrategyMatcherKind
    params: Dict[str, Any] = Field(default_factory=dict)


class ScreenerStrategyCatalogEntry(StrictModel):
    id: str
    name: str
    desc: str
    badge: str
    iconKey: str
    tagText: str
    matcher: Optional[ScreenerStrategyMatcher] = None


class ScreenerStrategyCatalogResponse(StrictModel):
    entries: List[ScreenerStrategyCatalogEntry] = Field(default_factory=list)


try:
    WatchlistEntry.model_rebuild()
except AttributeError:
    WatchlistEntry.update_forward_refs()
