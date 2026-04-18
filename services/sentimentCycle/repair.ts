import type { RepairRateEntry } from '../../types';
import { fetchBrokenPool } from '../limitUpPoolService';
import { getSingleDayCloseChange } from '../quotesService';
import {
  getRecentTradingDates,
  getRepairDataSource,
  loadLocalSnapshot,
  setRepairDataSource,
} from './shared';

const REPAIR_CACHE: { data: RepairRateEntry[]; timestamp: number } = { data: [], timestamp: 0 };

export const getRepairRateHistory = async (forceRefresh = false): Promise<RepairRateEntry[]> => {
  if (!forceRefresh) {
    const localSnapshot = await loadLocalSnapshot<RepairRateEntry[]>('repair_rate.json');
    if (localSnapshot && localSnapshot.length > 0) {
      REPAIR_CACHE.data = localSnapshot;
      REPAIR_CACHE.timestamp = Date.now();
      setRepairDataSource('local');
      return localSnapshot;
    }
  }

  if (!forceRefresh && REPAIR_CACHE.data.length > 0 && Date.now() - REPAIR_CACHE.timestamp < 30 * 60 * 1000) {
    if (getRepairDataSource() === 'unknown') {
      setRepairDataSource('api');
    }
    return REPAIR_CACHE.data;
  }

  const tradingDates = await getRecentTradingDates(12);
  const entries: RepairRateEntry[] = [];

  for (let i = 0; i < tradingDates.length - 1; i += 1) {
    const currentDate = tradingDates[i];
    const nextDate = tradingDates[i + 1];
    const brokenPool = await fetchBrokenPool(currentDate);

    if (brokenPool.length === 0) {
      entries.push({
        date: currentDate.slice(5),
        brokenCount: 0,
        brokenRepairCount: 0,
        brokenRepairRate: 0,
        bigFaceCount: 0,
        bigFaceRepairCount: 0,
        bigFaceRepairRate: 0,
      });
      continue;
    }

    let brokenRepairCount = 0;
    let bigFaceCount = 0;
    let bigFaceRepairCount = 0;
    for (const stock of brokenPool) {
      const nextChange = await getSingleDayCloseChange(stock.symbol, nextDate);
      const repaired = nextChange !== null && nextChange > 0;
      if (repaired) brokenRepairCount += 1;
      if (stock.pctChange <= -5) {
        bigFaceCount += 1;
        if (repaired) bigFaceRepairCount += 1;
      }
    }

    entries.push({
      date: currentDate.slice(5),
      brokenCount: brokenPool.length,
      brokenRepairCount,
      brokenRepairRate: brokenPool.length > 0 ? Number(((brokenRepairCount / brokenPool.length) * 100).toFixed(1)) : 0,
      bigFaceCount,
      bigFaceRepairCount,
      bigFaceRepairRate: bigFaceCount > 0 ? Number(((bigFaceRepairCount / bigFaceCount) * 100).toFixed(1)) : 0,
    });
  }

  const trimmed = entries.slice(-12);
  REPAIR_CACHE.data = trimmed;
  REPAIR_CACHE.timestamp = Date.now();
  setRepairDataSource('api');
  return trimmed;
};
