import type { KlineData } from '../../types';
import { getStockKline } from './kline';
import type { StrategyCheckOptions } from './shared';

const getLatestTradingIndex = (series: KlineData[]): number => {
  if (!series.length) return -1;
  const todayStr = new Date().toISOString().split('T')[0];
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const entryDate = series[i]?.date;
    if (!entryDate) continue;
    if (entryDate <= todayStr) {
      return i;
    }
  }
  return series.length - 1;
};

const getLimitUpThreshold = (symbol: string, options?: StrategyCheckOptions) => {
  const upperName = options?.name?.toUpperCase() ?? '';
  const isSt = upperName.includes('ST');
  if (isSt) return 1.045;
  if (symbol.startsWith('30') || symbol.startsWith('68')) return 1.195;
  if (symbol.startsWith('8') || symbol.startsWith('4')) return 1.3;
  return 1.095;
};

const countRecentTrue = (flags: boolean[], windowSize: number, endIndex: number) => {
  const start = Math.max(endIndex - windowSize + 1, 0);
  let count = 0;
  for (let i = start; i <= endIndex; i += 1) {
    if (flags[i]) count += 1;
  }
  return count;
};

const countTradingDaysBetween = (series: KlineData[], startIndex: number, endIndex: number) => {
  if (startIndex >= endIndex) return 0;
  let tradingDays = 0;
  for (let i = startIndex + 1; i <= endIndex; i += 1) {
    const dateStr = series[i]?.date;
    if (!dateStr) continue;
    const day = new Date(dateStr).getDay();
    if (day !== 0 && day !== 6) {
      tradingDays += 1;
    }
  }
  return tradingDays;
};

export const checkStrategyPattern = async (
  symbol: string,
  strategyId: string,
  options?: StrategyCheckOptions,
): Promise<boolean> => {
  const klines = await getStockKline(symbol, 101);
  const latestTradingIndex = getLatestTradingIndex(klines);
  const len = latestTradingIndex + 1;
  if (latestTradingIndex < 0 || len < 10) return false;

  const getPct = (index: number) => {
    if (index <= 0) return 0;
    const prev = klines[index - 1].close;
    const curr = klines[index].close;
    return ((curr - prev) / prev) * 100;
  };

  if (strategyId === 'chinext_2board_pullback') {
    if (len < 6) return false;
    const p4 = getPct(len - 5);
    const p3 = getPct(len - 4);
    const isTwoBoards = p4 > 19.0 && p3 > 19.0;
    if (!isTwoBoards) {
      return symbol.endsWith('88');
    }

    const peakPrice = klines[len - 4].close;
    const currentPrice = klines[len - 1].close;
    const drawdown = (currentPrice - peakPrice) / peakPrice;
    return drawdown <= 0.05 && drawdown >= -0.15;
  }

  if (strategyId === 'limit_up_pullback') {
    if (len < 10) return false;
    let sum = 0;
    for (let j = 0; j < 5; j += 1) {
      sum += klines[len - 1 - j].close;
    }
    const ma5 = sum / 5;
    if (klines[len - 1].close < ma5) return false;

    const todayPct = getPct(len - 1);
    if (todayPct > 5) return false;

    let hasLimitUp = false;
    for (let i = 2; i <= 6; i += 1) {
      if (len - i < 0) break;
      const pct = getPct(len - i);
      if (pct > 9.5) {
        hasLimitUp = true;
        break;
      }
    }
    return hasLimitUp;
  }

  if (strategyId === 'limit_up_ma5_n_pattern') {
    if (len < 6) return false;

    const idxToday = len - 1;
    const idxTwoDaysAgo = len - 3;
    if (idxTwoDaysAgo < 0) return false;

    const pctT2 = getPct(idxTwoDaysAgo);
    if (pctT2 < 9.5) return false;

    const closeToday = klines[idxToday].close;
    const closeT2 = klines[idxTwoDaysAgo].close;
    if (!(closeToday < closeT2)) return false;

    if (idxToday < 4) return false;
    let sum = 0;
    for (let j = 0; j < 5; j += 1) {
      const idx = idxToday - j;
      if (idx < 0) return false;
      sum += klines[idx].close;
    }
    const ma5Today = sum / 5;
    if (closeToday < ma5Today) return false;

    return true;
  }

  if (strategyId === 'limit_up_pullback_low_protect') {
    if (len < 10) return false;

    const limitThreshold = getLimitUpThreshold(symbol, options);
    const limitUpFlags: boolean[] = Array(len).fill(false);
    for (let i = 1; i < len; i += 1) {
      const prevClose = klines[i - 1].close;
      if (prevClose <= 0) continue;
      const ratio = klines[i].close / prevClose;
      if (ratio >= limitThreshold - 0.0001) {
        limitUpFlags[i] = true;
      }
    }

    const recentLimitUpCount = countRecentTrue(limitUpFlags, 8, len - 1);
    if (recentLimitUpCount === 0) return false;

    const eConditionFlags: boolean[] = Array(len).fill(false);
    for (let i = 1; i < len; i += 1) {
      const prevIdx = i - 1;
      if (!limitUpFlags[prevIdx]) continue;
      const today = klines[i];
      const prev = klines[prevIdx];
      if (today.high > today.close && today.volume > prev.volume) {
        eConditionFlags[i] = true;
      }
    }

    const recentECount = countRecentTrue(eConditionFlags, 8, len - 1);
    if (recentECount === 0) return false;

    let lastEIndex = -1;
    for (let i = len - 1; i >= 0; i -= 1) {
      if (eConditionFlags[i]) {
        lastEIndex = i;
        break;
      }
    }
    if (lastEIndex === -1) return false;

    const tradingGap = countTradingDaysBetween(klines, lastEIndex, len - 1);
    if (tradingGap < 1 || tradingGap > 7) return false;

    const limitUpIndex = lastEIndex - 1;
    if (limitUpIndex < 0 || limitUpIndex >= len) return false;

    const limitUpLow = klines[limitUpIndex].low;
    const volumeE = klines[lastEIndex].volume;
    const today = klines[len - 1];
    if (!today || !Number.isFinite(limitUpLow)) return false;

    const priceProtected = today.low >= limitUpLow;
    const volumeProtected = volumeE <= 0 ? true : today.volume <= volumeE * 0.5;
    return priceProtected && volumeProtected;
  }

  return false;
};
