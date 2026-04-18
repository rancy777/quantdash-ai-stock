import { Dispatch, SetStateAction, useCallback } from 'react';

import {
  getSentimentCoefficientHistory,
  getRealTimeMarketSentiment,
  getLimitUpPremiumHistory,
  getBrokenRateHistory,
  getLimitUpStructureHistory,
  getRepairRateHistory,
  getLeaderStateHistory,
  getBoardHeightHistory,
  getMarketVolumeTrendHistory,
  getHighRiskHistory,
  getCycleOverview,
  resetSentimentData,
  getSentimentDataSource,
  getSentimentUpdatedAt,
  getPerformanceDataSource,
  getPerformanceUpdatedAt,
  getStructureDataSource,
  getStructureUpdatedAt,
  getRepairDataSource,
  getRepairUpdatedAt,
  getLeaderDataSource,
  getLeaderUpdatedAt,
  getBoardHeightDataSource,
  getBoardHeightUpdatedAt,
} from '../../../services/sentimentCycleService';
import {
  getEmotionIndicatorHistory,
  getEmotionIndicatorDataSource,
  getEmotionIndicatorUpdatedAt,
  getIndexFuturesLongShortHistory,
  getBullBearSignalHistory,
} from '../../../services/emotionIndicatorService';
import { checkLocalPublicFileExists } from '../../../services/localDataService';
import { BoardHeightEntry, BullBearSignalSnapshot, EmotionIndicatorEntry, IndexFuturesLongShortSeries } from '../../../types';

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

type Setter<T> = Dispatch<SetStateAction<T>>;

type UseSentimentDataLoadersArgs = {
  activeMetric: SentimentMetricId;
  setBoardHeightData: Setter<BoardHeightEntry[]>;
  setBoardHeightLoading: Setter<boolean>;
  setBoardHeightSource: Setter<DataSourceState>;
  setBrokenData: Setter<BrokenEntry[]>;
  setBrokenLoading: Setter<boolean>;
  setBrokenLoadingMode: Setter<DataSourceState>;
  setBullBearHistory: Setter<BullBearSignalSnapshot[]>;
  setBullBearSignal: Setter<BullBearSignalSnapshot | null>;
  setCoeffData: Setter<CoeffEntry[]>;
  setCurrentBigFaceCount: Setter<number | null>;
  setCurrentBigFaceRepairRate: Setter<number | null>;
  setCurrentBrokenCount: Setter<number | null>;
  setCurrentBrokenLimitUp: Setter<number | null>;
  setCurrentBrokenRate: Setter<number | null>;
  setCurrentBrokenRepairRate: Setter<number | null>;
  setCurrentFirstBoardCount: Setter<number | null>;
  setCurrentFirstBoardRatio: Setter<number | null>;
  setCurrentFollowThrough: Setter<number | null>;
  setCurrentHeight: Setter<number | null>;
  setCurrentHighBoardCount: Setter<number | null>;
  setCurrentLeader: Setter<{ name: string; symbol: string; label: string } | null>;
  setCurrentLeaderBoard: Setter<number | null>;
  setCurrentLeaderNextClose: Setter<number | null>;
  setCurrentLimitUpCount: Setter<number | null>;
  setCurrentPremium: Setter<number | null>;
  setCurrentPremiumDate: Setter<string | null>;
  setCurrentRelayCount: Setter<number | null>;
  setCurrentRepairBrokenCount: Setter<number | null>;
  setCurrentRepairDate: Setter<string | null>;
  setCurrentRiseCount: Setter<number | null>;
  setCurrentScore: Setter<number | null>;
  setCurrentStructureDate: Setter<string | null>;
  setCurrentSuccessRate: Setter<number | null>;
  setCurrentThreePlusCount: Setter<number | null>;
  setCycleOverview: Setter<CycleOverview | null>;
  setEmotionIndicatorData: Setter<EmotionIndicatorEntry[]>;
  setEmotionIndicatorLoading: Setter<boolean>;
  setEmotionIndicatorSource: Setter<DataSourceState>;
  setEmotionIndicatorUpdatedAt: Setter<string | null>;
  setHighRiskData: Setter<HighRiskEntry[]>;
  setIndexFuturesLongShortData: Setter<IndexFuturesLongShortSeries[]>;
  setIsRefreshing: Setter<boolean>;
  setLeaderData: Setter<LeaderEntry[]>;
  setLeaderLoading: Setter<boolean>;
  setLeaderLoadingMode: Setter<DataSourceState>;
  setLeaderSource: Setter<DataSourceState>;
  setLoading: Setter<boolean>;
  setOverviewLoading: Setter<boolean>;
  setPerformanceSource: Setter<DataSourceState>;
  setPerformanceUpdatedAt: Setter<string | null>;
  setPremiumData: Setter<PremiumEntry[]>;
  setPremiumLoading: Setter<boolean>;
  setPremiumLoadingMode: Setter<DataSourceState>;
  setRealTimeBreadth: Setter<{ rise: number; fall: number; flat: number } | null>;
  setRepairData: Setter<RepairEntry[]>;
  setRepairLoading: Setter<boolean>;
  setRepairLoadingMode: Setter<DataSourceState>;
  setRepairSource: Setter<DataSourceState>;
  setRepairUpdatedAt: Setter<string | null>;
  setSelectedBullBearDate: Setter<string | null>;
  setSentimentLoadingMode: Setter<DataSourceState>;
  setSentimentSource: Setter<DataSourceState>;
  setSentimentUpdatedAt: Setter<string | null>;
  setStructureData: Setter<StructureEntry[]>;
  setStructureLoading: Setter<boolean>;
  setStructureLoadingMode: Setter<DataSourceState>;
  setStructureSource: Setter<DataSourceState>;
  setStructureUpdatedAt: Setter<string | null>;
  setVolumeTrendData: Setter<VolumeTrendEntry[]>;
  setLeaderUpdatedAt: Setter<string | null>;
  setBoardHeightUpdatedAt: Setter<string | null>;
};

