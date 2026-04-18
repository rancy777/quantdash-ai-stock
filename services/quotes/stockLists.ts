import type { Stock } from '../../types';
import { MOCK_STOCKS } from '../../constants';
import { db, STORES } from '../db';
import {
  getDataFreshnessMeta,
  mergeDataFreshnessMeta,
  requestEastmoneyAction,
  setDataFreshnessMeta,
} from '../eastmoneyService';
import {
  delay,
  loadLocalStockList,
  MAJOR_INDEX_FALLBACKS,
  mapStockFromItem,
  mergeUniqueStocks,
} from './shared';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STOCK_LIST_META_KEY = 'stock-list';
const CHINEXT_META_KEY = 'chinext-list';

const fetchMajorIndexes = async (): Promise<Stock[]> => {
  try {
    const data = await requestEastmoneyAction<any>('major_indexes', {}, { metaKey: 'major-indexes', preferSnapshot: true });
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
  const data = await requestEastmoneyAction<any>(
    'stock_list_page',
    { page, pageSize },
    { metaKey: `stock-list-page-${page}-${pageSize}`, preferSnapshot: true },
  );
  if (!data?.data?.diff) return [];
  return data.data.diff.map((item: any) => mapStockFromItem(item));
};

export const getStockListDataFreshness = () => getDataFreshnessMeta(STOCK_LIST_META_KEY);
export const getChiNextListDataFreshness = () => getDataFreshnessMeta(CHINEXT_META_KEY);

export const getStockList = async (): Promise<Stock[]> => {
  try {
    const now = Date.now();
    const localStocks = await loadLocalStockList('stock_list_full.json');
    if (localStocks) {
      setDataFreshnessMeta(STOCK_LIST_META_KEY, {
        detail: '本地股票列表',
        source: 'local',
        updatedAt: null,
      });
      const majorIndexes = MAJOR_INDEX_FALLBACKS;
      const sliced = mergeUniqueStocks(majorIndexes, localStocks.slice(0, 100));
      await db.put(STORES.STOCKS, { type: 'all', timestamp: now, data: sliced });
      return sliced;
    }

    const cached = await db.get<{ type: string; timestamp: number; data: Stock[] }>(STORES.STOCKS, 'all');
    if (cached && now - cached.timestamp < ONE_DAY_MS) {
      setDataFreshnessMeta(STOCK_LIST_META_KEY, {
        detail: 'IndexedDB 缓存',
        source: 'local',
        updatedAt: new Date(cached.timestamp).toISOString(),
      });
      return cached.data;
    }

    const majorIndexes = await fetchMajorIndexes();
    const stocks = mergeUniqueStocks(majorIndexes, await fetchStockListPage(1, 100));
    setDataFreshnessMeta(
      STOCK_LIST_META_KEY,
      mergeDataFreshnessMeta([
        getDataFreshnessMeta('major-indexes'),
        getDataFreshnessMeta('stock-list-page-1-100'),
      ]),
    );
    await db.put(STORES.STOCKS, { type: 'all', timestamp: now, data: stocks });
    return stocks;
  } catch {
    const cached = await db.get<{ type: string; timestamp: number; data: Stock[] }>(STORES.STOCKS, 'all');
    if (cached) {
      setDataFreshnessMeta(STOCK_LIST_META_KEY, {
        detail: 'IndexedDB 缓存',
        source: 'local',
        updatedAt: new Date(cached.timestamp).toISOString(),
      });
      return cached.data;
    }
    console.warn('Using Mock Stock List due to API failure');
    setDataFreshnessMeta(STOCK_LIST_META_KEY, {
      detail: '模拟列表',
      source: 'mock',
      updatedAt: null,
    });
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
  if (cached && now - cached.timestamp < ONE_DAY_MS) {
    return cached.data;
  }

  try {
    const pageSize = 400;
    const maxPages = 30;
    const aggregated: Stock[] = [];
    for (let page = 1; page <= maxPages; page += 1) {
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
      setDataFreshnessMeta(CHINEXT_META_KEY, {
        detail: '本地创业板列表',
        source: 'local',
        updatedAt: null,
      });
      await db.put(STORES.STOCKS, { type: 'chinext', timestamp: now, data: localStocks });
      return localStocks;
    }

    const cached = await db.get<{ type: string; timestamp: number; data: Stock[] }>(STORES.STOCKS, 'chinext');
    if (cached && now - cached.timestamp < ONE_DAY_MS) {
      setDataFreshnessMeta(CHINEXT_META_KEY, {
        detail: 'IndexedDB 缓存',
        source: 'local',
        updatedAt: new Date(cached.timestamp).toISOString(),
      });
      return cached.data;
    }

    const data = await requestEastmoneyAction<any>(
      'chinext_list',
      { pageSize: 50 },
      { metaKey: CHINEXT_META_KEY, preferSnapshot: true },
    );
    if (!data?.data?.diff) {
      throw new Error('No data');
    }

    const stocks = data.data.diff.map((item: any) => ({
      ...mapStockFromItem(item),
      industry: '创业板',
      concepts: ['成长', '热门'],
    }));

    await db.put(STORES.STOCKS, { type: 'chinext', timestamp: now, data: stocks });
    return stocks;
  } catch {
    console.warn('Using Mock ChiNext List due to API failure');
    setDataFreshnessMeta(CHINEXT_META_KEY, {
      detail: '模拟创业板列表',
      source: 'mock',
      updatedAt: null,
    });
    return Array.from({ length: 20 }, (_, index) => ({
      symbol: `300${100 + index}`,
      name: `创业板${index + 1}号`,
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
