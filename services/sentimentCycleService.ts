import { CycleOverviewData, SentimentEntry } from '../types';
import { getSingleDayCloseChange } from './quotesService';
import { getBoardHeightHistory } from './sentimentCycle/boardHeight';
import { getHighRiskHistory } from './sentimentCycle/highRisk';
import { getLeaderStateHistory } from './sentimentCycle/leader';
import { getMarketVolumeTrendHistory } from './sentimentCycle/marketVolume';
import { getCycleOverview } from './sentimentCycle/overview';
import {
  getBrokenRateHistory,
  getLimitUpPremiumHistory,
} from './sentimentCycle/performance';
import { getRepairRateHistory } from './sentimentCycle/repair';
import {
  getBoardHeightDataSource,
  getBoardHeightUpdatedAt,
  getLeaderDataSource,
  getLeaderUpdatedAt,
  getPerformanceDataSource,
  getPerformanceUpdatedAt,
  getRepairDataSource,
  getRepairUpdatedAt,
  getSentimentDataSource,
  getSentimentUpdatedAt,
  getStructureDataSource,
  getStructureUpdatedAt,
} from './sentimentCycle/shared';
import {
  getRealTimeMarketSentiment,
  getSentimentCoefficientHistory,
  resetSentimentData,
} from './sentimentCycle/sentiment';
import { getLimitUpStructureHistory } from './sentimentCycle/structure';

export {
  getBoardHeightDataSource,
  getBoardHeightUpdatedAt,
  getLeaderDataSource,
  getLeaderUpdatedAt,
  getPerformanceDataSource,
  getPerformanceUpdatedAt,
  getRepairDataSource,
  getRepairUpdatedAt,
  getSentimentDataSource,
  getSentimentUpdatedAt,
  getStructureDataSource,
  getStructureUpdatedAt,
};
export {
  getBoardHeightHistory,
  getBrokenRateHistory,
  getCycleOverview,
  getHighRiskHistory,
  getLeaderStateHistory,
  getLimitUpPremiumHistory,
  getLimitUpStructureHistory,
  getMarketVolumeTrendHistory,
  getRealTimeMarketSentiment,
  getRepairRateHistory,
  getSentimentCoefficientHistory,
  resetSentimentData,
};
export type { BrokenRateEntry, LimitUpPremiumEntry } from './sentimentCycle/performance';

export const getSentimentHistoryWithDailyChange = async (forceRefresh = false): Promise<(SentimentEntry & {
  dailyChange: number | null;
})[]> => {
  const history = await getSentimentCoefficientHistory(forceRefresh);
  return Promise.all(
    history.map(async (entry) => ({
      ...entry,
      dailyChange: await getSingleDayCloseChange('000001', entry.date),
    })),
  );
};

export type { CycleOverviewData, SentimentEntry };
