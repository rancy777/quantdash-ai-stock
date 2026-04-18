import type { LeaderStateEntry } from '../../types';
import { fetchLimitUpPool } from '../limitUpPoolService';
import { getSingleDayPerformance } from '../quotesService';
import {
  getLeaderDataSource,
  getRecentTradingDates,
  loadLocalSnapshot,
  setLeaderDataSource,
} from './shared';

const LEADER_CACHE: { data: LeaderStateEntry[]; timestamp: number } = { data: [], timestamp: 0 };

const getLeaderStatusLabel = (params: {
  isOneWord: boolean;
  continued: boolean;
  nextClosePct: number | null;
  leaderCount: number;
  leaderBoardCount: number;
}): string => {
  const { isOneWord, continued, nextClosePct, leaderCount, leaderBoardCount } = params;
  if (nextClosePct === null) {
    if (leaderCount >= 2 && leaderBoardCount >= 4) return '高标抱团';
    if (isOneWord) return '一字观察';
    return '待次日确认';
  }
  if (isOneWord && continued) return '一字加速';
  if (continued && nextClosePct >= 0) return '强势晋级';
  if (nextClosePct >= 3) return '断板承接';
  if (nextClosePct >= 0) return '高位分歧';
  if (nextClosePct > -5) return '分歧转弱';
  return '退潮承压';
};

export const getLeaderStateHistory = async (forceRefresh = false): Promise<LeaderStateEntry[]> => {
  if (!forceRefresh) {
    const localSnapshot = await loadLocalSnapshot<LeaderStateEntry[]>('leader_state.json');
    if (localSnapshot && localSnapshot.length > 0) {
      LEADER_CACHE.data = localSnapshot;
      LEADER_CACHE.timestamp = Date.now();
      setLeaderDataSource('local');
      return localSnapshot;
    }
  }

  if (!forceRefresh && LEADER_CACHE.data.length > 0 && Date.now() - LEADER_CACHE.timestamp < 30 * 60 * 1000) {
    if (getLeaderDataSource() === 'unknown') {
      setLeaderDataSource('api');
    }
    return LEADER_CACHE.data;
  }

  const tradingDates = await getRecentTradingDates(12);
  const entries: LeaderStateEntry[] = [];

  for (let i = 0; i < tradingDates.length; i += 1) {
    const currentDate = tradingDates[i];
    const nextDate = i < tradingDates.length - 1 ? tradingDates[i + 1] : null;
    const todayPool = await fetchLimitUpPool(currentDate);
    if (todayPool.length === 0) continue;

    const leaderBoardCount = todayPool.reduce((max, item) => Math.max(max, item.boardCount || 0), 0);
    const leaders = todayPool.filter((item) => (item.boardCount || 0) === leaderBoardCount);
    const leader = [...leaders].sort((a, b) => (a.limitUpTime ?? '99:99:99').localeCompare(b.limitUpTime ?? '99:99:99'))[0] ?? leaders[0];
    const secondHighestBoard = todayPool
      .filter((item) => (item.boardCount || 0) < leaderBoardCount)
      .reduce((max, item) => Math.max(max, item.boardCount || 0), 0);
    const threePlusCount = todayPool.filter((item) => (item.boardCount || 0) >= 3).length;

    let continuedCount = 0;
    let nextOpenPct: number | null = null;
    let nextClosePct: number | null = null;

    if (nextDate) {
      const nextPool = await fetchLimitUpPool(nextDate);
      const nextBoardMap = new Map<string, number>();
      nextPool.forEach((item) => nextBoardMap.set(item.symbol, item.boardCount || 0));
      continuedCount = leaders.filter((item) => (nextBoardMap.get(item.symbol) ?? 0) > leaderBoardCount).length;
      const nextPerformance = await getSingleDayPerformance(leader.symbol, nextDate);
      nextOpenPct = nextPerformance?.openPct ?? null;
      nextClosePct = nextPerformance?.closePct ?? null;
    }

    const leaderPerformance = await getSingleDayPerformance(leader.symbol, currentDate);
    const isOneWord = leaderPerformance?.isOneWord ?? false;

    entries.push({
      date: currentDate.slice(5),
      leaderSymbol: leader.symbol,
      leaderName: leader.name,
      leaderBoardCount,
      leaderCount: leaders.length,
      secondHighestBoard,
      threePlusCount,
      continuedCount,
      nextOpenPct,
      nextClosePct,
      isOneWord,
      statusLabel: getLeaderStatusLabel({
        isOneWord,
        continued: continuedCount > 0,
        nextClosePct,
        leaderCount: leaders.length,
        leaderBoardCount,
      }),
    });
  }

  const trimmed = entries.slice(-12);
  LEADER_CACHE.data = trimmed;
  LEADER_CACHE.timestamp = Date.now();
  setLeaderDataSource('api');
  return trimmed;
};
