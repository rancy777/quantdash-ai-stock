import type { EmotionIndicatorEntry } from '../types';
import { getBullBearSignalHistory, getBullBearSignalSnapshot } from './emotionIndicator/bullBearSignal';
import { getIndexFuturesLongShortHistory, getIndexFuturesLongShortRatioSeries } from './emotionIndicator/indexFutures';
import {
  getEmotionIndicatorDataSource,
  getEmotionIndicatorUpdatedAt,
  setEmotionIndicatorDataSource,
} from './emotionIndicator/shared';
import {
  fetchAshareAveragePe,
  fetchEmotionIndexSeries,
  normalizeAshareAveragePe,
} from './emotionIndicator/valuation';
import { loadLocalJsonFile } from './localDataService';

export {
  getBullBearSignalHistory,
  getBullBearSignalSnapshot,
  getEmotionIndicatorDataSource,
  getEmotionIndicatorUpdatedAt,
  getIndexFuturesLongShortHistory,
};

export const getEmotionIndicatorHistory = async (): Promise<EmotionIndicatorEntry[]> => {
  const localIndicators = await loadLocalJsonFile<EmotionIndicatorEntry[]>('emotion_indicators.json');
  if (localIndicators && localIndicators.length > 0) {
    setEmotionIndicatorDataSource('local');
    return localIndicators;
  }

  try {
    const [a50Series, nasdaqSeries, dowSeries, spSeries, cnhSeries, ashareAveragePe, indexFuturesLongShortSeries] = await Promise.all([
      fetchEmotionIndexSeries('100.XIN9'),
      fetchEmotionIndexSeries('100.NDX'),
      fetchEmotionIndexSeries('100.DJIA'),
      fetchEmotionIndexSeries('100.SPX'),
      fetchEmotionIndexSeries('133.USDCNH'),
      fetchAshareAveragePe(),
      getIndexFuturesLongShortRatioSeries(),
    ]);

    const dates = [...a50Series.keys()]
      .filter((date) => (
        nasdaqSeries.has(date) &&
        dowSeries.has(date) &&
        spSeries.has(date) &&
        cnhSeries.has(date) &&
        indexFuturesLongShortSeries.has(date)
      ))
      .sort((a, b) => a.localeCompare(b))
      .slice(-10);

    if (dates.length > 0) {
      const merged = dates
        .map((date) => ({
          date,
          ftseA50: a50Series.get(date)!,
          nasdaq: nasdaqSeries.get(date)!,
          dowJones: dowSeries.get(date)!,
          sp500: spSeries.get(date)!,
          offshoreRmb: cnhSeries.get(date)!,
          ashareAvgValuation: normalizeAshareAveragePe(ashareAveragePe, null) ?? 0,
          indexFuturesLongShortRatio: indexFuturesLongShortSeries.get(date)!,
        }))
        .filter((item) => item.ashareAvgValuation > 0 && (item.indexFuturesLongShortRatio ?? 0) > 0);

      if (merged.length > 0) {
        setEmotionIndicatorDataSource('api');
        return merged;
      }
    }
  } catch (error) {
    console.warn('Failed to fetch emotion indicators from EastMoney', error);
  }

  setEmotionIndicatorDataSource('unknown');
  return [];
};
