
import React, { useState, useEffect, useMemo, useRef } from 'react';
import GlassCard from './ui/GlassCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Area, LabelList, Cell } from 'recharts';
import { TrendingDown, Zap, Activity, AlertTriangle, BarChart2, Loader2, Info, TrendingUp, RefreshCw, Globe2, ChevronRight } from 'lucide-react';
import { getSentimentCoefficientHistory, getRealTimeMarketSentiment, getLimitUpPremiumHistory, getBrokenRateHistory, getLimitUpStructureHistory, getRepairRateHistory, getLeaderStateHistory, getBoardHeightHistory, getMarketVolumeTrendHistory, getHighRiskHistory, getCycleOverview, resetSentimentData, getSentimentDataSource, getPerformanceDataSource, getStructureDataSource, getRepairDataSource, getLeaderDataSource, getBoardHeightDataSource } from '../services/sentimentCycleService';
import { getEmotionIndicatorHistory, getEmotionIndicatorDataSource, getIndexFuturesLongShortHistory, getBullBearSignalHistory } from '../services/emotionIndicatorService';
import { BoardHeightEntry, BullBearSignalSnapshot, EmotionIndicatorEntry, IndexFuturesLongShortSeries } from '../types';
import { checkLocalPublicFileExists } from '../services/localDataService';

