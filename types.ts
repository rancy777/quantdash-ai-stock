
export interface Stock {
  symbol: string;
  name: string;
  price: number;
  pctChange: number;
  volume: string;
  turnover: string;
  industry: string;
  concepts: string[];
  limitUpTime?: string;
  // New fields for screener/API
  pe?: number;       // P/E Ratio
  pb?: number;       // P/B Ratio
  marketCap?: number;// Market Cap (in Billion usually)
}

export type DataFreshnessSource = 'local' | 'live' | 'cache' | 'snapshot' | 'secondary' | 'mock' | 'unknown';

export interface DataFreshnessMeta {
  source: DataFreshnessSource;
  updatedAt: string | null;
  datasetKey?: string;
  provider?: 'eastmoney' | 'mootdx' | 'local' | 'mock' | 'unknown';
  isSnapshotFallback?: boolean;
  isCached?: boolean;
  detail?: string;
}

export type DataSourcePolicyMode = 'primary_only' | 'auto_fallback' | 'prefer_secondary';

export interface DataSourcePolicyDatasetInfo {
  actions: string[];
  dataset: string;
  label: string;
  secondarySupported: boolean;
}

export interface DataSourcePolicyState {
  datasetOverrides: Record<string, DataSourcePolicyMode>;
  globalMode: DataSourcePolicyMode;
  mode: DataSourcePolicyMode;
  primaryOnlyDatasets: DataSourcePolicyDatasetInfo[];
  secondaryProvider: 'mootdx';
  secondaryAvailable: boolean;
  secondaryReason: string | null;
  supportedActions: string[];
  supportedDatasets: DataSourcePolicyDatasetInfo[];
  updatedAt: string | null;
}

export interface SecondaryHealthProbeResult {
  checkedAt: string | null;
  detail: string;
  latencyMs: number | null;
  ok: boolean;
  sampleSize: number | null;
}

export interface SecondaryHealthState {
  available: boolean;
  configuredProvider: 'mootdx';
  lastCheckedAt: string | null;
  lastError: string | null;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
  probeResults: Record<string, SecondaryHealthProbeResult>;
  provider: 'mootdx';
  supportedDatasets: string[];
}

export interface DataSourcePolicyStatus {
  providerPolicy: DataSourcePolicyState;
  secondaryHealth: SecondaryHealthState;
}

export interface GithubUpdateCommitInfo {
  author: string | null;
  committedAt: string | null;
  message: string;
  sha: string;
  shortSha: string;
  url: string | null;
}

export interface GithubUpdateReleaseInfo {
  name: string;
  publishedAt: string | null;
  tagName: string;
  url: string | null;
}

export interface GithubUpdateStatus {
  checkedAt: string | null;
  currentBranch: string | null;
  currentCommitSha: string | null;
  currentCommitShort: string | null;
  currentVersion: string | null;
  defaultBranch: string | null;
  error: string | null;
  hasCommitUpdate: boolean;
  hasReleaseUpdate: boolean;
  hasUpdate: boolean;
  latestCommit: GithubUpdateCommitInfo | null;
  latestRelease: GithubUpdateReleaseInfo | null;
  repoFullName: string;
  repoUrl: string;
  source: 'commit' | 'release' | 'none';
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  content: string;
  createdAt?: string;
  url?: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral' | null;
  type: 'notice' | 'news' | 'report';
}

export interface ResearchReportFile {
  id: string;
  name: string;
  title?: string;
  relativePath: string;
  url: string;
  originUrl?: string;
  pdfUrl?: string;
  pdfLocalUrl?: string;
  pdfLocalPath?: string;
  extension: string;
  size: number;
  sizeLabel: string;
  updatedAt: string;
  publishedAt?: string;
  previewType: 'pdf' | 'image' | 'text' | 'office' | 'other';
  sourceType?: 'local' | 'upload';
  sourceLabel?: string;
  sourceKey?: string;
  category?: string;
  reportKind?: 'snapshot' | 'entry' | 'file' | 'upload';
  stockCode?: string;
  stockName?: string;
  orgName?: string;
  rating?: string;
  researcher?: string;
  industryName?: string;
  tags?: string[];
  summary?: string;
}

export type ModelProviderMode = 'cloud' | 'local';

export type ModelProviderProtocol = 'openai' | 'anthropic' | 'gemini' | 'custom';

