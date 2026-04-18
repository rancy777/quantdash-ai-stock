import { Dispatch, SetStateAction, useMemo } from 'react';

import { BoardHeightEntry, BullBearSignalSnapshot, EmotionIndicatorEntry, IndexFuturesLongShortSeries } from '../../../types';

import {
  BrokenEntry,
  CoeffEntry,
  LeaderEntry,
  PremiumEntry,
  RepairEntry,
  StructureEntry,
  VolumeTrendEntry,
} from './types';

type UseSentimentMetricCalculationsArgs = {
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
  selectedEmotionSeries: string[];
  selectedHistoricalDate: string;
  selectedIndexFuturesCode: 'IF' | 'IC' | 'IH' | 'IM';
  selectedSeries: string[];
  setSelectedEmotionSeries: Dispatch<SetStateAction<string[]>>;
  setSelectedSeries: Dispatch<SetStateAction<string[]>>;
  structureData: StructureEntry[];
  volumeTrendData: VolumeTrendEntry[];
};

export default function useSentimentMetricCalculations({
  boardHeightData,
  brokenData,
  bullBearHistory,
  bullBearSignal,
  coeffData,
  emotionIndicatorData,
  indexFuturesLongShortData,
  leaderData,
  premiumData,
  repairData,
  selectedEmotionSeries,
  selectedHistoricalDate,
  selectedIndexFuturesCode,
  setSelectedEmotionSeries,
  setSelectedSeries,
  structureData,
  volumeTrendData,
}: UseSentimentMetricCalculationsArgs) {
  const emotionSeriesOptions: Array<{ id: keyof EmotionIndicatorEntry; label: string; unit: string; color: string }> = [
    { id: 'ftseA50', label: '富时A50', unit: '', color: '#22c55e' },
    { id: 'nasdaq', label: '纳斯达克', unit: '', color: '#38bdf8' },
    { id: 'dowJones', label: '道琼斯', unit: '', color: '#f59e0b' },
    { id: 'sp500', label: '标普500', unit: '', color: '#f43f5e' },
    { id: 'offshoreRmb', label: '离岸人民币', unit: '', color: '#a855f7' },
    { id: 'ashareAvgValuation', label: 'A股平均估值', unit: 'PE', color: '#14b8a6' },
    { id: 'indexFuturesLongShortRatio', label: '期指多空比', unit: 'x', color: '#f97316' },
  ];

  const getPreviousEmotionValueAt = (index: number, id: keyof EmotionIndicatorEntry) => {
    for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
      const candidate = emotionIndicatorData[pointer]?.[id];
      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate !== 0) {
        return candidate;
      }
    }
    return null;
  };

  const toggleEmotionSeries = (seriesId: string) => {
    setSelectedEmotionSeries((current) =>
      current.includes(seriesId)
        ? current.filter((item) => item !== seriesId)
        : [...current, seriesId],
    );
  };

  const emotionComparisonData = useMemo(() => {
    const compareDailyChange = (index: number, key: keyof EmotionIndicatorEntry) => {
      const current = emotionIndicatorData[index]?.[key];
      const previous = getPreviousEmotionValueAt(index, key);
      if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) {
        return null;
      }
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    return emotionIndicatorData.map((item, index) => ({
      ...item,
      ftseA50DailyChangePct: compareDailyChange(index, 'ftseA50'),
      nasdaqDailyChangePct: compareDailyChange(index, 'nasdaq'),
      dowJonesDailyChangePct: compareDailyChange(index, 'dowJones'),
      sp500DailyChangePct: compareDailyChange(index, 'sp500'),
      offshoreRmbDailyChangePct: compareDailyChange(index, 'offshoreRmb'),
      ashareAvgValuationDailyChangePct: compareDailyChange(index, 'ashareAvgValuation'),
      indexFuturesLongShortRatioDailyChangePct: compareDailyChange(index, 'indexFuturesLongShortRatio'),
    }));
  }, [emotionIndicatorData]);

  const latestEmotionIndicator = emotionIndicatorData[emotionIndicatorData.length - 1] ?? null;
  const selectedIndexFuturesSeries =
    indexFuturesLongShortData.find((item) => item.code === selectedIndexFuturesCode) ?? null;
  const latestIndexFuturesPoint =
    selectedIndexFuturesSeries?.history[selectedIndexFuturesSeries.history.length - 1] ?? null;
  const previousIndexFuturesPoint =
    selectedIndexFuturesSeries?.history[selectedIndexFuturesSeries.history.length - 2] ?? null;

  const sortedBoardHeightData = useMemo(
    () => [...boardHeightData].sort((a, b) => (a.fullDate ?? a.date).localeCompare(b.fullDate ?? b.date)),
    [boardHeightData],
  );
  const latestBoardHeight = sortedBoardHeightData[sortedBoardHeightData.length - 1] ?? null;
  const selectedCoeffEntry =
    coeffData.find((item) => item.date === selectedHistoricalDate) ?? coeffData[coeffData.length - 1] ?? null;
  const selectedPremiumEntry =
    premiumData.find((item) => item.date === selectedHistoricalDate) ?? premiumData[premiumData.length - 1] ?? null;
  const selectedBrokenEntry =
    brokenData.find((item) => item.date === selectedHistoricalDate) ?? brokenData[brokenData.length - 1] ?? null;
  const selectedStructureEntry =
    structureData.find((item) => item.date === selectedHistoricalDate) ?? structureData[structureData.length - 1] ?? null;
  const selectedRepairEntry =
    repairData.find((item) => item.date === selectedHistoricalDate) ?? repairData[repairData.length - 1] ?? null;
  const selectedLeaderEntry =
    leaderData.find((item) => item.date === selectedHistoricalDate) ?? leaderData[leaderData.length - 1] ?? null;
  const selectedBoardHeightEntry =
    sortedBoardHeightData.find((item) => (item.fullDate ?? item.date) === selectedHistoricalDate) ?? latestBoardHeight;

  const boardHeightChartWidth = useMemo(
    () => Math.max(1500, sortedBoardHeightData.length * 220),
    [sortedBoardHeightData.length],
  );
  const boardHeightDateIndexMap = useMemo(
    () => new Map(sortedBoardHeightData.map((item, index) => [item.fullDate ?? item.date, index] as const)),
    [sortedBoardHeightData],
  );
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
    return { ticks, max: roundedMax };
  }, [sortedBoardHeightData]);

  const volumeTrendAxisDomain = useMemo<[number, number]>(() => {
    if (volumeTrendData.length === 0) return [0, 1];
    const amounts = volumeTrendData.map((item) => item.amount).filter((value): value is number => Number.isFinite(value));
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

  const formatEmotionValue = (id: keyof EmotionIndicatorEntry, value: number) => {
    if (id === 'offshoreRmb') return value.toFixed(3);
    if (id === 'ashareAvgValuation') return `${value.toFixed(1)}x`;
    if (id === 'indexFuturesLongShortRatio') return `${value.toFixed(2)}x`;
    return value.toFixed(0);
  };

  const selectedEmotionSeriesCards = useMemo(() => {
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

    const getEmotionChange = (id: keyof EmotionIndicatorEntry) => {
      if (!latestEmotionIndicator) return null;
      const latest = latestEmotionIndicator[id];
      const previous = getPreviousEmotionValue(id);
      if (typeof latest !== 'number' || typeof previous !== 'number' || previous === 0) return null;
      return Number((((latest - previous) / previous) * 100).toFixed(2));
    };

    return emotionSeriesOptions
      .filter((series) => selectedEmotionSeries.includes(series.id))
      .map((series) => ({
        ...series,
        latestValue: latestEmotionIndicator?.[series.id],
        change: getEmotionChange(series.id),
      }));
  }, [emotionIndicatorData, emotionSeriesOptions, latestEmotionIndicator, selectedEmotionSeries]);

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

  const longPositionChangePct = getPositionChangePct(
    latestIndexFuturesPoint?.longPosition,
    previousIndexFuturesPoint?.longPosition,
  );
  const shortPositionChangePct = getPositionChangePct(
    latestIndexFuturesPoint?.shortPosition,
    previousIndexFuturesPoint?.shortPosition,
  );

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

  const lineSeriesOptions = [
    { id: 'value', label: '砸盘系数' },
    { id: 'height', label: '连板高度' },
    { id: 'limitUpCount', label: '涨停家数' },
    { id: 'limitDownCount', label: '跌停家数' },
    { id: 'riseCount', label: '上涨家数' },
  ];

  const toggleSeries = (seriesId: string) => {
    setSelectedSeries((current) =>
      current.includes(seriesId)
        ? current.filter((item) => item !== seriesId)
        : [...current, seriesId],
    );
  };

  return {
    boardHeightAxisTicks,
    boardHeightChartWidth,
    boardHeightDateIndexMap,
    bullBearBarData,
    bullBearDateOptions,
    emotionComparisonData,
    emotionSeriesOptions,
    formatAmountYi,
    formatBullBearDate,
    formatEmotionValue,
    formatPositionAxisTick,
    formatPositionCount,
    formatVolumeAxisTick,
    getPreviousEmotionValueAt,
    latestBoardHeight,
    latestEmotionIndicator,
    latestIndexFuturesPoint,
    lineSeriesOptions,
    longPositionChangePct,
    previousIndexFuturesPoint,
    selectedBoardHeightEntry,
    selectedBrokenEntry,
    selectedCoeffEntry,
    selectedEmotionSeriesCards,
    selectedIndexFuturesSeries,
    selectedLeaderEntry,
    selectedPremiumEntry,
    selectedRepairEntry,
    selectedStructureEntry,
    shortPositionChangePct,
    sortedBoardHeightData,
    toggleEmotionSeries,
    toggleSeries,
    volumeTrendAxisDomain,
  };
}
