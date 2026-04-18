import type { KlineData } from '../../types';
import { requestEastmoneyAction, setDataFreshnessMeta } from '../eastmoneyService';
import { getSecidForSymbol, loadLocalKlineSeries, MAJOR_INDEX_SECID_MAP } from './shared';

const KLINE_CACHE = new Map<string, KlineData[]>();

const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

const generateMockKlines = (symbol: string, _period: number, limit: number = 200): KlineData[] => {
  const data: KlineData[] = [];
  const now = new Date();

  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let price = 10 + (seed % 100);

  for (let i = limit; i > 0; i -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const dateStr = date.toISOString().split('T')[0];
    const volatility = 0.03;
    const changePercent = (seededRandom(seed + i) - 0.5) * 2 * volatility;
    const change = price * changePercent;

    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + price * (seededRandom(seed + i * 2) * 0.02);
    const low = Math.min(open, close) - price * (seededRandom(seed + i * 3) * 0.02);
    const volume = Math.floor(seededRandom(seed + i * 4) * 1000000) + 50000;

    data.push({ date: dateStr, open, close, high, low, volume });
    price = close;
  }

  return data;
};

const findTargetKlineIndex = (klines: KlineData[], targetDate: string): number => {
  for (let i = klines.length - 1; i >= 0; i -= 1) {
    const entryDate = klines[i]?.date;
    if (!entryDate) continue;
    if (entryDate <= targetDate) {
      return i;
    }
  }
  return -1;
};

export const getStockKline = async (symbol: string, period: number = 101): Promise<KlineData[]> => {
  const cacheKey = `${symbol}_${period}`;
  if (KLINE_CACHE.has(cacheKey)) {
    return KLINE_CACHE.get(cacheKey)!;
  }

  const localSeries = await loadLocalKlineSeries(symbol, period);
  if (localSeries && localSeries.length) {
    setDataFreshnessMeta(`stock-kline:${symbol}:${period}`, {
      detail: '本地 K 线',
      source: 'local',
      updatedAt: null,
    });
    KLINE_CACHE.set(cacheKey, localSeries);
    return localSeries;
  }

  try {
    const secid = getSecidForSymbol(symbol);
    const action = MAJOR_INDEX_SECID_MAP[symbol] ? 'index_kline' : 'stock_kline';
    const json = await requestEastmoneyAction<any>(
      action,
      { period, secid, symbol },
      { metaKey: `stock-kline:${symbol}:${period}`, preferSnapshot: true },
    );

    let result: KlineData[] = [];
    if (json?.data?.klines) {
      result = json.data.klines.map((item: string) => {
        const [date, open, close, high, low, volume] = item.split(',');
        return {
          date,
          open: Number(open),
          close: Number(close),
          high: Number(high),
          low: Number(low),
          volume: Number(volume),
        };
      });
    } else {
      throw new Error('No kline data in response');
    }

    KLINE_CACHE.set(cacheKey, result);
    return result;
  } catch {
    return generateMockKlines(symbol, period);
  }
};

export const getSingleDayCloseChange = async (symbol: string, dateStr?: string): Promise<number | null> => {
  const klines = await getStockKline(symbol, 101);
  if (!klines.length) return null;

  const targetDate = dateStr ?? new Date().toISOString().split('T')[0];
  const targetIndex = findTargetKlineIndex(klines, targetDate);
  if (targetIndex <= 0) return null;

  const today = klines[targetIndex];
  const prev = klines[targetIndex - 1];
  if (!today || !prev || prev.close <= 0) return null;

  const pct = ((today.close - prev.close) / prev.close) * 100;
  return pct;
};

export const getSingleDayPerformance = async (
  symbol: string,
  dateStr: string,
): Promise<{ openPct: number; closePct: number; isOneWord: boolean } | null> => {
  const klines = await getStockKline(symbol, 101);
  if (!klines.length) return null;

  const targetIndex = findTargetKlineIndex(klines, dateStr);
  if (targetIndex <= 0) return null;

  const today = klines[targetIndex];
  const prev = klines[targetIndex - 1];
  if (!today || !prev || prev.close <= 0) return null;

  const openPct = ((today.open - prev.close) / prev.close) * 100;
  const closePct = ((today.close - prev.close) / prev.close) * 100;
  const isOneWord =
    Math.abs(today.open - today.close) < 0.001 &&
    Math.abs(today.open - today.high) < 0.001 &&
    Math.abs(today.open - today.low) < 0.001;

  return {
    openPct: Number(openPct.toFixed(2)),
    closePct: Number(closePct.toFixed(2)),
    isOneWord,
  };
};