export type AIPromptTemplateKey =
  | 'reportSummary'
  | 'dailyReview'
  | 'ultraShortAnalysis'
  | 'premarketPlan'
  | 'stockObservation'
  | 'planValidation';

export type AISkillScope = AIPromptTemplateKey;

export interface AIPromptTemplates {
  reportSummary: string;
  dailyReview: string;
  ultraShortAnalysis: string;
  premarketPlan: string;
  stockObservation: string;
  planValidation: string;
}

export interface AISkillDefinition {
  id: string;
  name: string;
  description: string;
  instructions: string;
  githubRepo: string;
  githubNotes: string;
  scopes: AISkillScope[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelProviderConfig {
  id: string;
  providerKey: string;
  displayName: string;
  mode: ModelProviderMode;
  protocol: ModelProviderProtocol;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  supportsMcp: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIIntegrationSettings {
  providers: ModelProviderConfig[];
  preferredProviderId: string | null;
  mcpProjectPath: string;
  promptTemplates: AIPromptTemplates;
  skills: AISkillDefinition[];
  updatedAt: string;
}

export interface FeishuBotConfig {
  appId: string;
  appSecret: string;
  verificationToken: string;
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
}

export interface FeishuBotConfigTestResult {
  ok: boolean;
  kind: 'success' | 'warning' | 'error';
  statusLabel: string;
  detail: string;
  checkedAt: string;
}

export interface ReportAISummaryEntry {
  id: string;
  reportId: string;
  providerId: string;
  providerName: string;
  summary: string;
  generatedAt: string;
  contentMode: 'fulltext' | 'metadata';
}

export interface ExpertHoldingRecord {
  group: string;
  nickname: string;
  assetScaleWan: number | null;
  dailyReturnPct: number | null;
  weeklyReturnPct: number | null;
  holdings: string;
  notes: string;
}

export interface ExpertHoldingSnapshot {
  id: string;
  date: string;
  fileName: string;
  recordCount: number;
  groups: string[];
  records: ExpertHoldingRecord[];
}

export interface SentimentData {
  date: string;
  value: number;
}

export interface MarketSentiment {
  label: string;
  score: number;
  description: string;
  trend: 'up' | 'down' | 'flat';
}

export interface EmotionIndicatorEntry {
  date: string;
  ftseA50: number;
  nasdaq: number;
  dowJones: number;
  sp500: number;
  offshoreRmb: number;
  ashareAvgValuation: number;
  indexFuturesLongShortRatio?: number;
}

export interface IndexFuturesLongShortPoint {
  date: string;
  longPosition: number;
  shortPosition: number;
}

export interface IndexFuturesLongShortSeries {
  code: 'IF' | 'IC' | 'IH' | 'IM';
  label: string;
  mainContract: string;
  history: IndexFuturesLongShortPoint[];
}

export interface BullBearRangeBucket {
  label: string;
  count: number;
  tone: 'up' | 'down' | 'flat';
}

export interface BullBearSignalSnapshot {
  date: string;
  riseCount: number;
  fallCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  naturalLimitUpCount: number;
  naturalLimitDownCount: number;
  totalAmount: number;
  amountChangeRate: number | null;
  rangeBuckets: BullBearRangeBucket[];
}

export interface LadderData {
  date?: string;
  dates: string[];
  boardCounts: {
     label: string; // "7板以上", "3板"
     count: number;
     data: { [date: string]: Stock[] };
  }[];
}

export interface SentimentEntry {
  date: string;
  value: number;
  height: number;
  limitUpCount: number;
  limitDownCount: number;
  riseCount?: number;
  rawZt?: {
    counts: Record<number, number>;
    total: number;
  };
}

export interface LimitUpStructureEntry {
  date: string;
  firstBoardCount: number;
  secondBoardCount: number;
  thirdBoardCount: number;
  highBoardCount: number;
  totalLimitUpCount: number;
  firstBoardRatio: number;
  relayCount: number;
  highBoardRatio: number;
}

export interface RepairRateEntry {
  date: string;
  brokenCount: number;
  brokenRepairCount: number;
  brokenRepairRate: number;
  bigFaceCount: number;
  bigFaceRepairCount: number;
  bigFaceRepairRate: number;
}

export interface LeaderStateEntry {
  date: string;
  leaderSymbol: string;
  leaderName: string;
  leaderBoardCount: number;
  leaderCount: number;
  secondHighestBoard: number;
  threePlusCount: number;
  continuedCount: number;
  nextOpenPct: number | null;
  nextClosePct: number | null;
  isOneWord: boolean;
  statusLabel: string;
}

export interface BoardHeightEntry {
  date: string;
  fullDate?: string;
  mainBoardHighest: number;
  mainBoardHighestNames: string[];
  mainBoardHighestSymbols: string[];
  mainBoardSecondHighest: number;
  mainBoardSecondHighestNames: string[];
  mainBoardSecondHighestSymbols: string[];
  chinextHighest: number;
  chinextHighestNames: string[];
  chinextHighestSymbols: string[];
}

export interface MarketVolumeTrendEntry {
  date: string;
  amount: number;
  changeRate: number | null;
}

export interface HighRiskEntry {
  date: string;
  highBoardCount: number;
  aKillCount: number;
  weakCount: number;
  brokenCount: number;
  brokenRate: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CycleOverviewData {
  stage: '冰点' | '试错' | '主升' | '分歧' | '修复' | '退潮';
  confidence: number;
  riskLevel: '低风险' | '中风险' | '高风险';
  volumeState: '持续放量' | '存量震荡' | '缩量再缩量' | '放量滞涨';
  latestVolumeAmount: number | null;
  volumeChangeRate: number | null;
  reasons: string[];
}

export interface SyncStatusStageEntry {
  key: string;
  name: string;
  status: 'completed' | 'skipped' | 'failed';
  reason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface SyncStatusPayload {
  trigger: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  updatedAt: string;
  overallStatus: 'completed' | 'failed';
  counts: {
    completed: number;
    skipped: number;
    failed: number;
    total: number;
  };
  onlineTradingDate: string | null;
  onlineMonthDay: string | null;
  latestSnapshots: {
    sentiment: string | null;
    performance: string | null;
    emotion: string | null;
    cycle: string | null;
    klineManifestCount: number;
    klineManifestStamp: string | null;
  };
  stages: SyncStatusStageEntry[];
  extra?: Record<string, unknown>;
}

export interface SyncRuntimeStatus {
  state: 'idle' | 'running';
  trigger: string | null;
  mode: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  error: string | null;
  pid: number | null;
}

export interface SectorItem {
  code: string;
  name: string;
  pctChange: number;
  rank: number;
}

export type SectorBoardType = 'concept' | 'industry';

export interface SectorCycleData {
  dates: string[];
  ranks: number[]; // 1 to 10
  data: { 
    [date: string]: { 
      [rank: number]: SectorItem 
    } 
  };
}

export interface SectorPersistenceEntry {
  date: string;
  leaderName: string;
  leaderCode: string;
  leaderPctChange: number;
  streakDays: number;
  topThreeAppearances: number;
  strengthDelta: number | null;
}

export interface SectorPersistenceData {
  boardType: SectorBoardType;
  currentLeaderName: string;
  currentLeaderCode: string;
  currentLeaderPctChange: number;
  currentStreakDays: number;
  currentTopThreeAppearances: number;
  strongestRepeatName: string;
  strongestRepeatCount: number;
  entries: SectorPersistenceEntry[];
}

export interface KlineData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export type ChanPointType = 'top' | 'bottom';

export type ChanDirection = 'up' | 'down';

export interface ChanMergedKline {
  sourceIndex: number;
  date: string;
  high: number;
  low: number;
}

export interface ChanFractal {
  index: number;
  mergedIndex: number;
  price: number;
  type: ChanPointType;
  date: string;
}

export interface ChanBi {
  id: string;
  direction: ChanDirection;
  start: ChanFractal;
  end: ChanFractal;
  high: number;
  low: number;
}

export interface ChanSegment {
  id: string;
  direction: ChanDirection;
  start: ChanFractal;
  end: ChanFractal;
  high: number;
  low: number;
  biCount: number;
}

export interface ChanPivotZone {
  id: string;
  startIndex: number;
  endIndex: number;
  upper: number;
  lower: number;
  sourceLevel: 'bi' | 'segment';
  overlapCount: number;
}

export interface ChanStructureSummary {
  mergedCount: number;
  fractalCount: number;
  biCount: number;
  segmentCount: number;
  pivotZoneCount: number;
  latestDirection: ChanDirection | null;
}

export interface ChanAnalysisResult {
  mergedKlines: ChanMergedKline[];
  fractals: ChanFractal[];
  bis: ChanBi[];
  segments: ChanSegment[];
  pivotZones: ChanPivotZone[];
  summary: ChanStructureSummary;
}
