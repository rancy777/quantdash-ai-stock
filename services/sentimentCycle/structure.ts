import type { LimitUpStructureEntry, SentimentEntry } from '../../types';
import type { LimitUpStock } from '../limitUpPoolService';
import { fetchLimitUpPool } from '../limitUpPoolService';
import { loadLocalJsonFile } from '../localDataService';
import {
  getRecentTradingDates,
  getStructureDataSource,
  loadLocalSnapshot,
  setStructureDataSource,
} from './shared';

const LIMIT_UP_STRUCTURE_CACHE: { data: LimitUpStructureEntry[]; timestamp: number } = { data: [], timestamp: 0 };

const buildStructureEntryFromPool = (dateStr: string, pool: LimitUpStock[]): LimitUpStructureEntry => {
  let firstBoardCount = 0;
  let secondBoardCount = 0;
  let thirdBoardCount = 0;
  let highBoardCount = 0;

  for (const item of pool) {
    const board = item.boardCount || 0;
    if (board <= 1) firstBoardCount += 1;
    else if (board === 2) secondBoardCount += 1;
    else if (board === 3) thirdBoardCount += 1;
    else highBoardCount += 1;
  }

  const totalLimitUpCount = pool.length;
  const relayCount = Math.max(totalLimitUpCount - firstBoardCount, 0);
  const firstBoardRatio = totalLimitUpCount > 0 ? Number(((firstBoardCount / totalLimitUpCount) * 100).toFixed(1)) : 0;
  const highBoardRatio = totalLimitUpCount > 0 ? Number(((highBoardCount / totalLimitUpCount) * 100).toFixed(1)) : 0;

  return {
    date: dateStr.slice(5),
    firstBoardCount,
    secondBoardCount,
    thirdBoardCount,
    highBoardCount,
    totalLimitUpCount,
    firstBoardRatio,
    relayCount,
    highBoardRatio,
  };
};

const buildStructureEntriesFromSentiment = (items: SentimentEntry[]): LimitUpStructureEntry[] =>
  items
    .filter((item) => item.rawZt?.counts && (item.limitUpCount ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => {
      const counts = item.rawZt?.counts ?? {};
      const totalLimitUpCount = item.limitUpCount ?? 0;
      const firstBoardCount = counts[1] ?? 0;
      const secondBoardCount = counts[2] ?? 0;
      const thirdBoardCount = counts[3] ?? 0;
      const highBoardCount = Object.entries(counts).reduce((sum, [board, count]) => Number(board) >= 4 ? sum + count : sum, 0);
      const relayCount = Math.max(totalLimitUpCount - firstBoardCount, 0);

      return {
        date: item.date.slice(5),
        firstBoardCount,
        secondBoardCount,
        thirdBoardCount,
        highBoardCount,
        totalLimitUpCount,
        firstBoardRatio: totalLimitUpCount > 0 ? Number(((firstBoardCount / totalLimitUpCount) * 100).toFixed(1)) : 0,
        relayCount,
        highBoardRatio: totalLimitUpCount > 0 ? Number(((highBoardCount / totalLimitUpCount) * 100).toFixed(1)) : 0,
      };
    });

export const getLimitUpStructureHistory = async (forceRefresh = false): Promise<LimitUpStructureEntry[]> => {
  if (!forceRefresh) {
    const localSnapshot = await loadLocalSnapshot<LimitUpStructureEntry[]>('limit_up_structure.json');
    if (localSnapshot && localSnapshot.length > 0) {
      LIMIT_UP_STRUCTURE_CACHE.data = localSnapshot;
      LIMIT_UP_STRUCTURE_CACHE.timestamp = Date.now();
      setStructureDataSource('local');
      return localSnapshot;
    }

    const localSentiment = await loadLocalJsonFile<SentimentEntry[]>('sentiment.json');
    if (localSentiment && localSentiment.length > 0) {
      const localStructure = buildStructureEntriesFromSentiment(localSentiment).slice(-12);
      if (localStructure.length > 0) {
        LIMIT_UP_STRUCTURE_CACHE.data = localStructure;
        LIMIT_UP_STRUCTURE_CACHE.timestamp = Date.now();
        setStructureDataSource('local');
        return localStructure;
      }
    }
  }

  if (!forceRefresh && LIMIT_UP_STRUCTURE_CACHE.data.length > 0 && Date.now() - LIMIT_UP_STRUCTURE_CACHE.timestamp < 30 * 60 * 1000) {
    if (getStructureDataSource() === 'unknown') {
      setStructureDataSource('api');
    }
    return LIMIT_UP_STRUCTURE_CACHE.data;
  }

  const tradingDates = await getRecentTradingDates(12);
  const entries: LimitUpStructureEntry[] = [];
  for (const currentDate of tradingDates) {
    const todayPool = await fetchLimitUpPool(currentDate);
    if (todayPool.length > 0) {
      entries.push(buildStructureEntryFromPool(currentDate, todayPool));
    }
  }

  const trimmed = entries.slice(-12);
  LIMIT_UP_STRUCTURE_CACHE.data = trimmed;
  LIMIT_UP_STRUCTURE_CACHE.timestamp = Date.now();
  setStructureDataSource('api');
  return trimmed;
};
