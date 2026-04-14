import { Stock, KlineData } from '../types';
import { MOCK_STOCKS } from '../constants';
import { db, STORES } from './db';
import { fetchJsonWithFallback } from './eastmoneyService';
import { loadLocalJsonFile } from './localDataService';

type LocalKlineFile = {
  symbol: string;
  updated?: string;
  periods?: Record<string, KlineData[]>;
};

const MAJOR_INDEX_SECID_MAP: Record<string, string> = {
  '000001': '1.000001',
  '399001': '0.399001',
  '399006': '0.399006',
  '000688': '1.000688',
};

const MAJOR_INDEX_FALLBACKS: Stock[] = [
  {
    symbol: '000001',
    name: '上证指数',
    price: 0,
    pctChange: 0,
    volume: '-',
    turnover: '-',
    industry: '宽基指数',
    concepts: ['上证', '指数'],
    pe: 0,
    pb: 0,
    marketCap: 0,
  },
  {
    symbol: '399001',
    name: '深证成指',
    price: 0,
    pctChange: 0,
    volume: '-',
    turnover: '-',
    industry: '宽基指数',
    concepts: ['深证', '指数'],
    pe: 0,
    pb: 0,
    marketCap: 0,
  },
  {
    symbol: '399006',
    name: '创业板指',
    price: 0,
    pctChange: 0,
    volume: '-',
    turnover: '-',
    industry: '宽基指数',
    concepts: ['创业板', '指数'],
    pe: 0,
    pb: 0,
    marketCap: 0,
  },
  {
    symbol: '000688',
    name: '科创50',
    price: 0,
    pctChange: 0,
    volume: '-',
    turnover: '-',
    industry: '宽基指数',
    concepts: ['科创', '指数'],
    pe: 0,
    pb: 0,
    marketCap: 0,
  },
];

const loadLocalStockList = async (fileName: string): Promise<Stock[] | null> => {
  const payload = await loadLocalJsonFile<Stock[]>(fileName);
  return Array.isArray(payload) && payload.length ? payload : null;
};

type StrategyCheckOptions = {
  name?: string;
};

const loadLocalKlineSeries = async (symbol: string, period: number): Promise<KlineData[] | null> => {
  try {
    const payload = await loadLocalJsonFile<LocalKlineFile>(`klines/${symbol}.json`);
    if (!payload?.periods) return null;
    const series = payload.periods[String(period)];
    if (Array.isArray(series) && series.length) {
      return series;
    }
    return null;
  } catch {
    return null;
  }
};

const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

