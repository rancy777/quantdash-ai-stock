import { Dispatch, SetStateAction, useEffect, useMemo } from 'react';

import { BoardHeightEntry, BullBearSignalSnapshot } from '../../../types';

import { BrokenEntry, CoeffEntry, LeaderEntry, PremiumEntry, RepairEntry, SentimentMetricId, StructureEntry } from './types';

type UseSentimentSelectionSyncArgs = {
  activeMetric: SentimentMetricId;
  boardHeightData: BoardHeightEntry[];
  brokenData: BrokenEntry[];
  bullBearHistory: BullBearSignalSnapshot[];
  coeffData: CoeffEntry[];
  leaderData: LeaderEntry[];
  premiumData: PremiumEntry[];
  repairData: RepairEntry[];
  selectedBullBearDate: string | null;
  selectedEmotionSeries: string[];
  selectedHistoricalDate: string;
  selectedSeries: string[];
  setBullBearSignal: Dispatch<SetStateAction<BullBearSignalSnapshot | null>>;
  setSelectedBullBearDate: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionSeries: Dispatch<SetStateAction<string[]>>;
  setSelectedHistoricalDate: Dispatch<SetStateAction<string>>;
  setSelectedSeries: Dispatch<SetStateAction<string[]>>;
  structureData: StructureEntry[];
};

export default function useSentimentSelectionSync({
  activeMetric,
  boardHeightData,
  brokenData,
  bullBearHistory,
  coeffData,
  leaderData,
  premiumData,
  repairData,
  selectedBullBearDate,
  selectedHistoricalDate,
  selectedSeries,
  setBullBearSignal,
  setSelectedEmotionSeries,
  setSelectedHistoricalDate,
  setSelectedSeries,
  structureData,
}: UseSentimentSelectionSyncArgs) {
  useEffect(() => {
    if (activeMetric === 'pressure' && selectedSeries.length === 0) {
      setSelectedSeries(['value', 'height', 'limitUpCount', 'riseCount']);
    } else if (activeMetric !== 'pressure') {
      setSelectedSeries([]);
    }
  }, [activeMetric, selectedSeries.length, setSelectedSeries]);

  useEffect(() => {
    if (activeMetric !== 'emotion') {
      setSelectedEmotionSeries(['ftseA50', 'nasdaq', 'offshoreRmb', 'indexFuturesLongShortRatio']);
    }
  }, [activeMetric, setSelectedEmotionSeries]);

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
  }, [historicalDateOptions, selectedHistoricalDate, setSelectedHistoricalDate]);

  useEffect(() => {
    if (!selectedBullBearDate) {
      setBullBearSignal(bullBearHistory.at(-1) ?? null);
      return;
    }
    const selected = bullBearHistory.find((item) => item.date === selectedBullBearDate) ?? null;
    setBullBearSignal(selected ?? bullBearHistory.at(-1) ?? null);
  }, [bullBearHistory, selectedBullBearDate, setBullBearSignal]);

  return {
    historicalDateOptions,
  };
}
