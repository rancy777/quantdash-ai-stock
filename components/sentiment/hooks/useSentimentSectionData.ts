import { useEffect, useState } from 'react';

import { BoardHeightEntry, BullBearSignalSnapshot, EmotionIndicatorEntry, IndexFuturesLongShortSeries } from '../../../types';

import useSentimentDataLoaders from './useSentimentDataLoaders';
import useSentimentSelectionSync from './useSentimentSelectionSync';
import {
  BrokenEntry,
  CoeffEntry,
  CycleOverview,
  DataSourceState,
  HighRiskEntry,
  LeaderEntry,
  PremiumEntry,
  RepairEntry,
  SentimentMetricId,
  StructureEntry,
  VolumeTrendEntry,
} from './types';

export type {
  BrokenEntry,
  CoeffEntry,
  CycleOverview,
  DataSourceState,
  HighRiskEntry,
  LeaderEntry,
  PremiumEntry,
  RepairEntry,
  SentimentMetricId,
  StructureEntry,
  VolumeTrendEntry,
} from './types';

export default function useSentimentSectionData() {
  const [activeMetric, setActiveMetric] = useState<SentimentMetricId>('pressure');
  const [coeffData, setCoeffData] = useState<CoeffEntry[]>([]);
  const [realTimeBreadth, setRealTimeBreadth] = useState<{ rise: number; fall: number; flat: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [currentLimitUpCount, setCurrentLimitUpCount] = useState<number | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string[]>(['value', 'height', 'limitUpCount', 'riseCount']);
  const [currentRiseCount, setCurrentRiseCount] = useState<number | null>(null);
  const [premiumData, setPremiumData] = useState<PremiumEntry[]>([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [currentPremium, setCurrentPremium] = useState<number | null>(null);
  const [currentSuccessRate, setCurrentSuccessRate] = useState<number | null>(null);
  const [currentFollowThrough, setCurrentFollowThrough] = useState<number | null>(null);
  const [currentPremiumDate, setCurrentPremiumDate] = useState<string | null>(null);
  const [brokenData, setBrokenData] = useState<BrokenEntry[]>([]);
  const [brokenLoading, setBrokenLoading] = useState(false);
  const [currentBrokenRate, setCurrentBrokenRate] = useState<number | null>(null);
  const [currentBrokenCount, setCurrentBrokenCount] = useState<number | null>(null);
  const [currentBrokenLimitUp, setCurrentBrokenLimitUp] = useState<number | null>(null);
  const [structureData, setStructureData] = useState<StructureEntry[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [currentStructureDate, setCurrentStructureDate] = useState<string | null>(null);
  const [currentFirstBoardCount, setCurrentFirstBoardCount] = useState<number | null>(null);
  const [currentRelayCount, setCurrentRelayCount] = useState<number | null>(null);
  const [currentHighBoardCount, setCurrentHighBoardCount] = useState<number | null>(null);
  const [currentFirstBoardRatio, setCurrentFirstBoardRatio] = useState<number | null>(null);
  const [repairData, setRepairData] = useState<RepairEntry[]>([]);
  const [repairLoading, setRepairLoading] = useState(false);
  const [currentRepairDate, setCurrentRepairDate] = useState<string | null>(null);
  const [currentBrokenRepairRate, setCurrentBrokenRepairRate] = useState<number | null>(null);
  const [currentBigFaceRepairRate, setCurrentBigFaceRepairRate] = useState<number | null>(null);
  const [currentRepairBrokenCount, setCurrentRepairBrokenCount] = useState<number | null>(null);
  const [currentBigFaceCount, setCurrentBigFaceCount] = useState<number | null>(null);
  const [leaderData, setLeaderData] = useState<LeaderEntry[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [currentLeader, setCurrentLeader] = useState<{ name: string; symbol: string; label: string } | null>(null);
  const [currentLeaderBoard, setCurrentLeaderBoard] = useState<number | null>(null);
  const [currentLeaderNextClose, setCurrentLeaderNextClose] = useState<number | null>(null);
  const [currentThreePlusCount, setCurrentThreePlusCount] = useState<number | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [cycleOverview, setCycleOverview] = useState<CycleOverview | null>(null);
  const [volumeTrendData, setVolumeTrendData] = useState<VolumeTrendEntry[]>([]);
  const [highRiskData, setHighRiskData] = useState<HighRiskEntry[]>([]);
  const [sentimentSource, setSentimentSource] = useState<DataSourceState>('unknown');
  const [sentimentUpdatedAt, setSentimentUpdatedAt] = useState<string | null>(null);
  const [performanceSource, setPerformanceSource] = useState<DataSourceState>('unknown');
  const [performanceUpdatedAt, setPerformanceUpdatedAt] = useState<string | null>(null);
  const [structureSource, setStructureSource] = useState<DataSourceState>('unknown');
  const [structureUpdatedAt, setStructureUpdatedAt] = useState<string | null>(null);
  const [repairSource, setRepairSource] = useState<DataSourceState>('unknown');
  const [repairUpdatedAt, setRepairUpdatedAt] = useState<string | null>(null);
  const [leaderSource, setLeaderSource] = useState<DataSourceState>('unknown');
  const [leaderUpdatedAt, setLeaderUpdatedAt] = useState<string | null>(null);
  const [sentimentLoadingMode, setSentimentLoadingMode] = useState<DataSourceState>('unknown');
  const [premiumLoadingMode, setPremiumLoadingMode] = useState<DataSourceState>('unknown');
  const [brokenLoadingMode, setBrokenLoadingMode] = useState<DataSourceState>('unknown');
  const [structureLoadingMode, setStructureLoadingMode] = useState<DataSourceState>('unknown');
  const [repairLoadingMode, setRepairLoadingMode] = useState<DataSourceState>('unknown');
  const [leaderLoadingMode, setLeaderLoadingMode] = useState<DataSourceState>('unknown');
  const [boardHeightData, setBoardHeightData] = useState<BoardHeightEntry[]>([]);
  const [boardHeightLoading, setBoardHeightLoading] = useState(false);
  const [boardHeightSource, setBoardHeightSource] = useState<DataSourceState>('unknown');
  const [boardHeightUpdatedAt, setBoardHeightUpdatedAt] = useState<string | null>(null);
  const [emotionIndicatorData, setEmotionIndicatorData] = useState<EmotionIndicatorEntry[]>([]);
  const [emotionIndicatorLoading, setEmotionIndicatorLoading] = useState(false);
  const [emotionIndicatorSource, setEmotionIndicatorSource] = useState<DataSourceState>('unknown');
  const [emotionIndicatorUpdatedAt, setEmotionIndicatorUpdatedAt] = useState<string | null>(null);
  const [bullBearSignal, setBullBearSignal] = useState<BullBearSignalSnapshot | null>(null);
  const [bullBearHistory, setBullBearHistory] = useState<BullBearSignalSnapshot[]>([]);
  const [selectedBullBearDate, setSelectedBullBearDate] = useState<string | null>(null);
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState('');
  const [indexFuturesLongShortData, setIndexFuturesLongShortData] = useState<IndexFuturesLongShortSeries[]>([]);
  const [selectedIndexFuturesCode, setSelectedIndexFuturesCode] = useState<'IF' | 'IC' | 'IH' | 'IM'>('IF');
  const [selectedEmotionSeries, setSelectedEmotionSeries] = useState<string[]>([
    'ftseA50',
    'nasdaq',
    'offshoreRmb',
    'indexFuturesLongShortRatio',
  ]);

  const {
    handleRefresh,
    loadBoardHeightData,
    loadBrokenData,
    loadData,
    loadEmotionIndicatorData,
    loadLeaderData,
    loadPremiumData,
    loadPressureOverview,
    loadRepairData,
    loadStructureData,
  } = useSentimentDataLoaders({
    activeMetric,
    setBoardHeightData,
    setBoardHeightLoading,
    setBoardHeightSource,
    setBrokenData,
    setBrokenLoading,
    setBrokenLoadingMode,
    setBullBearHistory,
    setBullBearSignal,
    setCoeffData,
    setCurrentBigFaceCount,
    setCurrentBigFaceRepairRate,
    setCurrentBrokenCount,
    setCurrentBrokenLimitUp,
    setCurrentBrokenRate,
    setCurrentBrokenRepairRate,
    setCurrentFirstBoardCount,
    setCurrentFirstBoardRatio,
    setCurrentFollowThrough,
    setCurrentHeight,
    setCurrentHighBoardCount,
    setCurrentLeader,
    setCurrentLeaderBoard,
    setCurrentLeaderNextClose,
    setCurrentLimitUpCount,
    setCurrentPremium,
    setCurrentPremiumDate,
    setCurrentRelayCount,
    setCurrentRepairBrokenCount,
    setCurrentRepairDate,
    setCurrentRiseCount,
    setCurrentScore,
    setCurrentStructureDate,
    setCurrentSuccessRate,
    setCurrentThreePlusCount,
    setCycleOverview,
    setEmotionIndicatorData,
    setEmotionIndicatorLoading,
    setEmotionIndicatorSource,
    setEmotionIndicatorUpdatedAt,
    setHighRiskData,
    setIndexFuturesLongShortData,
    setIsRefreshing,
    setLeaderData,
    setLeaderLoading,
    setLeaderLoadingMode,
    setLeaderSource,
    setLoading,
    setOverviewLoading,
    setPerformanceSource,
    setPerformanceUpdatedAt,
    setPremiumData,
    setPremiumLoading,
    setPremiumLoadingMode,
    setRealTimeBreadth,
    setRepairData,
    setRepairLoading,
    setRepairLoadingMode,
    setRepairSource,
    setRepairUpdatedAt,
    setSelectedBullBearDate,
    setSentimentLoadingMode,
    setSentimentSource,
    setSentimentUpdatedAt,
    setStructureData,
    setStructureLoading,
    setStructureLoadingMode,
    setStructureSource,
    setStructureUpdatedAt,
    setVolumeTrendData,
    setLeaderUpdatedAt,
    setBoardHeightUpdatedAt,
  });

  useEffect(() => {
    if (activeMetric === 'pressure') {
      void loadData();
      void loadPressureOverview();
    } else if (activeMetric === 'premium') {
      void loadPremiumData();
    } else if (activeMetric === 'broken') {
      void loadBrokenData();
    } else if (activeMetric === 'structure') {
      void loadStructureData();
    } else if (activeMetric === 'repair') {
      void loadRepairData();
    } else if (activeMetric === 'leader') {
      void loadLeaderData();
    } else if (activeMetric === 'height') {
      void loadBoardHeightData();
    } else if (activeMetric === 'emotion') {
      void loadEmotionIndicatorData();
    }
  }, [
    activeMetric,
    loadBoardHeightData,
    loadBrokenData,
    loadData,
    loadEmotionIndicatorData,
    loadLeaderData,
    loadPremiumData,
    loadPressureOverview,
    loadRepairData,
    loadStructureData,
  ]);

  const { historicalDateOptions } = useSentimentSelectionSync({
    activeMetric,
    boardHeightData,
    brokenData,
    bullBearHistory,
    coeffData,
    leaderData,
    premiumData,
    repairData,
    selectedBullBearDate,
    selectedEmotionSeries,
    selectedHistoricalDate,
    selectedSeries,
    setBullBearSignal,
    setSelectedBullBearDate,
    setSelectedEmotionSeries,
    setSelectedHistoricalDate,
    setSelectedSeries,
    structureData,
  });

  return {
    activeMetric,
    boardHeightData,
    boardHeightLoading,
    boardHeightSource,
    boardHeightUpdatedAt,
    brokenData,
    brokenLoading,
    brokenLoadingMode,
    bullBearHistory,
    bullBearSignal,
    coeffData,
    currentBigFaceCount,
    currentBigFaceRepairRate,
    currentBrokenCount,
    currentBrokenLimitUp,
    currentBrokenRate,
    currentBrokenRepairRate,
    currentFirstBoardCount,
    currentFirstBoardRatio,
    currentFollowThrough,
    currentHeight,
    currentHighBoardCount,
    currentLeader,
    currentLeaderBoard,
    currentLeaderNextClose,
    currentLimitUpCount,
    currentPremium,
    currentPremiumDate,
    currentRelayCount,
    currentRepairBrokenCount,
    currentRepairDate,
    currentRiseCount,
    currentScore,
    currentStructureDate,
    currentSuccessRate,
    currentThreePlusCount,
    cycleOverview,
    emotionIndicatorData,
    emotionIndicatorLoading,
    emotionIndicatorSource,
    emotionIndicatorUpdatedAt,
    handleRefresh,
    highRiskData,
    historicalDateOptions,
    indexFuturesLongShortData,
    isRefreshing,
    leaderData,
    leaderLoading,
    leaderLoadingMode,
    leaderSource,
    loading,
    overviewLoading,
    performanceSource,
    performanceUpdatedAt,
    premiumData,
    premiumLoading,
    premiumLoadingMode,
    realTimeBreadth,
    repairData,
    repairLoading,
    repairLoadingMode,
    repairSource,
    repairUpdatedAt,
    selectedBullBearDate,
    selectedEmotionSeries,
    selectedHistoricalDate,
    selectedIndexFuturesCode,
    selectedSeries,
    sentimentLoadingMode,
    sentimentSource,
    sentimentUpdatedAt,
    setActiveMetric,
    setSelectedBullBearDate,
    setSelectedEmotionSeries,
    setSelectedHistoricalDate,
    setSelectedIndexFuturesCode,
    setSelectedSeries,
    structureData,
    structureLoading,
    structureLoadingMode,
    structureSource,
    structureUpdatedAt,
    leaderUpdatedAt,
    volumeTrendData,
  };
}
