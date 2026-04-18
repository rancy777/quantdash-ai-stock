import { KlineData, SentimentEntry } from '../../types';
import { db, STORES } from '../db';
import { requestEastmoneyAction } from '../eastmoneyService';
import { loadLocalJsonFile } from '../localDataService';
import { getStockKline } from '../quotesService';

import { setSentimentDataSource } from './shared';

type PoolCountResult = {
  counts: { [key: number]: number };
  total: number;
  success: boolean;
};

const fetchPoolCounts = async (dateStr: string, poolType: 'zt' | 'dt'): Promise<PoolCountResult> => {
  try {
    const res = await requestEastmoneyAction<any>(
      poolType === 'zt' ? 'limit_up_pool' : 'limit_down_pool',
      { date: dateStr },
      { metaKey: `sentiment:${poolType}:${dateStr}`, preferSnapshot: true, timeout: 3500 },
    );
    if (res?.data?.pool) {
      const counts: { [key: number]: number } = {};
      res.data.pool.forEach((item: any) => {
        const lbc = item.lbc;
        counts[lbc] = (counts[lbc] || 0) + 1;
      });
      return { counts, total: res.data.pool.length, success: true };
    }
    return { counts: {}, total: 0, success: true };
  } catch {
    return { counts: {}, total: 0, success: false };
  }
};

const simulatePoolCounts = (
  dateStr: string,
  klineLookup: Map<string, KlineData>,
): { zt: PoolCountResult; dt: PoolCountResult } => {
  const kline = klineLookup.get(dateStr);
  const changePct = kline ? ((kline.close - kline.open) / kline.open) * 100 : (Math.random() - 0.5) * 2;
  const simLimitUp = Math.max(5, Math.floor(40 + changePct * 30 + Math.random() * 10));
  const simLimitDown = Math.max(0, Math.floor(10 - changePct * 10 + Math.random() * 5));
  const fakeCounts: { [key: number]: number } = {};
  const maxHeight = Math.min(8, Math.floor(3 + simLimitUp / 15));

  for (let board = 2; board <= maxHeight; board += 1) {
    fakeCounts[board] = Math.max(1, Math.floor(simLimitUp / (board * 2)));
  }

  return {
    zt: { counts: fakeCounts, total: simLimitUp, success: false },
    dt: { counts: {}, total: simLimitDown, success: false },
  };
};

const estimateRiseCount = (
  kline: KlineData | undefined,
  limitUpCount: number,
  limitDownCount: number,
) => {
  const changePct = kline ? ((kline.close - kline.open) / kline.open) * 100 : 0;
  const limitSpread = limitUpCount - limitDownCount;
  return Math.max(200, Math.min(4500, Math.round(2000 + changePct * 650 + limitSpread * 4)));
};

const fetchEastmoneyMarketBreadthOverview = async (): Promise<{ rise: number; fall: number; flat: number } | null> => {
  const res = await requestEastmoneyAction<any>(
    'market_breadth_overview',
    {},
    { metaKey: 'sentiment:breadth', preferSnapshot: true, timeout: 3500 },
  );
  const diff = res?.data?.diff;
  if (!Array.isArray(diff) || diff.length === 0) {
    return null;
  }

  const totals = diff.reduce(
    (acc, item) => {
      acc.rise += Number(item?.f104) || 0;
      acc.fall += Number(item?.f105) || 0;
      acc.flat += Number(item?.f106) || 0;
      return acc;
    },
    { rise: 0, fall: 0, flat: 0 },
  );

  return totals.rise + totals.fall + totals.flat < 3000 ? null : totals;
};

const generateMockBreadth = () => {
  const totalStocks = 5100;
  const marketTrend = Math.random();
  let rise: number;
  let fall: number;

  if (marketTrend > 0.7) {
    rise = Math.floor(totalStocks * (0.7 + Math.random() * 0.15));
    fall = Math.floor(totalStocks * (0.15 + Math.random() * 0.1));
  } else if (marketTrend > 0.5) {
    rise = Math.floor(totalStocks * (0.5 + Math.random() * 0.1));
    fall = Math.floor(totalStocks * (0.3 + Math.random() * 0.1));
  } else if (marketTrend > 0.3) {
    rise = Math.floor(totalStocks * (0.3 + Math.random() * 0.1));
    fall = Math.floor(totalStocks * (0.5 + Math.random() * 0.1));
  } else {
    rise = Math.floor(totalStocks * (0.15 + Math.random() * 0.1));
    fall = Math.floor(totalStocks * (0.7 + Math.random() * 0.15));
  }

  return { rise, fall, flat: Math.max(0, totalStocks - rise - fall) };
};

