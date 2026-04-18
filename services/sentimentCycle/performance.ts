import { fetchLimitUpPool } from '../limitUpPoolService';
import { loadLocalJsonFile } from '../localDataService';
import {
  getPerformanceDataSource,
  getRecentTradingDates,
  setPerformanceDataSource,
} from './shared';

export interface LimitUpPremiumEntry {
  date: string;
  premium: number;
  successRate: number;
  limitUpCount: number;
  followThroughCount: number;
}

interface LimitUpPerformanceEntry {
  date: string;
  limitUpCount: number;
  followThroughCount: number;
  brokenCount: number;
  successRate: number;
  avgBoardGain: number;
}

export interface BrokenRateEntry {
  date: string;
  brokenRate: number;
  brokenCount: number;
  limitUpCount: number;
}

const PERFORMANCE_CACHE: { data: LimitUpPerformanceEntry[]; timestamp: number } = { data: [], timestamp: 0 };

const getLimitUpPerformanceHistory = async (forceRefresh = false): Promise<LimitUpPerformanceEntry[]> => {
  if (!forceRefresh) {
    const localPerformance = await loadLocalJsonFile<LimitUpPerformanceEntry[]>('performance.json');
    if (localPerformance && localPerformance.length > 0) {
      PERFORMANCE_CACHE.data = localPerformance;
      PERFORMANCE_CACHE.timestamp = Date.now();
      setPerformanceDataSource('local');
      return localPerformance;
    }
  }

  if (!forceRefresh && PERFORMANCE_CACHE.data.length > 0 && Date.now() - PERFORMANCE_CACHE.timestamp < 30 * 60 * 1000) {
    if (getPerformanceDataSource() === 'unknown') {
      setPerformanceDataSource('api');
    }
    return PERFORMANCE_CACHE.data;
  }

  const tradingDates = await getRecentTradingDates(16);
  const results: LimitUpPerformanceEntry[] = [];

  for (let i = 0; i < tradingDates.length - 1; i += 1) {
    const currentDate = tradingDates[i];
    const nextDate = tradingDates[i + 1];
    const todayPool = await fetchLimitUpPool(currentDate);
    const nextPool = await fetchLimitUpPool(nextDate);
    const limitUpCount = todayPool.length;

    if (limitUpCount === 0) {
      results.push({
        date: currentDate.slice(5),
        limitUpCount: 0,
        followThroughCount: 0,
        brokenCount: 0,
        successRate: 0,
        avgBoardGain: 0,
      });
      continue;
    }

    const nextMap = new Map<string, number>();
    nextPool.forEach((item) => nextMap.set(item.symbol, item.boardCount));

    let followThrough = 0;
    let boardGain = 0;
    for (const stock of todayPool) {
      const nextBoard = nextMap.get(stock.symbol);
      if (nextBoard && nextBoard > stock.boardCount) {
        followThrough += 1;
        boardGain += Math.min(nextBoard - stock.boardCount, 3);
      }
    }

    const successRate = followThrough / limitUpCount;
    const brokenCount = Math.max(limitUpCount - followThrough, 0);
    const avgBoardGain = limitUpCount > 0 ? boardGain / limitUpCount : 0;

    results.push({
      date: currentDate.slice(5),
      limitUpCount,
      followThroughCount: followThrough,
      brokenCount,
      successRate,
      avgBoardGain,
    });
  }

  const trimmed = results.slice(-12);
  PERFORMANCE_CACHE.data = trimmed;
  PERFORMANCE_CACHE.timestamp = Date.now();
  setPerformanceDataSource('api');
  return trimmed;
};

export const getLimitUpPremiumHistory = async (forceRefresh = false): Promise<LimitUpPremiumEntry[]> => {
  const performance = await getLimitUpPerformanceHistory(forceRefresh);
  return performance.map((item) => ({
    date: item.date,
    premium: Number((item.successRate * 60 + item.avgBoardGain * 10).toFixed(2)),
    successRate: Number((item.successRate * 100).toFixed(1)),
    limitUpCount: item.limitUpCount,
    followThroughCount: item.followThroughCount,
  }));
};

export const getBrokenRateHistory = async (forceRefresh = false): Promise<BrokenRateEntry[]> => {
  const performance = await getLimitUpPerformanceHistory(forceRefresh);
  return performance.map((item) => ({
    date: item.date,
    brokenRate: Number(((1 - item.successRate) * 100).toFixed(1)),
    brokenCount: item.brokenCount,
    limitUpCount: item.limitUpCount,
  }));
};