const SentimentSection: React.FC = () => {
  const [activeMetric, setActiveMetric] = useState<'currentCycle' | 'pressure' | 'premium' | 'broken' | 'structure' | 'repair' | 'leader' | 'height' | 'emotion'>('pressure');
  
  // New State for Real Coefficient Data
  const [coeffData, setCoeffData] = useState<{date: string, value: number, height: number, limitUpCount: number, limitDownCount: number, riseCount?: number}[]>([]);
  const [realTimeBreadth, setRealTimeBreadth] = useState<{rise: number, fall: number, flat: number} | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentHeight, setCurrentHeight] = useState<number | null>(null);
  const [currentLimitUpCount, setCurrentLimitUpCount] = useState<number | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string[]>(['value', 'height', 'limitUpCount', 'riseCount']);
  const [currentRiseCount, setCurrentRiseCount] = useState<number | null>(null);
  const [premiumData, setPremiumData] = useState<{date: string, premium: number, successRate: number, limitUpCount: number, followThroughCount: number}[]>([]);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [currentPremium, setCurrentPremium] = useState<number | null>(null);
  const [currentSuccessRate, setCurrentSuccessRate] = useState<number | null>(null);
  const [currentFollowThrough, setCurrentFollowThrough] = useState<number | null>(null);
  const [currentPremiumDate, setCurrentPremiumDate] = useState<string | null>(null);
  const [brokenData, setBrokenData] = useState<{date: string, brokenRate: number, brokenCount: number, limitUpCount: number}[]>([]);
  const [brokenLoading, setBrokenLoading] = useState(false);
  const [currentBrokenRate, setCurrentBrokenRate] = useState<number | null>(null);
  const [currentBrokenCount, setCurrentBrokenCount] = useState<number | null>(null);
  const [currentBrokenLimitUp, setCurrentBrokenLimitUp] = useState<number | null>(null);
  const [structureData, setStructureData] = useState<{date: string, firstBoardCount: number, secondBoardCount: number, thirdBoardCount: number, highBoardCount: number, totalLimitUpCount: number, firstBoardRatio: number, relayCount: number, highBoardRatio: number}[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [currentStructureDate, setCurrentStructureDate] = useState<string | null>(null);
  const [currentFirstBoardCount, setCurrentFirstBoardCount] = useState<number | null>(null);
  const [currentRelayCount, setCurrentRelayCount] = useState<number | null>(null);
  const [currentHighBoardCount, setCurrentHighBoardCount] = useState<number | null>(null);
  const [currentFirstBoardRatio, setCurrentFirstBoardRatio] = useState<number | null>(null);
  const [repairData, setRepairData] = useState<{date: string, brokenCount: number, brokenRepairCount: number, brokenRepairRate: number, bigFaceCount: number, bigFaceRepairCount: number, bigFaceRepairRate: number}[]>([]);
  const [repairLoading, setRepairLoading] = useState(false);
  const [currentRepairDate, setCurrentRepairDate] = useState<string | null>(null);
  const [currentBrokenRepairRate, setCurrentBrokenRepairRate] = useState<number | null>(null);
  const [currentBigFaceRepairRate, setCurrentBigFaceRepairRate] = useState<number | null>(null);
  const [currentRepairBrokenCount, setCurrentRepairBrokenCount] = useState<number | null>(null);
  const [currentBigFaceCount, setCurrentBigFaceCount] = useState<number | null>(null);
  const [leaderData, setLeaderData] = useState<{date: string, leaderSymbol: string, leaderName: string, leaderBoardCount: number, leaderCount: number, secondHighestBoard: number, threePlusCount: number, continuedCount: number, nextOpenPct: number | null, nextClosePct: number | null, isOneWord: boolean, statusLabel: string}[]>([]);
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [currentLeader, setCurrentLeader] = useState<{ name: string; symbol: string; label: string } | null>(null);
  const [currentLeaderBoard, setCurrentLeaderBoard] = useState<number | null>(null);
  const [currentLeaderNextClose, setCurrentLeaderNextClose] = useState<number | null>(null);
  const [currentThreePlusCount, setCurrentThreePlusCount] = useState<number | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [cycleOverview, setCycleOverview] = useState<{ stage: '冰点' | '试错' | '主升' | '分歧' | '修复' | '退潮'; confidence: number; riskLevel: '低风险' | '中风险' | '高风险'; volumeState: '持续放量' | '存量震荡' | '缩量再缩量' | '放量滞涨'; latestVolumeAmount: number | null; volumeChangeRate: number | null; reasons: string[] } | null>(null);
  const [volumeTrendData, setVolumeTrendData] = useState<{ date: string; amount: number; changeRate: number | null }[]>([]);
  const [highRiskData, setHighRiskData] = useState<{ date: string; highBoardCount: number; aKillCount: number; weakCount: number; brokenCount: number; brokenRate: number; riskLevel: 'low' | 'medium' | 'high' }[]>([]);
  const [sentimentSource, setSentimentSource] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [performanceSource, setPerformanceSource] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [structureSource, setStructureSource] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [repairSource, setRepairSource] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [leaderSource, setLeaderSource] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [sentimentLoadingMode, setSentimentLoadingMode] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [premiumLoadingMode, setPremiumLoadingMode] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [brokenLoadingMode, setBrokenLoadingMode] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [structureLoadingMode, setStructureLoadingMode] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [repairLoadingMode, setRepairLoadingMode] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [leaderLoadingMode, setLeaderLoadingMode] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [boardHeightData, setBoardHeightData] = useState<BoardHeightEntry[]>([]);
  const [boardHeightLoading, setBoardHeightLoading] = useState(false);
  const [boardHeightSource, setBoardHeightSource] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [emotionIndicatorData, setEmotionIndicatorData] = useState<EmotionIndicatorEntry[]>([]);
  const [emotionIndicatorLoading, setEmotionIndicatorLoading] = useState(false);
  const [emotionIndicatorSource, setEmotionIndicatorSource] = useState<'local' | 'api' | 'unknown'>('unknown');
  const [bullBearSignal, setBullBearSignal] = useState<BullBearSignalSnapshot | null>(null);
  const [bullBearHistory, setBullBearHistory] = useState<BullBearSignalSnapshot[]>([]);
  const [selectedBullBearDate, setSelectedBullBearDate] = useState<string | null>(null);
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string>('');
  const [indexFuturesLongShortData, setIndexFuturesLongShortData] = useState<IndexFuturesLongShortSeries[]>([]);
  const [selectedIndexFuturesCode, setSelectedIndexFuturesCode] = useState<'IF' | 'IC' | 'IH' | 'IM'>('IF');
  const [selectedEmotionSeries, setSelectedEmotionSeries] = useState<string[]>(['ftseA50', 'nasdaq', 'offshoreRmb', 'indexFuturesLongShortRatio']);
  const [selectedBoardStock, setSelectedBoardStock] = useState<string | null>(null);
  const [isBoardHeightDragging, setIsBoardHeightDragging] = useState(false);
  const boardHeightScrollRef = useRef<HTMLDivElement | null>(null);
  const boardHeightDragRef = useRef<{ active: boolean; startX: number; startScrollLeft: number }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const loadData = async (force = false) => {
     setLoading(true);
     if (force) setIsRefreshing(true);
     const mode = force ? 'api' : (await checkLocalPublicFileExists('sentiment.json') ? 'local' : 'api');
     setSentimentLoadingMode(mode);
     try {
         // Fetch History
         const data = await getSentimentCoefficientHistory(force);
         // Fetch Real-time Breadth
         const breadth = await getRealTimeMarketSentiment();
         setRealTimeBreadth(breadth);

         const mergedData = breadth && data.length > 0
            ? data.map((item, idx) => idx === data.length - 1 ? { ...item, riseCount: breadth.rise } : item)
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

     } catch (e) {
         console.error("Failed to load sentiment data", e);
     }
     setLoading(false);
     setSentimentLoadingMode('unknown');
     if (force) setIsRefreshing(false);
  };
  const loadPremiumData = async (force = false) => {
     setPremiumLoading(true);
     const mode = force ? 'api' : (await checkLocalPublicFileExists('performance.json') ? 'local' : 'api');
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
       } else {
           setCurrentPremiumDate(null);
       }
        setPerformanceSource(getPerformanceDataSource());
     } catch (e) {
        console.error("Failed to load premium data", e);
     }
     setPremiumLoading(false);
     setPremiumLoadingMode('unknown');
  };
  const loadBrokenData = async (force = false) => {
     setBrokenLoading(true);
     const mode = force ? 'api' : (await checkLocalPublicFileExists('performance.json') ? 'local' : 'api');
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
     } catch (e) {
        console.error("Failed to load broken data", e);
     }
     setBrokenLoading(false);
     setBrokenLoadingMode('unknown');
  };
  const loadStructureData = async (force = false) => {
     setStructureLoading(true);
     const mode = force ? 'api' : (await checkLocalPublicFileExists('sentiment.json') ? 'local' : 'api');
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
        } else {
            setCurrentStructureDate(null);
            setCurrentFirstBoardCount(null);
            setCurrentRelayCount(null);
            setCurrentHighBoardCount(null);
            setCurrentFirstBoardRatio(null);
        }
        setStructureSource(getStructureDataSource());
     } catch (e) {
        console.error("Failed to load structure data", e);
     }
     setStructureLoading(false);
     setStructureLoadingMode('unknown');
  };
  const loadRepairData = async (force = false) => {
     setRepairLoading(true);
     const mode: 'api' | 'local' = 'api';
     setRepairLoadingMode(mode);
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
        } else {
            setCurrentRepairDate(null);
            setCurrentBrokenRepairRate(null);
            setCurrentBigFaceRepairRate(null);
            setCurrentRepairBrokenCount(null);
            setCurrentBigFaceCount(null);
        }
        setRepairSource(getRepairDataSource());
     } catch (e) {
        console.error("Failed to load repair data", e);
     }
     setRepairLoading(false);
     setRepairLoadingMode('unknown');
  };
  const loadLeaderData = async (force = false) => {
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
        } else {
            setCurrentLeader(null);
            setCurrentLeaderBoard(null);
            setCurrentLeaderNextClose(null);
            setCurrentThreePlusCount(null);
        }
        setLeaderSource(getLeaderDataSource());
     } catch (e) {
        console.error("Failed to load leader data", e);
     }
     setLeaderLoading(false);
     setLeaderLoadingMode('unknown');
  };
  const loadBoardHeightData = async (force = false) => {
     setBoardHeightLoading(true);
     try {
        const data = await getBoardHeightHistory(force);
        setBoardHeightData(data);
        setBoardHeightSource(getBoardHeightDataSource());
     } catch (e) {
        console.error("Failed to load board height data", e);
        setBoardHeightData([]);
        setBoardHeightSource('unknown');
     }
     setBoardHeightLoading(false);
  };
  const loadEmotionIndicatorData = async () => {
     setEmotionIndicatorLoading(true);
     try {
        const [data, futuresData, bullBearHistoryData] = await Promise.all([
          getEmotionIndicatorHistory(),
          getIndexFuturesLongShortHistory(),
          getBullBearSignalHistory(),
        ]);
        const latestBullBearData = bullBearHistoryData.at(-1) ?? null;
        setEmotionIndicatorData(data);
        setIndexFuturesLongShortData(futuresData);
        setBullBearHistory(bullBearHistoryData);
        setBullBearSignal(latestBullBearData);
        setSelectedBullBearDate((current) => {
          if (current && bullBearHistoryData.some((item) => item.date === current)) {
            return current;
          }
          return latestBullBearData?.date ?? null;
        });
        setEmotionIndicatorSource(getEmotionIndicatorDataSource());
     } catch (e) {
        console.error('Failed to load emotion indicator data', e);
        setEmotionIndicatorData([]);
        setIndexFuturesLongShortData([]);
        setBullBearHistory([]);
        setBullBearSignal(null);
        setSelectedBullBearDate(null);
        setEmotionIndicatorSource('unknown');
     }
     setEmotionIndicatorLoading(false);
  };
  const loadPressureOverview = async () => {
     setOverviewLoading(true);
     try {
        const [overview, volumeTrend, highRisk, repairHistory, leaderHistory] = await Promise.all([
          getCycleOverview(),
          getMarketVolumeTrendHistory(),
          getHighRiskHistory(),
          getRepairRateHistory(),
          getLeaderStateHistory()
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
     } catch (e) {
        console.error("Failed to load pressure overview", e);
     }
     setOverviewLoading(false);
  };

  useEffect(() => {
     if (activeMetric === 'pressure') {
         loadData();
         loadPressureOverview();
     } else if (activeMetric === 'premium') {
         loadPremiumData();
     } else if (activeMetric === 'broken') {
         loadBrokenData();
     } else if (activeMetric === 'structure') {
         loadStructureData();
     } else if (activeMetric === 'repair') {
         loadRepairData();
     } else if (activeMetric === 'leader') {
         loadLeaderData();
     } else if (activeMetric === 'height') {
         loadBoardHeightData();
     } else if (activeMetric === 'emotion') {
         loadEmotionIndicatorData();
     }
  }, [activeMetric]);

  const handleRefresh = async () => {
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
  };

  const metrics = [
      { id: 'currentCycle', label: '当前周期', icon: <Activity size={16} />, color: 'text-cyan-500' },
      { id: 'emotion', label: '情绪指标', icon: <Globe2 size={16} />, color: 'text-cyan-500' },
      { id: 'pressure', label: '砸盘系数', icon: <TrendingDown size={16} />, color: 'text-green-500' },
      { id: 'premium', label: '涨停溢价', icon: <Zap size={16} />, color: 'text-red-500' },
      { id: 'broken', label: '炸板率', icon: <AlertTriangle size={16} />, color: 'text-yellow-500' },
      { id: 'structure', label: '涨停结构', icon: <Activity size={16} />, color: 'text-sky-500' },
      { id: 'repair', label: '修复率', icon: <TrendingUp size={16} />, color: 'text-emerald-500' },
      { id: 'leader', label: '龙头状态', icon: <BarChart2 size={16} />, color: 'text-violet-500' },
      { id: 'height', label: '高度趋势', icon: <BarChart2 size={16} />, color: 'text-rose-500' },
  ];

  useEffect(() => {
    if (activeMetric === 'pressure' && selectedSeries.length === 0) {
      setSelectedSeries(['value', 'height', 'limitUpCount', 'riseCount']);
    } else if (activeMetric !== 'pressure') {
      setSelectedSeries([]);
    }
  }, [activeMetric, selectedSeries.length]);

  useEffect(() => {
    if (activeMetric !== 'emotion') {
      setSelectedEmotionSeries(['ftseA50', 'nasdaq', 'offshoreRmb', 'indexFuturesLongShortRatio']);
    }
  }, [activeMetric]);

  const sourceLabelMap = {
      local: '本地缓存',
      api: '实时接口',
      unknown: '未知'
  } as const;
  const sourceClassMap = {
      local: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      api: 'bg-sky-100 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
      unknown: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
  } as const;
  const renderSourceBadge = (source: 'local' | 'api' | 'unknown') => (
      <span className={`text-[10px] px-2 py-1 rounded-full font-mono tracking-wide ${sourceClassMap[source]}`}>
          数据来源: {sourceLabelMap[source]}
      </span>
  );

  const historicalDateOptions = useMemo(() => {
    if (activeMetric === 'pressure') return coeffData.map((item) => item.date);
    if (activeMetric === 'premium') return premiumData.map((item) => item.date);
    if (activeMetric === 'broken') return brokenData.map((item) => item.date);
    if (activeMetric === 'structure') return structureData.map((item) => item.date);
    if (activeMetric === 'repair') return repairData.map((item) => item.date);
    if (activeMetric === 'leader') return leaderData.map((item) => item.date);
    if (activeMetric === 'height') return boardHeightData.map((item) => item.fullDate ?? item.date);
    return [];
  }, [activeMetric, boardHeightData, brokenData, coeffData, leaderData, premiumData, repairData, structureData]);

  useEffect(() => {
    if (historicalDateOptions.length === 0) {
      setSelectedHistoricalDate('');
      return;
    }
    if (!selectedHistoricalDate || !historicalDateOptions.includes(selectedHistoricalDate)) {
      setSelectedHistoricalDate(historicalDateOptions[historicalDateOptions.length - 1]);
    }
  }, [historicalDateOptions, selectedHistoricalDate]);

  const emotionSeriesOptions: Array<{ id: keyof EmotionIndicatorEntry; label: string; unit: string; color: string }> = [
    { id: 'ftseA50', label: '富时A50', unit: '', color: '#22c55e' },
    { id: 'nasdaq', label: '纳斯达克', unit: '', color: '#38bdf8' },
    { id: 'dowJones', label: '道琼斯', unit: '', color: '#f59e0b' },
    { id: 'sp500', label: '标普500', unit: '', color: '#f43f5e' },
    { id: 'offshoreRmb', label: '离岸人民币', unit: '', color: '#a855f7' },
    { id: 'ashareAvgValuation', label: 'A股平均估值', unit: 'PE', color: '#14b8a6' },
    { id: 'indexFuturesLongShortRatio', label: '期指多空比', unit: 'x', color: '#f97316' },
  ];

  const toggleEmotionSeries = (seriesId: string) => {
    setSelectedEmotionSeries((prev) =>
      prev.includes(seriesId)
        ? prev.filter((item) => item !== seriesId)
        : [...prev, seriesId],
    );
  };

  const getPreviousEmotionValueAt = (index: number, id: keyof EmotionIndicatorEntry) => {
    for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
      const candidate = emotionIndicatorData[pointer]?.[id];
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate !== 0) {
        return candidate;
      }
    }
    return null;
  };

  const emotionComparisonData = emotionIndicatorData.map((item, index) => {
    const compareDailyChange = (key: keyof EmotionIndicatorEntry) => {
      const current = item[key];
      const previous = getPreviousEmotionValueAt(index, key);
      if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) {
        return null;
      }
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    return {
      ...item,
      ftseA50DailyChangePct: compareDailyChange('ftseA50'),
      nasdaqDailyChangePct: compareDailyChange('nasdaq'),
      dowJonesDailyChangePct: compareDailyChange('dowJones'),
      sp500DailyChangePct: compareDailyChange('sp500'),
      offshoreRmbDailyChangePct: compareDailyChange('offshoreRmb'),
      ashareAvgValuationDailyChangePct: compareDailyChange('ashareAvgValuation'),
      indexFuturesLongShortRatioDailyChangePct: compareDailyChange('indexFuturesLongShortRatio'),
    };
  });

  const latestEmotionIndicator = emotionIndicatorData[emotionIndicatorData.length - 1] ?? null;
  const getPreviousEmotionValue = (id: keyof EmotionIndicatorEntry) => {
    if (emotionIndicatorData.length < 2) return null;
    for (let index = emotionIndicatorData.length - 2; index >= 0; index -= 1) {
      const candidate = emotionIndicatorData[index]?.[id];
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate !== 0) {
        return candidate;
      }
    }
    return null;
  };
  const selectedIndexFuturesSeries = indexFuturesLongShortData.find((item) => item.code === selectedIndexFuturesCode) ?? null;
  const latestIndexFuturesPoint = selectedIndexFuturesSeries?.history[selectedIndexFuturesSeries.history.length - 1] ?? null;
  const previousIndexFuturesPoint = selectedIndexFuturesSeries?.history[selectedIndexFuturesSeries.history.length - 2] ?? null;
  const sortedBoardHeightData = useMemo(
    () =>
      [...boardHeightData].sort((a, b) => (a.fullDate ?? a.date).localeCompare(b.fullDate ?? b.date)),
    [boardHeightData]
  );
  const latestBoardHeight = sortedBoardHeightData[sortedBoardHeightData.length - 1] ?? null;
  const selectedCoeffEntry = coeffData.find((item) => item.date === selectedHistoricalDate) ?? coeffData[coeffData.length - 1] ?? null;
  const selectedPremiumEntry = premiumData.find((item) => item.date === selectedHistoricalDate) ?? premiumData[premiumData.length - 1] ?? null;
  const selectedBrokenEntry = brokenData.find((item) => item.date === selectedHistoricalDate) ?? brokenData[brokenData.length - 1] ?? null;
  const selectedStructureEntry = structureData.find((item) => item.date === selectedHistoricalDate) ?? structureData[structureData.length - 1] ?? null;
  const selectedRepairEntry = repairData.find((item) => item.date === selectedHistoricalDate) ?? repairData[repairData.length - 1] ?? null;
  const selectedLeaderEntry = leaderData.find((item) => item.date === selectedHistoricalDate) ?? leaderData[leaderData.length - 1] ?? null;
  const selectedBoardHeightEntry = sortedBoardHeightData.find((item) => (item.fullDate ?? item.date) === selectedHistoricalDate) ?? latestBoardHeight;
  const boardHeightChartWidth = useMemo(
    () => Math.max(1500, sortedBoardHeightData.length * 220),
    [sortedBoardHeightData.length]
  );
  const boardHeightDateIndexMap = useMemo(() => {
    return new Map(
      sortedBoardHeightData.map((item, index) => [item.fullDate ?? item.date, index] as const)
    );
  }, [sortedBoardHeightData]);
  const boardHeightAxisTicks = useMemo(() => {
    const maxValue = sortedBoardHeightData.reduce((max, item) => {
      return Math.max(max, item.mainBoardHighest, item.mainBoardSecondHighest, item.chinextHighest);
    }, 0);
    const axisMax = Math.max(1, maxValue);
    const step = axisMax <= 6 ? 1 : axisMax <= 12 ? 2 : 3;
    const roundedMax = Math.ceil(axisMax / step) * step;
    const ticks: number[] = [];
    for (let value = 0; value <= roundedMax; value += step) {
      ticks.push(value);
    }
    return {
      ticks,
      max: roundedMax,
    };
  }, [sortedBoardHeightData]);
  const volumeTrendAxisDomain = useMemo<[number, number]>(() => {
    if (volumeTrendData.length === 0) return [0, 1];
    const amounts = volumeTrendData
      .map((item) => item.amount)
      .filter((value): value is number => Number.isFinite(value));
    if (amounts.length === 0) return [0, 1];
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (min === max) {
      const padding = Math.max(min * 0.05, 500);
      return [Math.max(0, min - padding), max + padding];
    }
    const padding = Math.max((max - min) * 0.18, max * 0.03);
    return [Math.max(0, min - padding), max + padding];
  }, [volumeTrendData]);

  const formatVolumeAxisTick = (value: number) => {
    if (!Number.isFinite(value)) return '';
    if (Math.abs(value) >= 10000) {
      return `${(value / 10000).toFixed(2)}万亿`;
    }
    return `${Math.round(value)}亿`;
  };
  const handleBoardHeightMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !boardHeightScrollRef.current) return;
    boardHeightDragRef.current = {
      active: true,
      startX: event.clientX,
      startScrollLeft: boardHeightScrollRef.current.scrollLeft,
    };
    setIsBoardHeightDragging(true);
  };
  const handleBoardHeightMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!boardHeightDragRef.current.active || !boardHeightScrollRef.current) return;
    const deltaX = event.clientX - boardHeightDragRef.current.startX;
    boardHeightScrollRef.current.scrollLeft = boardHeightDragRef.current.startScrollLeft - deltaX;
  };
  const stopBoardHeightDrag = () => {
    boardHeightDragRef.current.active = false;
    setIsBoardHeightDragging(false);
  };

  const formatBoardNames = (names: string[], symbols: string[]) => {
    if (!names.length) return '—';
    return names.map((name, index) => `${name}${symbols[index] ? `(${symbols[index]})` : ''}`).join('、');
  };
  const renderBoardHeightDot = (
    field: 'mainBoardHighestNames' | 'mainBoardSecondHighestNames' | 'chinextHighestNames',
    color: string,
    dy: number,
    lane: 'left' | 'center' | 'right',
  ) => (props: any) => {
    const { cx, cy, payload, value } = props;
    if (typeof cx !== 'number' || typeof cy !== 'number' || typeof value !== 'number' || value <= 0 || !payload) {
      return null;
    }
    const row = payload as BoardHeightEntry;
    const names = (row[field] ?? []).filter(Boolean);
    if (!names.length) {
      return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.4} />;
    }
    const badgeHeight = 20;
    const badgeGap = 6;
    const stackHeight = names.length * badgeHeight + Math.max(0, names.length - 1) * badgeGap;
    const startY = dy < 0 ? cy + dy - stackHeight + badgeHeight : cy + dy;
    const getBadgeWidth = (name: string) => Math.max(56, name.length * 12 + 22);
    const dateIndex = boardHeightDateIndexMap.get(row.fullDate ?? row.date) ?? 0;
    const laneOffset =
      lane === 'left' ? -84 : lane === 'right' ? 84 : dateIndex % 2 === 0 ? -12 : 12;
    const dayWaveOffset = (dateIndex % 3) * 8 - 8;
    return (
      <g>
        <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#fff" strokeWidth={1.5} />
        {names.map((name, index) => {
          const width = getBadgeWidth(name);
          const y = startY + index * (badgeHeight + badgeGap);
          const isSelected = selectedBoardStock === name;
          const x =
            lane === 'left'
              ? cx - width - 10 + dayWaveOffset
              : lane === 'right'
                ? cx + 10 + dayWaveOffset
                : cx - width / 2 + laneOffset + dayWaveOffset;
          return (
            <g
              key={`${field}-dot-${name}-${index}`}
              transform={`translate(${x}, ${y - 15})`}
              onClick={() => setSelectedBoardStock((prev) => (prev === name ? null : name))}
              className="cursor-pointer"
            >
              <rect
                x={0}
                y={0}
                rx={8}
                ry={8}
                width={width}
                height={badgeHeight}
                fill={isSelected ? color : 'rgba(255,255,255,0.96)'}
                stroke={isSelected ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.28)'}
                strokeWidth={1}
              />
              {isSelected ? (
                <rect
                  x={-2}
                  y={-2}
                  rx={10}
                  ry={10}
                  width={width + 4}
                  height={badgeHeight + 4}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.28}
                  strokeWidth={3}
                />
              ) : (
                <rect
                  x={1}
                  y={1}
                  rx={7}
                  ry={7}
                  width={width - 2}
                  height={badgeHeight - 2}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.22}
                  strokeWidth={1}
                />
              )}
              <text
                x={width / 2}
                y={13}
                fill={isSelected ? '#ffffff' : color}
                fontSize={11}
                fontWeight={isSelected ? 700 : 600}
                textAnchor="middle"
                className="pointer-events-none select-none"
              >
                {name}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const formatEmotionValue = (id: keyof EmotionIndicatorEntry, value: number) => {
    if (id === 'offshoreRmb') return value.toFixed(3);
    if (id === 'ashareAvgValuation') return `${value.toFixed(1)}x`;
    if (id === 'indexFuturesLongShortRatio') return `${value.toFixed(2)}x`;
    return value.toFixed(0);
  };

  const getEmotionChange = (id: keyof EmotionIndicatorEntry) => {
    if (!latestEmotionIndicator) return null;
    const latest = latestEmotionIndicator[id];
    const previous = getPreviousEmotionValue(id);
    if (typeof latest !== 'number' || typeof previous !== 'number' || previous === 0) return null;
    return Number((((latest - previous) / previous) * 100).toFixed(2));
  };
  const selectedEmotionSeriesCards = emotionSeriesOptions
    .filter((series) => selectedEmotionSeries.includes(series.id))
    .map((series) => ({
      ...series,
      latestValue: latestEmotionIndicator?.[series.id],
      change: getEmotionChange(series.id),
    }));

  const formatPositionCount = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return `${value.toLocaleString('zh-CN')}手`;
  };

  const getPositionChangePct = (latest: number | null | undefined, previous: number | null | undefined) => {
    if (
      typeof latest !== 'number' ||
      typeof previous !== 'number' ||
      !Number.isFinite(latest) ||
      !Number.isFinite(previous) ||
      previous === 0
    ) {
      return null;
    }
    return Number((((latest - previous) / previous) * 100).toFixed(2));
  };

  const formatPositionAxisTick = (value: number) => {
    if (!Number.isFinite(value)) return '';
    if (value >= 10000) return `${Math.round(value / 10000)}万`;
    return `${Math.round(value)}`;
  };

  const longPositionChangePct = getPositionChangePct(latestIndexFuturesPoint?.longPosition, previousIndexFuturesPoint?.longPosition);
  const shortPositionChangePct = getPositionChangePct(latestIndexFuturesPoint?.shortPosition, previousIndexFuturesPoint?.shortPosition);
  const bullBearBarData = bullBearSignal?.rangeBuckets ?? [];
  const bullBearDateOptions = useMemo(
    () => [...bullBearHistory].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [bullBearHistory],
  );
  const formatAmountYi = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (value >= 10000) return `${(value / 10000).toFixed(2)}万亿元`;
    return `${value.toFixed(0)}亿元`;
  };
  const formatBullBearDate = (value: string | null | undefined) => {
    if (!value) return '—';
    return value.slice(5);
  };
  useEffect(() => {
    if (!selectedBullBearDate) {
      setBullBearSignal(bullBearHistory.at(-1) ?? null);
      return;
    }
    const selected = bullBearHistory.find((item) => item.date === selectedBullBearDate) ?? null;
    setBullBearSignal(selected ?? bullBearHistory.at(-1) ?? null);
  }, [bullBearHistory, selectedBullBearDate]);

  const lineSeriesOptions = [
    { id: 'value', label: '砸盘系数' },
    { id: 'height', label: '连板高度' },
    { id: 'limitUpCount', label: '涨停家数' },
    { id: 'limitDownCount', label: '跌停家数' },
    { id: 'riseCount', label: '上涨家数' },
  ];

  const toggleSeries = (seriesId: string) => {
    setSelectedSeries(prev =>
      prev.includes(seriesId)
        ? prev.filter(item => item !== seriesId)
        : [...prev, seriesId]
    );
  };

  const renderLineSelector = () => (
    <div className="px-4 pb-3 border-b border-slate-200 dark:border-white/5">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">折线指标 (可多选)</div>
      <div className="flex flex-wrap gap-4">
        {lineSeriesOptions.map(option => (
          <label key={option.id} className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              value={option.id}
              checked={selectedSeries.includes(option.id)}
              onChange={() => toggleSeries(option.id)}
              className="accent-cyan-500"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );

  const renderCurrentCyclePanel = () => {
    const latestRisk = highRiskData[highRiskData.length - 1] ?? null;
    const stageClassMap = {
      冰点: 'text-cyan-500',
      试错: 'text-amber-500',
      主升: 'text-rose-500',
      分歧: 'text-violet-500',
      修复: 'text-emerald-500',
      退潮: 'text-red-500'
    } as const;
    const riskClassMap = {
      低风险: 'text-emerald-500',
      中风险: 'text-amber-500',
      高风险: 'text-red-500'
    } as const;

    return (
      <div className="px-4 pt-4 pb-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">周期阶段</div>
            <div className={`mt-2 text-3xl font-bold ${cycleOverview ? stageClassMap[cycleOverview.stage] : 'text-slate-400'}`}>
              {cycleOverview?.stage ?? (overviewLoading ? '加载中' : '—')}
            </div>
            <div className="mt-1 text-xs text-slate-500">置信度 {cycleOverview?.confidence ?? 0}%</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">量能状态</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{cycleOverview?.volumeState ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-500">
              {cycleOverview?.latestVolumeAmount ? `${cycleOverview.latestVolumeAmount} 亿` : '—'}
              {cycleOverview?.volumeChangeRate !== null && cycleOverview?.volumeChangeRate !== undefined ? ` / ${cycleOverview.volumeChangeRate >= 0 ? '+' : ''}${cycleOverview.volumeChangeRate.toFixed(2)}%` : ''}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">龙头反馈</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{selectedLeaderEntry?.leaderName ?? currentLeader?.name ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-500">
              {selectedLeaderEntry?.nextClosePct !== null && selectedLeaderEntry?.nextClosePct !== undefined
                ? `${selectedLeaderEntry.nextClosePct >= 0 ? '+' : ''}${selectedLeaderEntry.nextClosePct.toFixed(2)}% / ${selectedLeaderEntry.statusLabel}`
                : currentLeaderNextClose !== null ? `${currentLeaderNextClose >= 0 ? '+' : ''}${currentLeaderNextClose.toFixed(2)}% / ${currentLeader?.label ?? ''}` : '待确认'}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">炸板修复率</div>
            <div className="mt-2 text-3xl font-mono font-bold text-emerald-500">{currentBrokenRepairRate?.toFixed(1) ?? '—'}%</div>
            <div className="mt-1 text-xs text-slate-500">大面修复 {currentBigFaceRepairRate?.toFixed(1) ?? '—'}%</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">高位风险</div>
            <div className={`mt-2 text-2xl font-bold ${cycleOverview ? riskClassMap[cycleOverview.riskLevel] : 'text-slate-400'}`}>{cycleOverview?.riskLevel ?? '—'}</div>
            <div className="mt-1 text-xs text-slate-500">A杀 {latestRisk?.aKillCount ?? 0} 家 / 炸板率 {latestRisk?.brokenRate?.toFixed(1) ?? '0.0'}%</div>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 min-h-[18rem] flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-white">量能趋势</div>
                <div className="text-xs text-slate-500">核心看趋势，不看固定金额</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">最新状态</div>
                <div className="text-sm font-semibold text-cyan-500">{cycleOverview?.volumeState ?? '—'}</div>
              </div>
            </div>
            {volumeTrendData.length > 0 ? (
              <div className="flex-1 min-h-[13rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeTrendData} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis
                      yAxisId="amount"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      width={56}
                      domain={volumeTrendAxisDomain}
                      tickFormatter={formatVolumeAxisTick}
                    />
                    <YAxis
                      yAxisId="changeRate"
                      orientation="right"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#f59e0b', fontSize: 10 }}
                      width={40}
                      domain={['auto', 'auto']}
                      tickFormatter={(value: number) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => name === 'amount' ? [`${value} 亿`, '成交额'] : [`${value}%`, '变化率']}
                    />
                    <Area yAxisId="amount" type="monotone" dataKey="amount" stroke="#38bdf8" fill="url(#volumeGradient)" strokeWidth={2} />
                    <Line yAxisId="changeRate" type="monotone" dataKey="changeRate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                    <defs>
                      <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45}/>
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.03}/>
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">量能数据加载中...</div>
            )}
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 min-h-[18rem] flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-white">高位风险面板</div>
                <div className="text-xs text-slate-500">看 A 杀、弱转弱和炸板扩散</div>
              </div>
              <div className={`text-sm font-semibold ${latestRisk?.riskLevel === 'high' ? 'text-red-500' : latestRisk?.riskLevel === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`}>
                {latestRisk?.riskLevel === 'high' ? '高危' : latestRisk?.riskLevel === 'medium' ? '预警' : '可控'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
                <div className="text-xs text-slate-400">4板以上样本</div>
                <div className="mt-2 text-2xl font-mono font-bold text-slate-900 dark:text-white">{latestRisk?.highBoardCount ?? 0}</div>
              </div>
              <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
                <div className="text-xs text-slate-400">高位A杀</div>
                <div className="mt-2 text-2xl font-mono font-bold text-red-500">{latestRisk?.aKillCount ?? 0}</div>
              </div>
              <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
                <div className="text-xs text-slate-400">高位转弱</div>
                <div className="mt-2 text-2xl font-mono font-bold text-amber-500">{latestRisk?.weakCount ?? 0}</div>
              </div>
              <div className="rounded-xl bg-white/70 dark:bg-slate-900/40 p-3">
                <div className="text-xs text-slate-400">当日炸板率</div>
                <div className="mt-2 text-2xl font-mono font-bold text-cyan-500">{latestRisk?.brokenRate?.toFixed(1) ?? '0.0'}%</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500 space-y-1 flex-1">
              {(cycleOverview?.reasons ?? []).map(reason => (
                <div key={reason}>• {reason}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderChart = () => {
      if (activeMetric === 'currentCycle') {
          return (
            <div className="w-full flex flex-col">
              {renderCurrentCyclePanel()}
            </div>
          );
      }

      if (activeMetric === 'emotion') {
          if (emotionIndicatorLoading && emotionIndicatorData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> 正在加载跨市场情绪指标...
                  </div>
              );
          }

          if (emotionIndicatorData.length === 0 && indexFuturesLongShortData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Globe2 className="opacity-20" size={48}/>
                      <span>暂无情绪指标数据</span>
                  </div>
              );
          }

          return (
            <div className="w-full h-full flex flex-col">
              <div className="px-4 pt-5 pb-4 space-y-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">情绪指标</div>
                    <div className="text-xs text-slate-400">东方财富跨市场与期指持仓口径</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderSourceBadge(emotionIndicatorSource)}
                    <button
                      onClick={handleRefresh}
                      className="p-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-cyan-500 transition-all"
                      title="刷新情绪指标"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>

                {indexFuturesLongShortData.length > 0 && (
                  <div className="rounded-[30px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-950/40">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <div className="text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-white">期指多空</div>
                          <div className="text-base text-slate-400">指数涨跌方向</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 inline-flex flex-wrap gap-2 rounded-2xl bg-slate-100/90 p-2 dark:bg-white/5">
                      {indexFuturesLongShortData.map((item) => (
                        <button
                          key={item.code}
                          onClick={() => setSelectedIndexFuturesCode(item.code)}
                          className={`rounded-xl px-4 py-2 text-sm transition-all ${
                            selectedIndexFuturesCode === item.code
                              ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
                              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          {item.code} ({item.label})
                        </button>
                      ))}
                    </div>

                    {selectedIndexFuturesSeries && (
                      <>
                        <div className="mt-8 flex items-center gap-2 text-slate-500 dark:text-slate-300">
                          <span className="text-[1.1rem]">主力合约:</span>
                          <span className="font-mono text-[2rem] text-slate-800 dark:text-white">{selectedIndexFuturesSeries.mainContract}</span>
                          <ChevronRight size={22} className="text-slate-300" />
                        </div>

                        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-red-100/80 bg-white p-4 dark:border-red-500/15 dark:bg-red-500/5">
                            <div className="flex items-center gap-3">
                              <span className="inline-block h-1.5 w-7 rounded-full bg-red-500" />
                              <span className="text-[1.05rem] text-slate-500 dark:text-slate-300">多单</span>
                            </div>
                            <div className="mt-2 text-[2.1rem] font-semibold text-red-500">
                              {formatPositionCount(latestIndexFuturesPoint?.longPosition)}
                            </div>
                            <div className={`mt-1 text-sm ${longPositionChangePct === null ? 'text-slate-400' : 'text-red-500'}`}>
                              {longPositionChangePct === null ? '暂无环比' : `${longPositionChangePct >= 0 ? '+' : ''}${longPositionChangePct.toFixed(2)}%`}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-emerald-100/80 bg-white p-4 dark:border-emerald-500/15 dark:bg-emerald-500/5">
                            <div className="flex items-center gap-3">
                              <span className="inline-block h-1.5 w-7 rounded-full bg-emerald-500" />
                              <span className="text-[1.05rem] text-slate-500 dark:text-slate-300">空单</span>
                            </div>
                            <div className="mt-2 text-[2.1rem] font-semibold text-red-500 dark:text-red-400">
                              {formatPositionCount(latestIndexFuturesPoint?.shortPosition)}
                            </div>
                            <div className={`mt-1 text-sm ${shortPositionChangePct === null ? 'text-slate-400' : 'text-red-500'}`}>
                              {shortPositionChangePct === null ? '暂无环比' : `${shortPositionChangePct >= 0 ? '+' : ''}${shortPositionChangePct.toFixed(2)}%`}
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 h-[340px] rounded-3xl bg-slate-50/70 px-1 py-3 dark:bg-white/[0.03]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={selectedIndexFuturesSeries.history} margin={{ top: 10, right: 10, left: 2, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(148,163,184,0.18)" />
                              <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                dy={8}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                width={42}
                                tickFormatter={formatPositionAxisTick}
                              />
                              <Tooltip
                                cursor={{ stroke: 'rgba(148,163,184,0.25)', strokeWidth: 1 }}
                                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', borderColor: 'rgba(226,232,240,0.9)', color: '#0f172a', borderRadius: '14px' }}
                                formatter={(value: number, name: string) => [formatPositionCount(value), name === 'longPosition' ? '多单' : '空单']}
                              />
                              <Line type="monotone" dataKey="longPosition" name="多单" stroke="#ef4444" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                              <Line type="monotone" dataKey="shortPosition" name="空单" stroke="#16a34a" strokeWidth={2.25} dot={false} activeDot={{ r: 4 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="mt-6 rounded-3xl bg-slate-50 p-5 text-[1rem] leading-9 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                          <span className="mr-2 font-semibold text-amber-600">解读</span>
                          股指期货相较现货更灵活，主力机构在 IF、IC、IH、IM 主力合约上的多空持仓变化，通常能更早反映对指数方向的预判。这里展示的是东方财富期指持仓口径下的主力合约多单与空单变化。
                        </div>
                      </>
                    )}
                  </div>
                )}

                {bullBearSignal && (
                  <div className="rounded-[30px] border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-slate-950/40">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <div className="text-[2rem] font-semibold tracking-tight text-slate-900 dark:text-white">牛熊风向标</div>
                          <div className="text-base text-slate-400">{formatBullBearDate(bullBearSignal.date)} 已收盘</div>
                        </div>
                        {bullBearDateOptions.length > 1 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {bullBearDateOptions.map((item) => {
                              const isActive = item.date === bullBearSignal.date;
                              return (
                                <button
                                  key={item.date}
                                  type="button"
                                  onClick={() => setSelectedBullBearDate(item.date)}
                                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                                    isActive
                                      ? 'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300'
                                      : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-slate-200'
                                  }`}
                                >
                                  {formatBullBearDate(item.date)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-7">
                      <div className="text-[1.9rem] font-semibold tracking-tight text-slate-900 dark:text-white">涨跌统计</div>
                      <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-3">
                        <div className="flex items-center gap-3 text-[1.05rem]">
                          <span className="h-3 w-3 rounded bg-red-500" />
                          <span className="text-slate-600 dark:text-slate-300">上涨</span>
                          <span className="font-semibold text-red-500">{bullBearSignal.riseCount}</span>
                          <span className="text-slate-400">家</span>
                        </div>
                        <div className="flex items-center gap-3 text-[1.05rem]">
                          <span className="h-3 w-3 rounded bg-red-300" />
                          <span className="text-slate-600 dark:text-slate-300">涨停</span>
                          <span className="font-semibold text-red-500">{bullBearSignal.limitUpCount}</span>
                          <span className="text-slate-400">家</span>
                        </div>
                        <div className="flex items-center gap-3 text-[1.05rem]">
                          <span className="h-3 w-3 rounded bg-rose-200" />
                          <span className="text-slate-600 dark:text-slate-300">自然涨停</span>
                          <span className="font-semibold text-red-500">{bullBearSignal.naturalLimitUpCount}</span>
                          <span className="text-slate-400">家</span>
                        </div>
                        <div className="flex items-center gap-3 text-[1.05rem]">
                          <span className="h-3 w-3 rounded bg-green-500" />
                          <span className="text-slate-600 dark:text-slate-300">下跌</span>
                          <span className="font-semibold text-green-500">{bullBearSignal.fallCount}</span>
                          <span className="text-slate-400">家</span>
                        </div>
                        <div className="flex items-center gap-3 text-[1.05rem]">
                          <span className="h-3 w-3 rounded bg-green-300" />
                          <span className="text-slate-600 dark:text-slate-300">跌停</span>
                          <span className="font-semibold text-green-500">{bullBearSignal.limitDownCount}</span>
                          <span className="text-slate-400">家</span>
                        </div>
                        <div className="flex items-center gap-3 text-[1.05rem]">
                          <span className="h-3 w-3 rounded bg-emerald-200" />
                          <span className="text-slate-600 dark:text-slate-300">自然跌停</span>
                          <span className="font-semibold text-green-500">{bullBearSignal.naturalLimitDownCount}</span>
                          <span className="text-slate-400">家</span>
                        </div>
                      </div>

                      <div className="mt-6 h-[300px] rounded-3xl bg-slate-50/70 px-2 py-3 dark:bg-white/[0.03]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={bullBearBarData} margin={{ top: 28, right: 8, left: 8, bottom: 8 }}>
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <YAxis hide />
                            <Tooltip
                              cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                              contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', borderColor: 'rgba(226,232,240,0.9)', color: '#0f172a', borderRadius: '14px' }}
                              formatter={(value: number) => [`${value} 家`, '数量']}
                            />
                            <Bar
                              dataKey="count"
                              radius={[14, 14, 0, 0]}
                              fill="#d1d5db"
                            >
                              <LabelList dataKey="count" position="top" fill="#334155" fontSize={11} />
                              {bullBearBarData.map((entry, index) => {
                                const fill = entry.tone === 'up'
                                  ? index === 0 ? '#fca5a5' : index === 1 ? '#f87171' : '#ef4444'
                                  : entry.tone === 'down'
                                    ? index === bullBearBarData.length - 1 ? '#86efac' : index >= bullBearBarData.length - 3 ? '#22c55e' : '#4ade80'
                                    : '#a8a29e';
                                return <Cell key={`bull-bear-cell-${entry.label}`} fill={fill} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="mt-8">
                      <div className="flex items-center gap-3">
                        <div className="text-[1.9rem] font-semibold tracking-tight text-slate-900 dark:text-white">成交分析</div>
                        <div className="text-lg text-slate-400">15:00</div>
                      </div>
                      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5">
                          <div className="text-base text-slate-500">沪深京三市总成交额</div>
                          <div className="mt-3 text-[2.2rem] font-semibold text-slate-900 dark:text-white">
                            {formatAmountYi(bullBearSignal.totalAmount)}
                          </div>
                          <div className={`mt-3 text-lg ${bullBearSignal.amountChangeRate === null ? 'text-slate-400' : bullBearSignal.amountChangeRate >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {bullBearSignal.amountChangeRate === null ? '暂无对比' : `较前一日 ${bullBearSignal.amountChangeRate >= 0 ? '+' : ''}${bullBearSignal.amountChangeRate.toFixed(2)}%`}
                          </div>
                        </div>
                        <div className="rounded-3xl bg-slate-50 p-5 dark:bg-white/5">
                          <div className="text-base text-slate-500">市场状态</div>
                          <div className="mt-3 text-[2.2rem] font-semibold text-slate-900 dark:text-white">
                            {bullBearSignal.riseCount >= bullBearSignal.fallCount ? '偏强' : '偏弱'}
                          </div>
                          <div className="mt-3 text-lg text-slate-500">
                            上涨 {bullBearSignal.riseCount} 家， 下跌 {bullBearSignal.fallCount} 家， 平盘 {bullBearSignal.flatCount} 家
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              <div className="mx-4 mt-1 rounded-[26px] border border-slate-200/80 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-950/30">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">跨市场对比走势</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">显示真实值卡片，下方折线为较前一交易日涨跌幅，可多选</div>
                <div className="flex flex-wrap gap-4">
                  {emotionSeriesOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm cursor-pointer text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        value={option.id}
                        checked={selectedEmotionSeries.includes(option.id)}
                        onChange={() => toggleEmotionSeries(option.id)}
                        className="accent-cyan-500"
                      />
                      <span style={{ color: option.color }}>{option.label}</span>
                    </label>
                  ))}
                </div>
                {selectedEmotionSeriesCards.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {selectedEmotionSeriesCards.map((series) => (
                      <div key={series.id} className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">{series.label}</div>
                        <div className="mt-2 text-2xl font-mono font-bold" style={{ color: series.color }}>
                          {typeof series.latestValue === 'number' ? formatEmotionValue(series.id, series.latestValue) : '—'}
                        </div>
                        <div className={`mt-1 text-xs ${series.change === null ? 'text-slate-400' : series.change >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                          {series.change === null ? '暂无较前一交易日对比' : `较前一交易日 ${series.change >= 0 ? '+' : ''}${series.change.toFixed(2)}%`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative mx-4 mt-4 mb-4 h-[440px] min-h-[440px] rounded-[26px] border border-slate-200/80 bg-white p-3 dark:border-white/10 dark:bg-slate-950/30 md:h-[500px] md:min-h-[500px]">
                {selectedEmotionSeries.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 z-10">
                    <div className="text-center">
                      <p className="font-medium mb-1">请选择上方的指标以显示对比走势</p>
                      <p className="text-xs">默认使用归一化后走势，避免不同量纲互相遮挡。</p>
                    </div>
                  </div>
                )}
                {selectedEmotionSeries.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={emotionComparisonData} margin={{ top: 12, right: 18, left: 4, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} width={52} domain={['auto', 'auto']} tickFormatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Tooltip
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: number, name: string, item: any) => {
                          const matched = emotionSeriesOptions.find((series) => `${series.id}DailyChangePct` === name);
                          if (!matched) return [value, name];
                          const rawValue = item?.payload?.[matched.id];
                          const previousRawValue = getPreviousEmotionValueAt(
                            emotionComparisonData.findIndex((row) => row.date === item?.payload?.date),
                            matched.id,
                          );
                          return [
                            `现值 ${formatEmotionValue(matched.id, rawValue)} / 前值 ${previousRawValue === null ? '—' : formatEmotionValue(matched.id, previousRawValue)} / ${value.toFixed(2)}%`,
                            matched.label,
                          ];
                        }}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconSize={8} wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }} />
                      {emotionSeriesOptions
                        .filter((series) => selectedEmotionSeries.includes(series.id))
                        .map((series) => (
                          <Line
                            key={series.id}
                            type="monotone"
                            dataKey={`${series.id}DailyChangePct`}
                            name={series.label}
                            stroke={series.color}
                            strokeWidth={2.5}
                            dot={{ r: 2 }}
                            activeDot={{ r: 5 }}
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          );
      }

      if (activeMetric === 'broken') {
          if (brokenLoading && brokenData.length === 0) {
              const loadingText =
                 brokenLoadingMode === 'local'
                    ? '正在读取本地缓存...'
                    : brokenLoadingMode === 'api'
                        ? '正在获取接口数据...'
                        : '统计炸板率中...';
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> {loadingText}
                  </div>
              );
          }

          if (brokenData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <AlertTriangle className="opacity-20" size={48}/>
                      <span>暂无炸板数据</span>
                  </div>
              );
          }

          return (
            <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">炸板率</div>
                        <div className="text-4xl font-mono font-bold text-orange-500 dark:text-orange-400">
                            {currentBrokenRate?.toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">炸板家数</div>
                        <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
                            {currentBrokenCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">当日涨停</div>
                        <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
                            {currentBrokenLimitUp} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
                        </div>
                    </div>
                </div>
                <div className="absolute top-4 right-4 z-10">
                    {renderSourceBadge(performanceSource)}
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={brokenData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            dy={10}
                        />
                        <YAxis 
                            yAxisId="left"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#f97316', fontSize: 10}} 
                            domain={[0, 100]}
                            width={30}
                            label={{ value: '炸板率(%)', angle: -90, position: 'insideLeft', fill: '#f97316', fontSize: 11 }}
                        />
                        <YAxis 
                            yAxisId="right"
                            orientation="right"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            domain={[0, 'auto']}
                            allowDecimals={false}
                            width={30}
                            label={{ value: '家数', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 11 }}
                        />
                        <Tooltip 
                            cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'brokenRate') return [`${value}%`, '炸板率'];
                                if (name === 'brokenCount') return [value, '炸板家数'];
                                if (name === 'limitUpCount') return [value, '涨停家数'];
                                return [value, name];
                            }}
                        />
                        <Legend 
                             verticalAlign="top" 
                             align="right"
                             height={36} 
                             iconSize={8}
                             wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }}
                        />
                        <Bar 
                            yAxisId="right"
                            dataKey="brokenCount"
                            name="炸板家数"
                            fill="#fb7185"
                            barSize={18}
                            radius={[4,4,0,0]}
                        />
                        <Line 
                            yAxisId="left"
                            type="monotone"
                            dataKey="brokenRate"
                            name="炸板率"
                            stroke="#f97316"
                            strokeWidth={3}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                        <Line 
                            yAxisId="right"
                            type="monotone"
                            dataKey="limitUpCount"
                            name="涨停家数"
                            stroke="#facc15"
                            strokeDasharray="6 4"
                            strokeWidth={2}
                            dot={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
          );
      }

      if (activeMetric === 'premium') {
          if (premiumLoading && premiumData.length === 0) {
              const loadingText =
                 premiumLoadingMode === 'local'
                    ? '正在读取本地缓存...'
                    : premiumLoadingMode === 'api'
                        ? '正在获取接口数据...'
                        : '统计涨停溢价中...';
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> {loadingText}
                  </div>
              );
          }

          if (premiumData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Zap className="opacity-20" size={48}/>
                      <span>暂无涨停溢价数据</span>
                  </div>
              );
          }

          return (
            <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">最新溢价</div>
                        <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
                            {(selectedPremiumEntry?.premium ?? currentPremium ?? 0).toFixed(2)}%
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            最新溢价?{selectedPremiumEntry?.date ?? currentPremiumDate ?? '?'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">次日成功率</div>
                        <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
                            {(selectedPremiumEntry?.successRate ?? currentSuccessRate ?? 0).toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">晋级家数</div>
                        <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
                            {selectedPremiumEntry?.followThroughCount ?? currentFollowThrough} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={premiumData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            dy={10}
                        />
                        <YAxis 
                            yAxisId="left"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#fb7185', fontSize: 10}} 
                            domain={[0, 15]}
                            width={30}
                            label={{ value: '溢价(%)', angle: -90, position: 'insideLeft', fill: '#fb7185', fontSize: 11 }}
                        />
                        <YAxis 
                            yAxisId="right"
                            orientation="right"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#10b981', fontSize: 10}} 
                            domain={[0, 100]}
                            width={30}
                            label={{ value: '成功率(%)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 11 }}
                        />
                        <YAxis 
                            yAxisId="count"
                            orientation="right"
                            domain={[0, 'auto']} 
                            hide
                        />
                        <Tooltip 
                            cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'premium') return [`${value}%`, '涨停溢价'];
                                if (name === 'successRate') return [`${value}%`, '次日成功率'];
                                if (name === 'followThroughCount') return [value, '晋级家数'];
                                return [value, name];
                            }}
                        />
                        <Legend 
                             verticalAlign="top" 
                             align="right"
                             height={36} 
                             iconSize={8}
                             wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }}
                        />
                        <Area 
                            yAxisId="left"
                            type="monotone"
                            dataKey="premium"
                            name="涨停溢价"
                            stroke="#fb7185"
                            fill="url(#premiumGradient)"
                            strokeWidth={2}
                            activeDot={{ r: 4 }}
                        />
                        <Line 
                            yAxisId="right"
                            type="monotone"
                            dataKey="successRate"
                            name="次日成功率"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                        />
                        <Bar 
                            yAxisId="count"
                            dataKey="followThroughCount"
                            name="晋级家数"
                            fill="#facc15"
                            barSize={16}
                            radius={[4,4,0,0]}
                        />
                        <defs>
                            <linearGradient id="premiumGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.6}/>
                                <stop offset="100%" stopColor="#fb7185" stopOpacity={0.05}/>
                            </linearGradient>
                        </defs>
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
          );
      }

      if (activeMetric === 'structure') {
          if (structureLoading && structureData.length === 0) {
              const loadingText =
                 structureLoadingMode === 'local'
                    ? '正在读取本地缓存...'
                    : structureLoadingMode === 'api'
                        ? '正在获取接口数据...'
                        : '统计涨停结构中...';
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> {loadingText}
                  </div>
              );
          }

          if (structureData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <Activity className="opacity-20" size={48}/>
                      <span>暂无涨停结构数据</span>
                  </div>
              );
          }

          return (
            <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">首板家数</div>
                        <div className="text-4xl font-mono font-bold text-cyan-500 dark:text-cyan-400">
                            {selectedStructureEntry?.firstBoardCount ?? currentFirstBoardCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            最新结构日 {selectedStructureEntry?.date ?? currentStructureDate ?? '?'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">接力家数</div>
                        <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
                            {selectedStructureEntry?.relayCount ?? currentRelayCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">高标家数</div>
                        <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
                            {selectedStructureEntry?.highBoardCount ?? currentHighBoardCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">首板占比</div>
                        <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
                            {(selectedStructureEntry?.firstBoardRatio ?? currentFirstBoardRatio ?? 0).toFixed(1)}%
                        </div>
                    </div>
                </div>
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    {renderSourceBadge(structureSource)}
                    <div className="group cursor-help relative">
                        <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
                            <Info size={16} />
                        </div>
                        <div className="absolute right-0 top-10 w-72 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
                            <h4 className="font-bold mb-2 text-slate-800 dark:text-white">涨停结构说明</h4>
                            <div className="space-y-2 opacity-80">
                                <p>首板高说明市场仍在试错扩散，接力和高标同步抬升，才更像主线主升。</p>
                                <p>图中蓝柱为首板，黄柱为 2 板，橙柱为 3 板，红柱为 4 板及以上，绿线为首板占比。</p>
                            </div>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={structureData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            dy={10}
                        />
                        <YAxis 
                            yAxisId="count"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            domain={[0, 'auto']}
                            allowDecimals={false}
                            width={30}
                            label={{ value: '涨停家数', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                        />
                        <YAxis 
                            yAxisId="ratio"
                            orientation="right"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#10b981', fontSize: 10}} 
                            domain={[0, 100]}
                            width={30}
                            label={{ value: '首板占比(%)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 11 }}
                        />
                        <Tooltip 
                            cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'firstBoardCount') return [value, '首板'];
                                if (name === 'secondBoardCount') return [value, '2板'];
                                if (name === 'thirdBoardCount') return [value, '3板'];
                                if (name === 'highBoardCount') return [value, '4板及以上'];
                                if (name === 'firstBoardRatio') return [`${value}%`, '首板占比'];
                                return [value, name];
                            }}
                        />
                        <Legend 
                             verticalAlign="top" 
                             align="right"
                             height={36} 
                             iconSize={8}
                             wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }}
                        />
                        <Bar yAxisId="count" dataKey="firstBoardCount" name="首板" stackId="structure" fill="#38bdf8" barSize={18} radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="count" dataKey="secondBoardCount" name="2板" stackId="structure" fill="#facc15" barSize={18} radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="count" dataKey="thirdBoardCount" name="3板" stackId="structure" fill="#fb923c" barSize={18} radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="count" dataKey="highBoardCount" name="4板及以上" stackId="structure" fill="#f43f5e" barSize={18} radius={[4, 4, 0, 0]} />
                        <Line 
                            yAxisId="ratio"
                            type="monotone"
                            dataKey="firstBoardRatio"
                            name="首板占比"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
          );
      }

      if (activeMetric === 'repair') {
          if (repairLoading && repairData.length === 0) {
              const loadingText =
                 repairLoadingMode === 'api'
                    ? '正在统计修复率...'
                    : '正在读取数据...';
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> {loadingText}
                  </div>
              );
          }

          if (repairData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <TrendingUp className="opacity-20" size={48}/>
                      <span>暂无修复率数据</span>
                  </div>
              );
          }

          return (
            <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">炸板修复率</div>
                        <div className="text-4xl font-mono font-bold text-emerald-500 dark:text-emerald-400">
                            {currentBrokenRepairRate?.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            最新统计日 {currentRepairDate ?? '?'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">大面修复率</div>
                        <div className="text-4xl font-mono font-bold text-cyan-500 dark:text-cyan-400">
                            {currentBigFaceRepairRate?.toFixed(1)}%
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">昨日炸板样本</div>
                        <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
                            {currentRepairBrokenCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">只</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">昨日大面样本</div>
                        <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
                            {currentBigFaceCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">只</span>
                        </div>
                    </div>
                </div>
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    {renderSourceBadge(repairSource)}
                    <div className="group cursor-help relative">
                        <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
                            <Info size={16} />
                        </div>
                        <div className="absolute right-0 top-10 w-80 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
                            <h4 className="font-bold mb-2 text-slate-800 dark:text-white">修复率说明</h4>
                            <div className="space-y-2 opacity-80">
                                <p>炸板修复率 = 昨日炸板股中，次日收盘红盘的占比。</p>
                                <p>大面修复率 = 昨日炸板池里收盘跌幅大于等于 5% 的个股中，次日收盘红盘的占比。</p>
                                <p>这两项更适合判断退潮是否衰竭，以及分歧后是否出现可参与修复。</p>
                            </div>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={repairData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            dy={10}
                        />
                        <YAxis 
                            yAxisId="left"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#10b981', fontSize: 10}} 
                            domain={[0, 100]}
                            width={30}
                            label={{ value: '修复率(%)', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 11 }}
                        />
                        <YAxis 
                            yAxisId="right"
                            orientation="right"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            domain={[0, 'auto']}
                            allowDecimals={false}
                            width={30}
                            label={{ value: '样本数', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 11 }}
                        />
                        <Tooltip 
                            cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'brokenRepairRate') return [`${value}%`, '炸板修复率'];
                                if (name === 'bigFaceRepairRate') return [`${value}%`, '大面修复率'];
                                if (name === 'brokenCount') return [value, '炸板样本'];
                                if (name === 'bigFaceCount') return [value, '大面样本'];
                                return [value, name];
                            }}
                        />
                        <Legend 
                             verticalAlign="top" 
                             align="right"
                             height={36} 
                             iconSize={8}
                             wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }}
                        />
                        <Bar yAxisId="right" dataKey="brokenCount" name="炸板样本" fill="#f59e0b" barSize={16} radius={[4,4,0,0]} />
                        <Bar yAxisId="right" dataKey="bigFaceCount" name="大面样本" fill="#f43f5e" barSize={16} radius={[4,4,0,0]} />
                        <Line yAxisId="left" type="monotone" dataKey="brokenRepairRate" name="炸板修复率" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line yAxisId="left" type="monotone" dataKey="bigFaceRepairRate" name="大面修复率" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
          );
      }

      if (activeMetric === 'leader') {
          if (leaderLoading && leaderData.length === 0) {
              const loadingText =
                 leaderLoadingMode === 'api'
                    ? '正在跟踪龙头状态...'
                    : '正在读取数据...';
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> {loadingText}
                  </div>
              );
          }

          if (leaderData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <BarChart2 className="opacity-20" size={48}/>
                      <span>暂无龙头状态数据</span>
                  </div>
              );
          }

          return (
            <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 flex-wrap">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">核心龙头</div>
                        <div className="text-3xl font-bold text-violet-500 dark:text-violet-400">
                            {selectedLeaderEntry?.leaderName ?? currentLeader?.name ?? '—'}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            {selectedLeaderEntry?.leaderSymbol ?? currentLeader?.symbol ?? '—'} / {selectedLeaderEntry?.statusLabel ?? currentLeader?.label ?? '待观察'}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">最高板</div>
                        <div className="text-4xl font-mono font-bold text-rose-500 dark:text-rose-400">
                            {selectedLeaderEntry?.leaderBoardCount ?? currentLeaderBoard} <span className="text-base font-sans text-slate-500 dark:text-slate-400">板</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">3板以上家数</div>
                        <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400">
                            {selectedLeaderEntry?.threePlusCount ?? currentThreePlusCount} <span className="text-base font-sans text-slate-500 dark:text-slate-400">家</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">龙头次日反馈</div>
                        <div className={`text-4xl font-mono font-bold ${
                          (selectedLeaderEntry?.nextClosePct ?? currentLeaderNextClose ?? -1) >= 0
                            ? 'text-emerald-500 dark:text-emerald-400'
                            : 'text-cyan-500 dark:text-cyan-400'
                        }`}>
                            {selectedLeaderEntry?.nextClosePct !== null && selectedLeaderEntry?.nextClosePct !== undefined
                              ? `${selectedLeaderEntry.nextClosePct.toFixed(2)}%`
                              : currentLeaderNextClose !== null ? `${currentLeaderNextClose.toFixed(2)}%` : '—'}
                        </div>
                    </div>
                </div>
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    {renderSourceBadge(leaderSource)}
                    <div className="group cursor-help relative">
                        <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
                            <Info size={16} />
                        </div>
                        <div className="absolute right-0 top-10 w-80 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
                            <h4 className="font-bold mb-2 text-slate-800 dark:text-white">龙头状态说明</h4>
                            <div className="space-y-2 opacity-80">
                                <p>用每日最高连板股作为核心龙头样本，观察它的高度、抱团数量、3板以上梯队，以及次日反馈。</p>
                                <p>标签优先看一字加速、强势晋级、高位分歧、退潮承压，帮助区分主升与退潮。</p>
                            </div>
                        </div>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={leaderData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            dy={10}
                        />
                        <YAxis 
                            yAxisId="count"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            domain={[0, 'auto']}
                            allowDecimals={false}
                            width={30}
                            label={{ value: '板数/家数', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                        />
                        <YAxis 
                            yAxisId="pct"
                            orientation="right"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#10b981', fontSize: 10}} 
                            domain={['auto', 'auto']}
                            width={36}
                            label={{ value: '次日涨跌(%)', angle: 90, position: 'insideRight', fill: '#10b981', fontSize: 11 }}
                        />
                        <Tooltip 
                            cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number | string | null, name: string, item: any) => {
                                if (name === 'leaderBoardCount') return [value, '最高板'];
                                if (name === 'threePlusCount') return [value, '3板以上家数'];
                                if (name === 'leaderCount') return [value, '同高度龙头数'];
                                if (name === 'nextClosePct') return [value === null ? '—' : `${value}%`, '次日收盘反馈'];
                                if (name === 'nextOpenPct') return [value === null ? '—' : `${value}%`, '次日开盘反馈'];
                                return [value, item?.payload?.statusLabel ?? name];
                            }}
                            labelFormatter={(label, payload) => {
                                const row = payload?.[0]?.payload;
                                if (!row) return label;
                                return `${label} ${row.leaderName} (${row.leaderSymbol}) ${row.statusLabel}`;
                            }}
                        />
                        <Legend 
                             verticalAlign="top" 
                             align="right"
                             height={36} 
                             iconSize={8}
                             wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }}
                        />
                        <Bar yAxisId="count" dataKey="leaderBoardCount" name="最高板" fill="#8b5cf6" barSize={16} radius={[4,4,0,0]} />
                        <Bar yAxisId="count" dataKey="threePlusCount" name="3板以上家数" fill="#f59e0b" barSize={16} radius={[4,4,0,0]} />
                        <Line yAxisId="count" type="monotone" dataKey="leaderCount" name="同高度龙头数" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line yAxisId="pct" type="monotone" dataKey="nextClosePct" name="次日收盘反馈" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        <Line yAxisId="pct" type="monotone" dataKey="nextOpenPct" name="次日开盘反馈" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
          );
      }

      if (activeMetric === 'height') {
          if (boardHeightLoading && boardHeightData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> 正在加载连板高度趋势...
                  </div>
              );
          }

          if (boardHeightData.length === 0) {
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <BarChart2 className="opacity-20" size={48}/>
                      <span>暂无连板高度趋势数据</span>
                  </div>
              );
          }

          return (
            <div className="w-full h-full flex flex-col">
                <style>{`
                  .board-height-pan::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                <div className="px-3 pt-3 pb-3 border-b border-slate-200 dark:border-white/5 space-y-3 flex-shrink-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <div className="text-sm font-semibold text-slate-800 dark:text-white">连板高度趋势</div>
                            <div className="text-xs text-slate-500">跟踪主板最高板、主板次高板、创业板最高板，并直接带出对应股票名。</div>
                        </div>
                        <div className="flex items-center gap-2">
                            {renderSourceBadge(boardHeightSource)}
                            <button
                              onClick={handleRefresh}
                              className="p-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-cyan-500 transition-all"
                              title="刷新高度趋势"
                            >
                              <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">主板最高板</div>
                        <div className="mt-1.5 text-2xl font-mono font-bold text-rose-500">
                          {latestBoardHeight?.mainBoardHighest ?? '—'}<span className="ml-1 text-sm font-sans text-slate-500">板</span>
                        </div>
                        <div className="mt-1.5 text-[11px] leading-5 text-slate-500">{latestBoardHeight ? formatBoardNames(latestBoardHeight.mainBoardHighestNames, latestBoardHeight.mainBoardHighestSymbols) : '—'}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">主板次高板</div>
                        <div className="mt-1.5 text-2xl font-mono font-bold text-amber-500">
                          {latestBoardHeight?.mainBoardSecondHighest ?? '—'}<span className="ml-1 text-sm font-sans text-slate-500">板</span>
                        </div>
                        <div className="mt-1.5 text-[11px] leading-5 text-slate-500">{latestBoardHeight ? formatBoardNames(latestBoardHeight.mainBoardSecondHighestNames, latestBoardHeight.mainBoardSecondHighestSymbols) : '—'}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3">
                        <div className="text-xs uppercase tracking-wide text-slate-400">创业板最高板</div>
                        <div className="mt-1.5 text-2xl font-mono font-bold text-cyan-500">
                          {latestBoardHeight?.chinextHighest ?? '—'}<span className="ml-1 text-sm font-sans text-slate-500">板</span>
                        </div>
                        <div className="mt-1.5 text-[11px] leading-5 text-slate-500">{latestBoardHeight ? formatBoardNames(latestBoardHeight.chinextHighestNames, latestBoardHeight.chinextHighestSymbols) : '—'}</div>
                      </div>
                    </div>
                </div>

                <div className="flex-1 min-h-[760px] pb-2 pl-2 pr-1">
                  <div className="mb-2 flex flex-wrap items-center justify-end gap-3 pr-3 text-[11px] text-slate-500">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <span>主板最高板</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span>主板次高板</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                      <span>创业板最高板</span>
                    </div>
                  </div>
                  <div className="flex h-full min-h-[760px]">
                    <div className="w-14 flex-shrink-0 pt-14 pb-12 pr-2">
                      <div className="flex h-full flex-col-reverse justify-between text-right text-[10px] font-medium text-slate-400">
                        {boardHeightAxisTicks.ticks.map((tick) => (
                          <div key={`board-axis-${tick}`} className="leading-none">
                            {tick}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div
                      ref={boardHeightScrollRef}
                      className={`board-height-pan flex-1 min-w-0 overflow-x-auto overflow-y-hidden select-none outline-none ${isBoardHeightDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      onMouseDown={handleBoardHeightMouseDown}
                      onMouseMove={handleBoardHeightMouseMove}
                      onMouseUp={stopBoardHeightDrag}
                      onMouseLeave={stopBoardHeightDrag}
                    >
                      <div className="h-full min-h-[760px] pl-2 pr-8 outline-none" style={{ width: boardHeightChartWidth + 20 }}>
                      <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sortedBoardHeightData} margin={{ top: 72, right: 40, left: 0, bottom: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} dy={10} />
                      <YAxis hide domain={[0, boardHeightAxisTicks.max]} ticks={boardHeightAxisTicks.ticks} allowDecimals={false} />
                      <Tooltip
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8' }}
                        formatter={(value: number | string, name: string, item: any) => {
                          const row = item?.payload as BoardHeightEntry | undefined;
                          if (name === 'mainBoardHighest') return [`${value} 板 / ${formatBoardNames(row?.mainBoardHighestNames ?? [], row?.mainBoardHighestSymbols ?? [])}`, '主板最高板'];
                          if (name === 'mainBoardSecondHighest') return [`${value} 板 / ${formatBoardNames(row?.mainBoardSecondHighestNames ?? [], row?.mainBoardSecondHighestSymbols ?? [])}`, '主板次高板'];
                          if (name === 'chinextHighest') return [`${value} 板 / ${formatBoardNames(row?.chinextHighestNames ?? [], row?.chinextHighestSymbols ?? [])}`, '创业板最高板'];
                          return [value, name];
                        }}
                        labelFormatter={(label: string, payload: any) => {
                          const row = payload?.[0]?.payload as BoardHeightEntry | undefined;
                          return row?.fullDate ? `${label} (${row.fullDate})` : label;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="mainBoardHighest"
                        name="主板最高板"
                        stroke="#f43f5e"
                        strokeWidth={3}
                        dot={renderBoardHeightDot('mainBoardHighestNames', '#f43f5e', -12, 'left')}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="mainBoardSecondHighest"
                        name="主板次高板"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={renderBoardHeightDot('mainBoardSecondHighestNames', '#f59e0b', 18, 'center')}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="chinextHighest"
                        name="创业板最高板"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        dot={renderBoardHeightDot('chinextHighestNames', '#06b6d4', -26, 'right')}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
            </div>
          );
      }

      if (activeMetric === 'pressure') {
          if (loading && coeffData.length === 0) {
              const loadingText =
                 sentimentLoadingMode === 'local'
                    ? '正在读取本地缓存...'
                    : sentimentLoadingMode === 'api'
                        ? '正在获取接口数据...'
                        : '计算全市场情绪指标中...';
              return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2">
                      <Loader2 className="animate-spin" /> {loadingText}
                  </div>
              );
          }

          if (coeffData.length === 0) {
               return (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                      <BarChart2 className="opacity-20" size={48}/>
                      <span>暂无足够数据计算系数</span>
                  </div>
               );
          }

          return (
            <div className="w-full h-full flex flex-col">
                {renderLineSelector()}
                <div className="flex-1 relative">
                {selectedSeries.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <p className="font-medium mb-1">请选择上方的指标以显示折线图</p>
                      <p className="text-xs">支持砸盘系数、连板高度、涨跌家数等数据</p>
                    </div>
                  </div>
                )}
                 {/* Chart Header Info */}
                 <div className="absolute top-0 left-0 z-10 p-4 flex gap-6 md:gap-8 flex-wrap">
                     <div>
                        <div className="text-4xl font-mono font-bold text-slate-800 dark:text-white flex items-end gap-2">
                            {(selectedCoeffEntry?.value ?? currentScore ?? 0).toFixed(2)} <span className="text-sm font-sans font-normal text-slate-500 mb-1">系数</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">基于连板晋级率</div>
                     </div>
                     
                     <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden md:block">
                        <div className="text-4xl font-mono font-bold text-red-500 dark:text-red-400 flex items-end gap-2">
                            {selectedCoeffEntry?.height ?? currentHeight} <span className="text-sm font-sans font-normal text-slate-500 mb-1">最高板</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">市场连板高度</div>
                     </div>

                     <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden lg:block">
                        <div className="text-4xl font-mono font-bold text-amber-500 dark:text-amber-400 flex items-end gap-2">
                            {selectedCoeffEntry?.limitUpCount ?? currentLimitUpCount} <span className="text-sm font-sans font-normal text-slate-500 mb-1">家</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">今日涨停 (实盘)</div>
                     </div>

                     <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden xl:block">
                        <div className="text-4xl font-mono font-bold text-sky-500 dark:text-sky-400 flex items-end gap-2">
                            {selectedCoeffEntry?.riseCount ?? currentRiseCount ?? '—'} <span className="text-sm font-sans font-normal text-slate-500 mb-1">家</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">上涨家数</div>
                     </div>

                     {/* Real-time Breadth - Accurate Data */}
                     {realTimeBreadth && (
                        <div className="pl-6 border-l border-slate-200 dark:border-white/10 hidden xl:block">
                             <div className="flex flex-col justify-center h-full gap-1">
                                 <div className="flex items-center gap-2 text-xs">
                                     <span className="text-red-500 font-bold flex items-center"><TrendingUp size={12} className="mr-1"/> {realTimeBreadth.rise}</span>
                                     <span className="text-slate-400">上涨</span>
                                 </div>
                                 <div className="flex items-center gap-2 text-xs">
                                     <span className="text-green-500 font-bold flex items-center"><TrendingDown size={12} className="mr-1"/> {realTimeBreadth.fall}</span>
                                     <span className="text-slate-400">下跌</span>
                                 </div>
                             </div>
                        </div>
                     )}
                 </div>

                 {/* Custom Tooltip Logic */}
                 <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                     {renderSourceBadge(sentimentSource)}
                     {/* Refresh Button */}
                     <button 
                        onClick={handleRefresh}
                        className={`p-2 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-gray-400 hover:text-cyan-500 transition-all ${isRefreshing ? 'animate-spin text-cyan-500' : ''}`}
                        title="重置并更新数据"
                     >
                        <RefreshCw size={16} />
                     </button>
                     
                     <div className="group cursor-help relative">
                        <div className="bg-slate-200 dark:bg-white/10 p-2 rounded-full text-slate-500 dark:text-gray-400">
                            <Info size={16} />
                        </div>
                        {/* Tooltip Popup */}
                        <div className="absolute right-0 top-10 w-72 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl text-xs text-slate-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-30">
                            <h4 className="font-bold mb-2 text-slate-800 dark:text-white">指标算法说明</h4>
                            <div className="mb-2 space-y-2">
                                <div>
                                    <span className="font-bold text-green-500">砸盘系数:</span>
                                    <p className="mt-1 opacity-80">
                                        系数 = (当日各阶段晋级率之和 ÷ 阶段数) × 10
                                    </p>
                                </div>
                                <div>
                                    <span className="font-bold text-amber-500">数据源:</span>
                                    <p className="mt-1 opacity-80">
                                        近期数据源自交易所真实统计。因API限制，部分远期历史数据可能基于指数波动模型回溯模拟，以保证趋势连续性。
                                    </p>
                                </div>
                            </div>
                        </div>
                     </div>
                 </div>

                {selectedSeries.length > 0 && (
                 <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={coeffData} margin={{ top: 90, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        
                        <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#94a3b8', fontSize: 10}} 
                            dy={10}
                        />
                        
                        {/* Left Axis: Coefficient */}
                        <YAxis 
                            yAxisId="left"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#10b981', fontSize: 10}} 
                            domain={[0, 'auto']}
                            width={30}
                        />

                        {/* Right Axis: Height */}
                        <YAxis 
                            yAxisId="right"
                            orientation="right"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#ef4444', fontSize: 10}} 
                            domain={[0, 'auto']}
                            allowDecimals={false}
                            width={30}
                        />

                        {/* Hidden Axis: Limit Up/Down Count (Scaled separately to avoid overlap with coeff) */}
                        <YAxis 
                            yAxisId="count"
                            orientation="right"
                            domain={[0, 'auto']} 
                            hide
                        />

                        <Tooltip 
                            cursor={{stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1}}
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '8px' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number, name: string) => {
                                if (name === 'value') return [value, '砸盘系数'];
                                if (name === 'height') return [value, '连板高度'];
                                if (name === 'limitUpCount') return [value, '涨停家数'];
                                if (name === 'limitDownCount') return [value, '跌停家数'];
                                if (name === 'riseCount') return [value, '上涨家数'];
                                return [value, name];
                            }}
                        />
                        
                        <Legend 
                             verticalAlign="top" 
                             align="right"
                             height={36} 
                             iconSize={8}
                             wrapperStyle={{ paddingRight: '80px', paddingTop: '0px' }}
                        />

                        {/* Line 1: Limit Up Count (Amber) - Accurate History */}
                        {selectedSeries.includes('limitUpCount') && (
                        <Line 
                            yAxisId="count"
                            type="monotone" 
                            dataKey="limitUpCount" 
                            name="涨停家数"
                            stroke="#f59e0b" 
                            strokeWidth={2}
                            strokeOpacity={0.8}
                            dot={false}
                            activeDot={{ r: 4, fill: '#f59e0b' }}
                            animationDuration={1500}
                        >
                            <LabelList 
                                dataKey="limitUpCount" 
                                position="top" 
                                offset={5} 
                                style={{ fill: '#f59e0b', fontSize: '9px', opacity: 0.8 }} 
                            />
                        </Line>
                        )}

                        {/* Line 2: Limit Down Count (Cyan/Green) - Accurate History */}
                        {selectedSeries.includes('limitDownCount') && (
                        <Line 
                            yAxisId="count"
                            type="monotone" 
                            dataKey="limitDownCount" 
                            name="跌停家数"
                            stroke="#22d3ee" 
                            strokeWidth={1}
                            strokeOpacity={0.6}
                            dot={false}
                            activeDot={{ r: 4, fill: '#22d3ee' }}
                            animationDuration={1500}
                        />
                        )}

                        {/* Line 3: Rise Count (Blue) */}
                        {selectedSeries.includes('riseCount') && (
                        <Line 
                            yAxisId="count"
                            type="monotone"
                            dataKey="riseCount"
                            name="上涨家数"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            strokeOpacity={0.8}
                            dot={false}
                            activeDot={{ r: 4, fill: '#38bdf8' }}
                            animationDuration={1500}
                        >
                            <LabelList 
                                dataKey="riseCount" 
                                position="top" 
                                offset={10} 
                                style={{ fill: '#38bdf8', fontSize: '9px', opacity: 0.8 }} 
                            />
                        </Line>
                        )}

                        {/* Line 4: Height (Red) */}
                        {selectedSeries.includes('height') && (
                        <Line 
                            yAxisId="right"
                            type="step" 
                            dataKey="height" 
                            name="连板高度"
                            stroke="#ef4444" 
                            strokeWidth={1}
                            strokeDasharray="4 4"
                            dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                            animationDuration={1500}
                            >
                                 <LabelList 
                                    dataKey="height" 
                                position="top" 
                                offset={5} 
                                style={{ fill: '#ef4444', fontSize: '10px', fontWeight: 'bold' }} 
                            />
                        </Line>
                        )}

                        {/* Line 5: Coefficient (Green) - Top Layer */}
                        {selectedSeries.includes('value') && (
                        <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="value" 
                            name="砸盘系数"
                            stroke="#10b981" 
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }}
                            animationDuration={1500}
                            >
                                <LabelList 
                                    dataKey="value" 
                                position="top" 
                                offset={10} 
                                style={{ fill: '#10b981', fontSize: '10px', fontWeight: 'bold' }} 
                                formatter={(val: number) => val.toFixed(1)}
                            />
                        </Line>
                        )}

                    </ComposedChart>
                </ResponsiveContainer>
                )}
             </div>
            </div>
          );
      }
      
      // Placeholders for other metrics
      return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <BarChart2 size={48} className="opacity-20" />
              <p>该指标 ({metrics.find(m => m.id === activeMetric)?.label}) 数据接入中...</p>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Top Toolbar */}
      <GlassCard className="flex-shrink-0" noPadding>
          <div className="flex p-2 gap-2 overflow-x-auto">
              {metrics.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setActiveMetric(m.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-bold text-sm whitespace-nowrap
                        ${activeMetric === m.id 
                            ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10' 
                            : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5'
                        }
                    `}
                  >
                      <span className={activeMetric === m.id ? m.color : 'opacity-50 grayscale'}>{m.icon}</span>
                      {m.label}
                  </button>
              ))}
          </div>
      </GlassCard>

      {/* Main Content Area */}
      <GlassCard className="flex-1 min-h-0 relative" noPadding>
         {historicalDateOptions.length > 0 && (
           <div className="flex items-center justify-end border-b border-slate-200/70 px-4 py-3 dark:border-white/10">
             <div className="flex items-center gap-3">
               <span className="text-xs font-medium text-slate-500 dark:text-gray-400">查看日期</span>
               <select
                 value={selectedHistoricalDate}
                 onChange={(event) => setSelectedHistoricalDate(event.target.value)}
                 className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
               >
                 {historicalDateOptions.map((date) => (
                   <option key={date} value={date}>
                     {date}
                   </option>
                 ))}
               </select>
             </div>
           </div>
         )}
         <div className="h-full w-full min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-2">
             {renderChart()}
         </div>
      </GlassCard>
    </div>
  );
};

export default SentimentSection;
