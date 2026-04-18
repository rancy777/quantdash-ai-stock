import { BoardHeightEntry, BullBearSignalSnapshot, EmotionIndicatorEntry, IndexFuturesLongShortSeries } from '../../../types';

export type SentimentMetricId =
  | 'currentCycle'
  | 'pressure'
  | 'premium'
  | 'broken'
  | 'structure'
  | 'repair'
  | 'leader'
  | 'height'
  | 'emotion';

export type DataSourceState = 'local' | 'api' | 'unknown';

export type CoeffEntry = {
  date: string;
  value: number;
  height: number;
  limitUpCount: number;
  limitDownCount: number;
  riseCount?: number;
};

export type PremiumEntry = {
  date: string;
  premium: number;
  successRate: number;
  limitUpCount: number;
  followThroughCount: number;
};

export type BrokenEntry = {
  date: string;
  brokenRate: number;
  brokenCount: number;
  limitUpCount: number;
};

export type StructureEntry = {
  date: string;
  firstBoardCount: number;
  secondBoardCount: number;
  thirdBoardCount: number;
  highBoardCount: number;
  totalLimitUpCount: number;
  firstBoardRatio: number;
  relayCount: number;
  highBoardRatio: number;
};

export type RepairEntry = {
  date: string;
  brokenCount: number;
  brokenRepairCount: number;
  brokenRepairRate: number;
  bigFaceCount: number;
  bigFaceRepairCount: number;
  bigFaceRepairRate: number;
};

export type LeaderEntry = {
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
};

export type CycleOverview = {
  stage: '冰点' | '试错' | '主升' | '分歧' | '修复' | '退潮';
  confidence: number;
  riskLevel: '低风险' | '中风险' | '高风险';
  volumeState: '持续放量' | '存量震荡' | '缩量再缩量' | '放量滞涨';
  latestVolumeAmount: number | null;
  volumeChangeRate: number | null;
  reasons: string[];
};

export type VolumeTrendEntry = {
  date: string;
  amount: number;
  changeRate: number | null;
};

export type HighRiskEntry = {
  date: string;
  highBoardCount: number;
  aKillCount: number;
  weakCount: number;
  brokenCount: number;
  brokenRate: number;
  riskLevel: 'low' | 'medium' | 'high';
};

export type SentimentSectionSharedState = {
  boardHeightData: BoardHeightEntry[];
  brokenData: BrokenEntry[];
  bullBearHistory: BullBearSignalSnapshot[];
  bullBearSignal: BullBearSignalSnapshot | null;
  coeffData: CoeffEntry[];
  emotionIndicatorData: EmotionIndicatorEntry[];
  indexFuturesLongShortData: IndexFuturesLongShortSeries[];
  leaderData: LeaderEntry[];
  premiumData: PremiumEntry[];
  repairData: RepairEntry[];
  structureData: StructureEntry[];
  volumeTrendData: VolumeTrendEntry[];
};
