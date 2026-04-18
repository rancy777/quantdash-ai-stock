import type { KlineData, Stock } from '../../types';
import { loadLocalJsonFile } from '../localDataService';

export type LocalKlineFile = {
  symbol: string;
  updated?: string;
  periods?: Record<string, KlineData[]>;
};

export type StrategyCheckOptions = {
  name?: string;
};

export const MAJOR_INDEX_SECID_MAP: Record<string, string> = {
  '000001': '1.000001',
  '399001': '0.399001',
  '399006': '0.399006',
  '000688': '1.000688',
};

export const MAJOR_INDEX_FALLBACKS: Stock[] = [
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

export const loadLocalStockList = async (fileName: string): Promise<Stock[] | null> => {
  const payload = await loadLocalJsonFile<Stock[]>(fileName);
  return Array.isArray(payload) && payload.length ? payload : null;
};

export const loadLocalKlineSeries = async (symbol: string, period: number): Promise<KlineData[] | null> => {
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

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mapStockFromItem = (item: any): Stock => {
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

export const buildStockListUrl = (page: number, pageSize: number) => {
  const timestamp = Date.now();
  return `https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${pageSize}&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f2,f3,f5,f6,f9,f23,f20,f100&_=${timestamp}`;
};

export const getSecidForSymbol = (symbol: string) => {
  const normalizedSymbol = String(symbol).trim();
  if (MAJOR_INDEX_SECID_MAP[normalizedSymbol]) {
    return MAJOR_INDEX_SECID_MAP[normalizedSymbol];
  }
  const market = normalizedSymbol.startsWith('6') ? '1' : '0';
  return `${market}.${normalizedSymbol}`;
};

export const mergeUniqueStocks = (...groups: Stock[][]): Stock[] => {
  const merged = new Map<string, Stock>();
  groups.flat().forEach((item) => {
    merged.set(item.symbol, item);
  });
  return Array.from(merged.values());
};
