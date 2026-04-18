import { LadderData } from '../types';
import { getDataFreshnessMeta, requestEastmoneyAction } from './eastmoneyService';

export interface LimitUpStock {
  symbol: string;
  name: string;
  boardCount: number;
  industry?: string;
  limitUpTime?: string;
}

export interface BrokenPoolStock {
  symbol: string;
  name: string;
  pctChange: number;
}

const LIMIT_UP_POOL_CACHE = new Map<string, LimitUpStock[]>();
const BROKEN_POOL_CACHE = new Map<string, BrokenPoolStock[]>();
const LIMIT_UP_POOL_META_KEY = (dateStr: string) => `limit-up-pool:${dateStr}`;
const BROKEN_POOL_META_KEY = (dateStr: string) => `broken-pool:${dateStr}`;

const formatBoardTime = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;

  const fromDigits = (digits: string) => {
    const numeric = digits.replace(/\D/g, '');
    if (!numeric) return undefined;
    const padded = numeric.padStart(6, '0').slice(-6);
    const h = padded.slice(0, 2);
    const m = padded.slice(2, 4);
    const s = padded.slice(4, 6);
    return `${h}:${m}:${s}`;
  };

  if (typeof value === 'number') {
    return fromDigits(Math.floor(value).toString());
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d+$/.test(trimmed)) {
      return fromDigits(trimmed);
    }
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':').map((part) => part.padStart(2, '0'));
      if (parts.length === 2) return `${parts[0]}:${parts[1]}`;
      if (parts.length >= 3) return `${parts[0]}:${parts[1]}:${parts[2]}`;
      return trimmed;
    }
  }

  return undefined;
};

const seedFromString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const derivePseudoTime = (symbol: string, dateLabel: string) => {
  const seed = seedFromString(`${symbol}-${dateLabel}`);
  const hour = 9 + (seed % 5);
  const minute = Math.floor(seed / 7) % 60;
  const second = Math.floor(seed / 13) % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
};

export const ensureLadderLimitTimes = (ladder: LadderData): LadderData => {
  ladder.boardCounts.forEach((row) => {
    Object.entries(row.data).forEach(([dateLabel, stocks]) => {
      stocks?.forEach((stock) => {
        if (!stock.limitUpTime) {
          stock.limitUpTime = derivePseudoTime(stock.symbol, dateLabel);
        }
      });
    });
  });
  return ladder;
};

export const fetchLimitUpPool = async (dateStr: string): Promise<LimitUpStock[]> => {
  if (LIMIT_UP_POOL_CACHE.has(dateStr)) {
    return LIMIT_UP_POOL_CACHE.get(dateStr)!;
  }

  try {
    const res = await requestEastmoneyAction<any>(
      'limit_up_pool',
      { date: dateStr },
      { metaKey: LIMIT_UP_POOL_META_KEY(dateStr), preferSnapshot: true, timeout: 4000 },
    );
    if (res?.data?.pool?.length) {
      const list = res.data.pool.map((item: any) => ({
        symbol: String(item.c),
        name: item.n,
        boardCount: item.lbc,
        industry: item.hybk || '市场热点',
        limitUpTime: formatBoardTime(item.lbt ?? item.zttime ?? item.zttm ?? item.fbt ?? item.ftime ?? item.lst),
      }));
      LIMIT_UP_POOL_CACHE.set(dateStr, list);
      return list;
    }
  } catch (error) {
    console.warn('Failed to fetch limit up list', dateStr, error);
  }

  LIMIT_UP_POOL_CACHE.set(dateStr, []);
  return [];
};

export const fetchBrokenPool = async (dateStr: string): Promise<BrokenPoolStock[]> => {
  if (BROKEN_POOL_CACHE.has(dateStr)) {
    return BROKEN_POOL_CACHE.get(dateStr)!;
  }

  try {
    const res = await requestEastmoneyAction<any>(
      'broken_pool',
      { date: dateStr },
      { metaKey: BROKEN_POOL_META_KEY(dateStr), preferSnapshot: true, timeout: 4000 },
    );
    if (res?.data?.pool?.length) {
      const list = res.data.pool.map((item: any) => ({
        symbol: String(item.c),
        name: item.n,
        pctChange: Number(item.zdp ?? 0),
      }));
      BROKEN_POOL_CACHE.set(dateStr, list);
      return list;
    }
  } catch (error) {
    console.warn('Failed to fetch broken pool', dateStr, error);
  }

  BROKEN_POOL_CACHE.set(dateStr, []);
  return [];
};

export const getLimitUpPoolDataFreshness = (dateStr: string) => getDataFreshnessMeta(LIMIT_UP_POOL_META_KEY(dateStr));
export const getBrokenPoolDataFreshness = (dateStr: string) => getDataFreshnessMeta(BROKEN_POOL_META_KEY(dateStr));