export default function useSentimentDataLoaders({
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
}: UseSentimentDataLoadersArgs) {
  const loadData = useCallback(async (force = false) => {
    setLoading(true);
    if (force) setIsRefreshing(true);
    const mode = force ? 'api' : ((await checkLocalPublicFileExists('sentiment.json')) ? 'local' : 'api');
    setSentimentLoadingMode(mode);
    try {
      const data = await getSentimentCoefficientHistory(force);
      const breadth = await getRealTimeMarketSentiment();
      setRealTimeBreadth(breadth);

      const mergedData =
        breadth && data.length > 0
          ? data.map((item, index) => (index === data.length - 1 ? { ...item, riseCount: breadth.rise } : item))
          : data;

      setCoeffData(mergedData);
      if (mergedData.length > 0) {
        const last = mergedData[mergedData.length - 1];
        setCurrentScore(last.value);
        setCurrentHeight(last.height);
        setCurrentLimitUpCount(last.limitUpCount);
        setCurrentRiseCount(last.riseCount ?? null);
      } else {
        setCurrentRiseCount(null);
      }
      setSentimentSource(getSentimentDataSource());
      setSentimentUpdatedAt(getSentimentUpdatedAt());
    } catch (error) {
      console.error('Failed to load sentiment data', error);
    }
    setLoading(false);
    setSentimentLoadingMode('unknown');
    if (force) setIsRefreshing(false);
  }, [
    setCoeffData,
    setCurrentHeight,
    setCurrentLimitUpCount,
    setCurrentRiseCount,
    setCurrentScore,
    setIsRefreshing,
    setLoading,
    setRealTimeBreadth,
    setSentimentLoadingMode,
    setSentimentSource,
    setSentimentUpdatedAt,
  ]);

  const loadPremiumData = useCallback(async (force = false) => {
    setPremiumLoading(true);
    const mode = force ? 'api' : ((await checkLocalPublicFileExists('performance.json')) ? 'local' : 'api');
    setPremiumLoadingMode(mode);
    try {
      const data = await getLimitUpPremiumHistory(force);
      setPremiumData(data);
      if (data.length > 0) {
        const displayIndex = data.length > 1 ? data.length - 2 : data.length - 1;
        const displayEntry = data[displayIndex];
        setCurrentPremium(displayEntry?.premium ?? null);
        setCurrentSuccessRate(displayEntry?.successRate ?? null);
        setCurrentFollowThrough(displayEntry?.followThroughCount ?? null);
        setCurrentPremiumDate(displayEntry?.date ?? null);
      }
      setPerformanceSource(getPerformanceDataSource());
      setPerformanceUpdatedAt(getPerformanceUpdatedAt());
    } catch (error) {
      console.error('Failed to load premium data', error);
    }
    setPremiumLoading(false);
    setPremiumLoadingMode('unknown');
  }, [
    setCurrentFollowThrough,
    setCurrentPremium,
    setCurrentPremiumDate,
    setCurrentSuccessRate,
    setPerformanceSource,
    setPerformanceUpdatedAt,
    setPremiumData,
    setPremiumLoading,
    setPremiumLoadingMode,
  ]);

  const loadBrokenData = useCallback(async (force = false) => {
    setBrokenLoading(true);
    const mode = force ? 'api' : ((await checkLocalPublicFileExists('performance.json')) ? 'local' : 'api');
    setBrokenLoadingMode(mode);
    try {
      const data = await getBrokenRateHistory(force);
      setBrokenData(data);
      if (data.length > 0) {
        const last = data[data.length - 1];
        setCurrentBrokenRate(last.brokenRate);
        setCurrentBrokenCount(last.brokenCount);
        setCurrentBrokenLimitUp(last.limitUpCount);
      }
      setPerformanceSource(getPerformanceDataSource());
      setPerformanceUpdatedAt(getPerformanceUpdatedAt());
    } catch (error) {
      console.error('Failed to load broken data', error);
    }
    setBrokenLoading(false);
    setBrokenLoadingMode('unknown');
  }, [
    setBrokenData,
    setBrokenLoading,
    setBrokenLoadingMode,
    setCurrentBrokenCount,
    setCurrentBrokenLimitUp,
    setCurrentBrokenRate,
    setPerformanceSource,
    setPerformanceUpdatedAt,
  ]);

  const loadStructureData = useCallback(async (force = false) => {
    setStructureLoading(true);
    const mode = force ? 'api' : ((await checkLocalPublicFileExists('structure.json')) ? 'local' : 'api');
    setStructureLoadingMode(mode);
    try {
      const data = await getLimitUpStructureHistory(force);
      setStructureData(data);
      if (data.length > 0) {
        const last = data[data.length - 1];
        setCurrentStructureDate(last.date);
        setCurrentFirstBoardCount(last.firstBoardCount);
        setCurrentRelayCount(last.relayCount);
        setCurrentHighBoardCount(last.highBoardCount);
        setCurrentFirstBoardRatio(last.firstBoardRatio);
      }
      setStructureSource(getStructureDataSource());
      setStructureUpdatedAt(getStructureUpdatedAt());
    } catch (error) {
      console.error('Failed to load structure data', error);
    }
    setStructureLoading(false);
    setStructureLoadingMode('unknown');
  }, [
    setCurrentFirstBoardCount,
    setCurrentFirstBoardRatio,
    setCurrentHighBoardCount,
    setCurrentRelayCount,
    setCurrentStructureDate,
    setStructureData,
    setStructureLoading,
    setStructureLoadingMode,
    setStructureSource,
    setStructureUpdatedAt,
  ]);

  const loadRepairData = useCallback(async (force = false) => {
    setRepairLoading(true);
    setRepairLoadingMode('api');
    try {
      const data = await getRepairRateHistory(force);
      setRepairData(data);
      if (data.length > 0) {
        const last = data[data.length - 1];
        setCurrentRepairDate(last.date);
        setCurrentBrokenRepairRate(last.brokenRepairRate);
        setCurrentBigFaceRepairRate(last.bigFaceRepairRate);
        setCurrentRepairBrokenCount(last.brokenCount);
        setCurrentBigFaceCount(last.bigFaceCount);
      }
      setRepairSource(getRepairDataSource());
      setRepairUpdatedAt(getRepairUpdatedAt());
    } catch (error) {
      console.error('Failed to load repair data', error);
    }
    setRepairLoading(false);
    setRepairLoadingMode('unknown');
  }, [
    setCurrentBigFaceCount,
    setCurrentBigFaceRepairRate,
    setCurrentBrokenRepairRate,
    setCurrentRepairBrokenCount,
    setCurrentRepairDate,
    setRepairData,
    setRepairLoading,
    setRepairLoadingMode,
    setRepairSource,
    setRepairUpdatedAt,
  ]);

  const loadLeaderData = useCallback(async (force = false) => {
    setLeaderLoading(true);
    setLeaderLoadingMode('api');
    try {
      const data = await getLeaderStateHistory(force);
      setLeaderData(data);
      if (data.length > 0) {
        const last = data[data.length - 1];
        setCurrentLeader({ name: last.leaderName, symbol: last.leaderSymbol, label: last.statusLabel });
        setCurrentLeaderBoard(last.leaderBoardCount);
        setCurrentLeaderNextClose(last.nextClosePct);
        setCurrentThreePlusCount(last.threePlusCount);
      }
      setLeaderSource(getLeaderDataSource());
      setLeaderUpdatedAt(getLeaderUpdatedAt());
    } catch (error) {
      console.error('Failed to load leader data', error);
    }
    setLeaderLoading(false);
    setLeaderLoadingMode('unknown');
  }, [
    setCurrentLeader,
    setCurrentLeaderBoard,
    setCurrentLeaderNextClose,
    setCurrentThreePlusCount,
    setLeaderData,
    setLeaderLoading,
    setLeaderLoadingMode,
    setLeaderSource,
    setLeaderUpdatedAt,
  ]);

  const loadBoardHeightData = useCallback(async (force = false) => {
    setBoardHeightLoading(true);
    try {
      const data = await getBoardHeightHistory(force);
      setBoardHeightData(data);
      setBoardHeightSource(getBoardHeightDataSource());
      setBoardHeightUpdatedAt(getBoardHeightUpdatedAt());
    } catch (error) {
      console.error('Failed to load board height data', error);
    }
    setBoardHeightLoading(false);
  }, [setBoardHeightData, setBoardHeightLoading, setBoardHeightSource, setBoardHeightUpdatedAt]);

  const loadEmotionIndicatorData = useCallback(async () => {
    setEmotionIndicatorLoading(true);
    try {
      const [indicatorHistory, indexFuturesHistory, bullBearSnapshots] = await Promise.all([
        getEmotionIndicatorHistory(),
        getIndexFuturesLongShortHistory(),
        getBullBearSignalHistory(),
      ]);
      setEmotionIndicatorData(indicatorHistory);
      setIndexFuturesLongShortData(indexFuturesHistory);
      setBullBearHistory(bullBearSnapshots);
      setEmotionIndicatorSource(getEmotionIndicatorDataSource());
      setEmotionIndicatorUpdatedAt(getEmotionIndicatorUpdatedAt());
      setSelectedBullBearDate((current) => {
        if (!bullBearSnapshots.length) return null;
        if (current && bullBearSnapshots.some((item) => item.date === current)) return current;
        return bullBearSnapshots[bullBearSnapshots.length - 1].date;
      });
      setBullBearSignal(bullBearSnapshots[bullBearSnapshots.length - 1] ?? null);
    } catch (error) {
      console.error('Failed to load emotion indicator data', error);
      setBullBearHistory([]);
      setBullBearSignal(null);
      setSelectedBullBearDate(null);
    }
    setEmotionIndicatorLoading(false);
  }, [
    setBullBearHistory,
    setBullBearSignal,
    setEmotionIndicatorData,
    setEmotionIndicatorLoading,
    setEmotionIndicatorSource,
    setEmotionIndicatorUpdatedAt,
    setIndexFuturesLongShortData,
    setSelectedBullBearDate,
  ]);

  const loadPressureOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [overview, volumeTrend, highRisk, repairHistory, leaderHistory] = await Promise.all([
        getCycleOverview(),
        getMarketVolumeTrendHistory(),
        getHighRiskHistory(),
        getRepairRateHistory(),
        getLeaderStateHistory(),
      ]);
      setCycleOverview(overview);
      setVolumeTrendData(volumeTrend);
      setHighRiskData(highRisk);
      if (repairHistory.length > 0) {
        const lastRepair = repairHistory[repairHistory.length - 1];
        setCurrentRepairDate(lastRepair.date);
        setCurrentBrokenRepairRate(lastRepair.brokenRepairRate);
        setCurrentBigFaceRepairRate(lastRepair.bigFaceRepairRate);
        setCurrentRepairBrokenCount(lastRepair.brokenCount);
        setCurrentBigFaceCount(lastRepair.bigFaceCount);
      }
      if (leaderHistory.length > 0) {
        const lastLeader = leaderHistory[leaderHistory.length - 1];
        setCurrentLeader({ name: lastLeader.leaderName, symbol: lastLeader.leaderSymbol, label: lastLeader.statusLabel });
        setCurrentLeaderBoard(lastLeader.leaderBoardCount);
        setCurrentLeaderNextClose(lastLeader.nextClosePct);
        setCurrentThreePlusCount(lastLeader.threePlusCount);
      }
    } catch (error) {
      console.error('Failed to load pressure overview', error);
    }
    setOverviewLoading(false);
  }, [
    setCurrentBigFaceCount,
    setCurrentBigFaceRepairRate,
    setCurrentLeader,
    setCurrentLeaderBoard,
    setCurrentLeaderNextClose,
    setCurrentRepairBrokenCount,
    setCurrentRepairDate,
    setCurrentThreePlusCount,
    setCurrentBrokenRepairRate,
    setCycleOverview,
    setHighRiskData,
    setOverviewLoading,
    setVolumeTrendData,
  ]);

  const handleRefresh = useCallback(async () => {
    if (activeMetric === 'pressure') {
      await resetSentimentData();
      await Promise.all([loadData(true), loadPressureOverview()]);
    } else if (activeMetric === 'premium') {
      await loadPremiumData(true);
    } else if (activeMetric === 'broken') {
      await loadBrokenData(true);
    } else if (activeMetric === 'structure') {
      await loadStructureData(true);
    } else if (activeMetric === 'repair') {
      await loadRepairData(true);
    } else if (activeMetric === 'leader') {
      await loadLeaderData(true);
    } else if (activeMetric === 'height') {
      await loadBoardHeightData(true);
    } else if (activeMetric === 'emotion') {
      await loadEmotionIndicatorData();
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

  return {
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
  };
}
