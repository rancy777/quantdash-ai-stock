import type { HighRiskEntry } from '../../types';
import { fetchBrokenPool, fetchLimitUpPool } from '../limitUpPoolService';
import { getSingleDayCloseChange } from '../quotesService';
import { getRecentTradingDates, loadLocalSnapshot } from './shared';

export const getHighRiskHistory = async (): Promise<HighRiskEntry[]> => {
  const localSnapshot = await loadLocalSnapshot<HighRiskEntry[]>('high_risk.json');
  if (localSnapshot && localSnapshot.length > 0) {
    return localSnapshot;
  }

  const tradingDates = await getRecentTradingDates(8);
  const entries: HighRiskEntry[] = [];

  for (let i = 0; i < tradingDates.length - 1; i += 1) {
    const currentDate = tradingDates[i];
    const nextDate = tradingDates[i + 1];
    const todayPool = await fetchLimitUpPool(currentDate);
    const brokenPool = await fetchBrokenPool(currentDate);
    const highBoardPool = todayPool.filter((item) => (item.boardCount || 0) >= 4);

    let aKillCount = 0;
    let weakCount = 0;
    for (const stock of highBoardPool) {
      const nextChange = await getSingleDayCloseChange(stock.symbol, nextDate);
      if (nextChange === null) continue;
      if (nextChange <= -8) aKillCount += 1;
      if (nextChange < 0) weakCount += 1;
    }

    const brokenCount = brokenPool.length;
    const brokenRate = todayPool.length > 0 ? Number(((brokenCount / todayPool.length) * 100).toFixed(1)) : 0;
    const riskLevel: HighRiskEntry['riskLevel'] =
      aKillCount >= 2 || brokenRate >= 35
        ? 'high'
        : aKillCount >= 1 || brokenRate >= 20 || weakCount >= 2
          ? 'medium'
          : 'low';

    entries.push({
      date: currentDate.slice(5),
      highBoardCount: highBoardPool.length,
      aKillCount,
      weakCount,
      brokenCount,
      brokenRate,
      riskLevel,
    });
  }

  return entries.slice(-6);
};
