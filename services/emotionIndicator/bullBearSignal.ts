import type { BullBearSignalSnapshot } from '../../types';
import { requestEastmoneyAction } from '../eastmoneyService';
import { loadLocalJsonFile } from '../localDataService';
import { getMarketVolumeTrendHistory } from '../sentimentCycleService';
import { setEmotionIndicatorDataSource } from './shared';

const isStStockName = (name: string) => /(^|\b)\*?ST\b/i.test(name.replace(/\s+/g, ''));

const fetchFullMarketRows = async (): Promise<any[]> => {
  return requestEastmoneyAction<any[]>('full_market_rows', {}, { metaKey: 'bull-bear:full-market-rows', preferSnapshot: true });
};

const normalizeSnapshotDate = (date: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (/^\d{2}-\d{2}$/.test(date)) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${date}`;
  }
  return date;
};

const fetchLimitPoolMeta = async (date: string, poolType: 'zt' | 'dt'): Promise<Array<{ symbol: string; name: string }>> => {
  const apiDate = date.replace(/-/g, '');
  try {
    const res = await requestEastmoneyAction<any>(
      poolType === 'zt' ? 'limit_up_pool' : 'limit_down_pool',
      { date },
      { metaKey: `bull-bear:${poolType}-pool:${date}`, preferSnapshot: true, timeout: 4000 },
    );
    const pool = res?.data?.pool;
    if (!Array.isArray(pool)) return [];
    return pool.map((item: any) => ({
      symbol: String(item?.c ?? ''),
      name: String(item?.n ?? ''),
    }));
  } catch {
    return [];
  }
};

export const getBullBearSignalSnapshot = async (): Promise<BullBearSignalSnapshot | null> => {
  const localHistory = await loadLocalJsonFile<BullBearSignalSnapshot[]>('bull_bear_signal.json');
  if (Array.isArray(localHistory) && localHistory.length > 0) {
    setEmotionIndicatorDataSource('local');
    return localHistory[localHistory.length - 1] ?? null;
  }

  try {
    const [rows, breadth, volumeHistory] = await Promise.all([
      fetchFullMarketRows(),
      requestEastmoneyAction<any>('market_breadth_overview', {}, { metaKey: 'bull-bear:breadth', preferSnapshot: true }),
      getMarketVolumeTrendHistory(),
    ]);

    if (rows.length === 0) return null;

    const latestDate = normalizeSnapshotDate(volumeHistory.at(-1)?.date ?? new Date().toISOString().slice(0, 10));
    const [limitUpPool, limitDownPool] = await Promise.all([
      fetchLimitPoolMeta(latestDate, 'zt'),
      fetchLimitPoolMeta(latestDate, 'dt'),
    ]);

    const limitUpSymbols = new Set(limitUpPool.map((item) => item.symbol));
    const limitDownSymbols = new Set(limitDownPool.map((item) => item.symbol));

    let riseCount = 0;
    let fallCount = 0;
    let flatCount = 0;
    let totalAmount = 0;
    let up5Count = 0;
    let up1Count = 0;
    let flatBandCount = 0;
    let down1Count = 0;
    let down5Count = 0;

    for (const row of rows) {
      const symbol = String(row?.f12 ?? '');
      const pct = Number(row?.f3);
      const amount = Number(row?.f6);
      if (Number.isFinite(amount) && amount > 0) {
        totalAmount += amount;
      }
      if (!Number.isFinite(pct)) continue;

      if (pct > 0) riseCount++;
      else if (pct < 0) fallCount++;
      else flatCount++;

      if (limitUpSymbols.has(symbol) || limitDownSymbols.has(symbol)) {
        continue;
      }

      if (pct >= 5) up5Count++;
      else if (pct >= 1) up1Count++;
      else if (pct > -1) flatBandCount++;
      else if (pct > -5) down1Count++;
      else down5Count++;
    }

    const breadthRows = Array.isArray(breadth?.data?.diff) ? breadth.data.diff : [];
    if (breadthRows.length > 0) {
      const totals = breadthRows.reduce(
        (acc: { rise: number; fall: number; flat: number }, item: any) => {
          acc.rise += Number(item?.f104) || 0;
          acc.fall += Number(item?.f105) || 0;
          acc.flat += Number(item?.f106) || 0;
          return acc;
        },
        { rise: 0, fall: 0, flat: 0 },
      );
      if (totals.rise + totals.fall + totals.flat > 0) {
        riseCount = totals.rise;
        fallCount = totals.fall;
        flatCount = totals.flat;
      }
    }

    const latestVolume = volumeHistory.at(-1) ?? null;
    const previousVolume = volumeHistory.length > 1 ? volumeHistory.at(-2) ?? null : null;
    const amountYi = latestVolume?.amount ?? Number((totalAmount / 100000000).toFixed(0));
    const amountChangeRate = latestVolume?.changeRate ?? (
      previousVolume && previousVolume.amount > 0
        ? Number((((amountYi - previousVolume.amount) / previousVolume.amount) * 100).toFixed(2))
        : null
    );

    const limitDownCount = limitDownPool.length > 0
      ? limitDownPool.length
      : rows.filter((row) => Number(row?.f3) <= -9.5).length;

    return {
      date: latestDate,
      riseCount,
      fallCount,
      flatCount,
      limitUpCount: limitUpPool.length,
      limitDownCount,
      naturalLimitUpCount: limitUpPool.filter((item) => !isStStockName(item.name)).length,
      naturalLimitDownCount: limitDownPool.length > 0
        ? limitDownPool.filter((item) => !isStStockName(item.name)).length
        : rows.filter((row) => Number(row?.f3) <= -9.5 && !isStStockName(String(row?.f14 ?? ''))).length,
      totalAmount: amountYi,
      amountChangeRate,
      rangeBuckets: [
        { label: '涨停', count: limitUpPool.length, tone: 'up' },
        { label: '涨停~5%', count: up5Count, tone: 'up' },
        { label: '5~1%', count: up1Count, tone: 'up' },
        { label: '平盘', count: flatBandCount, tone: 'flat' },
        { label: '0~-1%', count: down1Count, tone: 'down' },
        { label: '-1~-5%', count: down5Count, tone: 'down' },
        { label: '跌停', count: limitDownCount, tone: 'down' },
      ],
    };
  } catch (error) {
    console.warn('Failed to fetch bull bear signal snapshot from EastMoney', error);
    return null;
  }
};

export const getBullBearSignalHistory = async (): Promise<BullBearSignalSnapshot[]> => {
  const localHistory = await loadLocalJsonFile<BullBearSignalSnapshot[]>('bull_bear_signal.json');
  if (Array.isArray(localHistory) && localHistory.length > 0) {
    setEmotionIndicatorDataSource('local');
    return localHistory;
  }

  const latest = await getBullBearSignalSnapshot();
  return latest ? [latest] : [];
};