const generateMockKlines = (symbol: string, _period: number, limit: number = 200): KlineData[] => {
  const data: KlineData[] = [];
  const now = new Date();

  let seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  let price = 10 + (seed % 100);

  for (let i = limit; i > 0; i--) {
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mapStockFromItem = (item: any): Stock => {
  const realIndustry = item.f100 || 'A股';

  return {
    symbol: String(item.f12),
    name: item.f14,
    price: item.f2 === '-' ? 0 : item.f2,
    pctChange: item.f3 === '-' ? 0 : item.f3,
    volume: item.f5 === '-' ? '0' : `${(item.f5 / 10000).toFixed(1)}万`,
    turnover: item.f6 === '-' ? '0' : `${(item.f6 / 100000000).toFixed(2)}亿`,
    industry: realIndustry,
    concepts: [realIndustry],
    pe: item.f9 === '-' ? 0 : item.f9,
    pb: item.f23 === '-' ? 0 : item.f23,
    marketCap: item.f20 === '-' ? 0 : Number((item.f20 / 100000000).toFixed(0)),
  };
};

const buildStockListUrl = (page: number, pageSize: number) => {
  const timestamp = Date.now();
  return `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20,f100&_=${timestamp}`;
};

const getSecidForSymbol = (symbol: string) => {
  const normalizedSymbol = String(symbol).trim();
  if (MAJOR_INDEX_SECID_MAP[normalizedSymbol]) {
    return MAJOR_INDEX_SECID_MAP[normalizedSymbol];
  }
  const market = normalizedSymbol.startsWith('6') ? '1' : '0';
  return `${market}.${normalizedSymbol}`;
};

const mergeUniqueStocks = (...groups: Stock[][]): Stock[] => {
  const merged = new Map<string, Stock>();
  groups.flat().forEach((item) => {
    merged.set(item.symbol, item);
  });
  return Array.from(merged.values());
};

const fetchMajorIndexes = async (): Promise<Stock[]> => {
  try {
    const secids = Object.values(MAJOR_INDEX_SECID_MAP).join(',');
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20,f100&secids=${secids}&ut=bd1d9ddb04089700cf9c27f6f7426281&_=${Date.now()}`;
    const data = await fetchJsonWithFallback(url);
    if (!Array.isArray(data?.data?.diff) || data.data.diff.length === 0) {
      throw new Error('No index data');
    }
    return data.data.diff.map((item: any) => ({
      ...mapStockFromItem(item),
      industry: '宽基指数',
      concepts: [item.f14, '指数'],
    }));
  } catch (error) {
    console.warn('Failed to fetch major indexes', error);
    return MAJOR_INDEX_FALLBACKS;
  }
};

const fetchStockListPage = async (page: number, pageSize: number): Promise<Stock[]> => {
  const url = buildStockListUrl(page, pageSize);
  const data = await fetchJsonWithFallback(url);
  if (!data?.data?.diff) return [];
  return data.data.diff.map((item: any) => mapStockFromItem(item));
};

const KLINE_CACHE = new Map<string, KlineData[]>();

export const getStockList = async (): Promise<Stock[]> => {
  try {
    const now = Date.now();
    const majorIndexes = await fetchMajorIndexes();
    const localStocks = await loadLocalStockList('stock_list_full.json');
    if (localStocks) {
      const sliced = mergeUniqueStocks(majorIndexes, localStocks.slice(0, 100));
      await db.put(STORES.STOCKS, { type: 'all', timestamp: now, data: sliced });
      return sliced;
    }

    const cached = await db.get<{ type: string; timestamp: number; data: Stock[] }>(STORES.STOCKS, 'all');
    const oneDay = 24 * 60 * 60 * 1000;
    if (cached && now - cached.timestamp < oneDay) {
      return cached.data;
    }

    const stocks = mergeUniqueStocks(majorIndexes, await fetchStockListPage(1, 100));
    await db.put(STORES.STOCKS, { type: 'all', timestamp: now, data: stocks });
    return stocks;
  } catch {
    const cached = await db.get<{ type: string; timestamp: number; data: Stock[] }>(STORES.STOCKS, 'all');
    if (cached) return cached.data;
    console.warn('Using Mock Stock List due to API failure');
    return MOCK_STOCKS;
  }
};

export const getFullMarketStockList = async (): Promise<Stock[]> => {
  const now = Date.now();
  const localStocks = await loadLocalStockList('stock_list_full.json');
  if (localStocks) {
    await db.put(STORES.STOCKS, { type: 'full', timestamp: now, data: localStocks });
    return localStocks;
  }

  const cached = await db.get<{ type: string; timestamp: number; data: Stock[] }>(STORES.STOCKS, 'full');
  if (cached && now - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached.data;
  }

  try {
    const pageSize = 400;
    const maxPages = 30;
    const aggregated: Stock[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const chunk = await fetchStockListPage(page, pageSize);
      if (chunk.length === 0) break;
      aggregated.push(...chunk);
      if (chunk.length < pageSize) break;
      await delay(80);
    }

    if (aggregated.length > 0) {
      await db.put(STORES.STOCKS, { type: 'full', timestamp: now, data: aggregated });
      return aggregated;
    }
  } catch (error) {
    console.warn('Failed to fetch full market stock list', error);
  }

  return getStockList();
};

export const getChiNextList = async (): Promise<Stock[]> => {
  try {
    const now = Date.now();

    const localStocks = await loadLocalStockList('stock_list_chinext.json');
    if (localStocks) {
      await db.put(STORES.STOCKS, { type: 'chinext', timestamp: now, data: localStocks });
      return localStocks;
    }

    const cached = await db.get<{ type: string; timestamp: number; data: Stock[] }>(STORES.STOCKS, 'chinext');
    if (cached && now - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.data;
    }

    const timestamp = Date.now();
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=50&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=m:0+t:80&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20&_=${timestamp}`;
    const data = await fetchJsonWithFallback(url);
    if (!data.data || !data.data.diff) throw new Error('No data');

    const stocks = data.data.diff.map((item: any) => ({
      symbol: String(item.f12),
      name: item.f14,
      price: item.f2 === '-' ? 0 : item.f2,
      pctChange: item.f3 === '-' ? 0 : item.f3,
      volume: item.f5 === '-' ? '0' : `${(item.f5 / 10000).toFixed(1)}万`,
      turnover: item.f6 === '-' ? '0' : `${(item.f6 / 100000000).toFixed(2)}亿`,
      industry: '创业板',
      concepts: ['成长', '热门'],
      pe: item.f9 === '-' ? 0 : item.f9,
      pb: item.f23 === '-' ? 0 : item.f23,
      marketCap: item.f20 === '-' ? 0 : Number((item.f20 / 100000000).toFixed(0)),
    }));

    await db.put(STORES.STOCKS, { type: 'chinext', timestamp: now, data: stocks });
    return stocks;
  } catch {
    console.warn('Using Mock ChiNext List due to API failure');
    return Array.from({ length: 20 }, (_, i) => ({
      symbol: `300${100 + i}`,
      name: `创业板${i + 1}号`,
      price: 20 + Math.random() * 30,
      pctChange: (Math.random() - 0.5) * 10,
      volume: '10万',
      turnover: '5亿',
      industry: '创业板',
      concepts: ['Mock'],
      pe: 30,
      pb: 4,
      marketCap: 100,
    }));
  }
};

export const getStockKline = async (symbol: string, period: number = 101): Promise<KlineData[]> => {
  const cacheKey = `${symbol}_${period}`;
  if (KLINE_CACHE.has(cacheKey)) {
    return KLINE_CACHE.get(cacheKey)!;
  }

  const localSeries = await loadLocalKlineSeries(symbol, period);
  if (localSeries && localSeries.length) {
    KLINE_CACHE.set(cacheKey, localSeries);
    return localSeries;
  }

  try {
    const secid = getSecidForSymbol(symbol);
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1&fields2=f51,f52,f53,f54,f55,f57&klt=${period}&fqt=1&end=20500101&lmt=200&_=${Date.now()}`;
    const json = await fetchJsonWithFallback(url);

    let result: KlineData[] = [];
    if (json.data && json.data.klines) {
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
  let targetIndex = -1;
  for (let i = klines.length - 1; i >= 0; i--) {
    const entryDate = klines[i]?.date;
    if (!entryDate) continue;
    if (entryDate <= targetDate) {
      targetIndex = i;
      break;
    }
  }

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

  let targetIndex = -1;
  for (let i = klines.length - 1; i >= 0; i--) {
    const entryDate = klines[i]?.date;
    if (!entryDate) continue;
    if (entryDate <= dateStr) {
      targetIndex = i;
      break;
    }
  }

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

const getLatestTradingIndex = (series: KlineData[]): number => {
  if (!series.length) return -1;
  const todayStr = new Date().toISOString().split('T')[0];
  for (let i = series.length - 1; i >= 0; i--) {
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
  for (let i = start; i <= endIndex; i++) {
    if (flags[i]) count++;
  }
  return count;
};

const countTradingDaysBetween = (series: KlineData[], startIndex: number, endIndex: number) => {
  if (startIndex >= endIndex) return 0;
  let tradingDays = 0;
  for (let i = startIndex + 1; i <= endIndex; i++) {
    const dateStr = series[i]?.date;
    if (!dateStr) continue;
    const day = new Date(dateStr).getDay();
    if (day !== 0 && day !== 6) {
      tradingDays++;
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

  const getPct = (i: number) => {
    if (i <= 0) return 0;
    const prev = klines[i - 1].close;
    const curr = klines[i].close;
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
    for (let j = 0; j < 5; j++) {
      sum += klines[len - 1 - j].close;
    }
    const ma5 = sum / 5;
    if (klines[len - 1].close < ma5) return false;

    const todayPct = getPct(len - 1);
    if (todayPct > 5) return false;

    let hasLimitUp = false;
    for (let i = 2; i <= 6; i++) {
      if (len - i < 0) break;
      const p = getPct(len - i);
      if (p > 9.5) {
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
    for (let j = 0; j < 5; j++) {
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
    for (let i = 1; i < len; i++) {
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
    for (let i = 1; i < len; i++) {
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
    for (let i = len - 1; i >= 0; i--) {
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