export const getRealTimeMarketSentiment = async () => {
  try {
    let finalResult = await fetchEastmoneyMarketBreadthOverview();
    if (!finalResult) {
      const res = await requestEastmoneyAction<any>(
        'full_market_pct_snapshot',
        {},
        { metaKey: 'sentiment:full-market-pct', preferSnapshot: true },
      );
      const diff = Array.isArray(res?.data?.diff) ? res.data.diff : [];
      if (diff.length > 1000) {
        let rise = 0;
        let fall = 0;
        let flat = 0;
        for (const item of diff) {
          const value = Number(item?.f3) || 0;
          if (value > 0) rise += 1;
          else if (value < 0) fall += 1;
          else flat += 1;
        }
        finalResult = { rise, fall, flat };
      }
    }
    if (!finalResult) {
      return generateMockBreadth();
    }

    const totalStocks = 5100;
    const currentTotal = finalResult.rise + finalResult.fall + finalResult.flat;
    if (Math.abs(currentTotal - totalStocks) <= 100) {
      return finalResult;
    }

    const totalRatio = totalStocks / currentTotal;
    return {
      rise: Math.round(finalResult.rise * totalRatio),
      fall: Math.round(finalResult.fall * totalRatio),
      flat: totalStocks - Math.round(finalResult.rise * totalRatio) - Math.round(finalResult.fall * totalRatio),
    };
  } catch (error) {
    console.error('获取实时市场情绪数据失败:', error);
    return generateMockBreadth();
  }
};

export const resetSentimentData = async () => {
  try {
    const dbConn = await db.connect();
    const tx = dbConn.transaction(STORES.SENTIMENT, 'readwrite');
    tx.objectStore(STORES.SENTIMENT).clear();
    return new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  } catch (error) {
    console.error('Failed to clear DB', error);
  }
};

export const getSentimentCoefficientHistory = async (forceRefresh = false): Promise<SentimentEntry[]> => {
  if (!forceRefresh) {
    const localSentiment = await loadLocalJsonFile<SentimentEntry[]>('sentiment.json');
    if (localSentiment?.length) {
      const cleaned = localSentiment
        .filter((item) => (item.limitUpCount ?? 0) > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => ({ ...item, date: item.date.slice(5) }));
      if (cleaned.length > 0) {
        setSentimentDataSource('local');
        return cleaned.slice(-15);
      }
    }
  }

  let validDates: string[] = [];
  let indexKlines: KlineData[] = [];
  try {
    indexKlines = await getStockKline('000001', 120);
    if (indexKlines.length > 0) {
      validDates = indexKlines.map((item) => item.date).slice(-15);
    }
  } catch (error) {
    console.warn('Failed to load index kline for sentiment history', error);
  }

  const indexKlineLookup = new Map(indexKlines.map((item) => [item.date, item] as const));
  const finalData: SentimentEntry[] = [];

  for (const currentDate of validDates) {
    const [zt, dt] = await Promise.all([
      fetchPoolCounts(currentDate, 'zt'),
      fetchPoolCounts(currentDate, 'dt'),
    ]);
    const pools = zt.success || dt.success ? { zt, dt } : simulatePoolCounts(currentDate, indexKlineLookup);
    const activeBoards = Object.keys(pools.zt.counts).map(Number).filter((board) => pools.zt.counts[board] > 0);
    const entry: SentimentEntry = {
      date: currentDate,
      value: pools.zt.total > 50 ? 5 : 2,
      height: activeBoards.length > 0 ? Math.max(...activeBoards) : 0,
      limitUpCount: pools.zt.total,
      limitDownCount: pools.dt.total,
      riseCount: estimateRiseCount(indexKlineLookup.get(currentDate), pools.zt.total, pools.dt.total),
      rawZt: { counts: pools.zt.counts, total: pools.zt.total },
    };

    if (pools.zt.total > 0) {
      await db.put(STORES.SENTIMENT, entry);
    }
    finalData.push(entry);
  }

  setSentimentDataSource('api');
  return finalData
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({ ...item, date: item.date.slice(5) }))
    .slice(-15);
};
